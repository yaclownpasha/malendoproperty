<?php
/** Durable, send-only outbox. Loading the theme never performs network requests. */
if (!defined('ABSPATH')) { exit; }

interface Malendo_Outbox_Store {
    public function read(int $id): ?array;
    public function insert(int $id, array $job): bool;
    public function replace(int $id, string $expected, array $job): bool;
}

final class Malendo_WP_Outbox implements Malendo_Outbox_Store {
    const PREFIX = 'malendo_notify_v1_';
    public function read(int $id): ?array {
        global $wpdb;
        $raw = $wpdb->get_var($wpdb->prepare("SELECT option_value FROM {$wpdb->options} WHERE option_name=%s", self::PREFIX.$id));
        if (!is_string($raw)) { return null; }
        $job = json_decode($raw, true);
        if (!is_array($job) || ($job['id'] ?? null) !== $id) { throw new RuntimeException('outbox_corrupt'); }
        return array('raw'=>$raw, 'job'=>$job);
    }
    public function insert(int $id, array $job): bool {
        global $wpdb;
        // option_name has a unique index; no read/check/write race and no autoload.
        return $wpdb->query($wpdb->prepare("INSERT IGNORE INTO {$wpdb->options} (option_name,option_value,autoload) VALUES (%s,%s,'no')",
            self::PREFIX.$id, json_encode($job, JSON_THROW_ON_ERROR))) === 1;
    }
    public function replace(int $id, string $expected, array $job): bool {
        global $wpdb;
        // Binary comparison is essential with case-insensitive WordPress collations.
        return $wpdb->query($wpdb->prepare("UPDATE {$wpdb->options} SET option_value=%s WHERE option_name=%s AND BINARY option_value=BINARY %s",
            json_encode($job, JSON_THROW_ON_ERROR), self::PREFIX.$id, $expected)) === 1;
    }
}

final class Malendo_Outbox {
    const MAX_ATTEMPTS = 5;
    const LEASE = 180;
    private $store;
    private $clock;
    private $jitter;
    public function __construct(Malendo_Outbox_Store $store, ?callable $clock=null, ?callable $jitter=null) {
        $this->store=$store; $this->clock=$clock ?? 'time';
        $this->jitter=$jitter ?? static fn()=>random_int(0,30);
    }
    private function stamp(array $job, string $state, string $code): array {
        $now=($this->clock)();
        $job['state']=$state; $job['code']=$code; $job['updated']=$now;
        $job['revision']=bin2hex(random_bytes(16));
        $job['log'][]=array('utc'=>gmdate('c',$now), 'bangkok'=>(new DateTimeImmutable('@'.$now))->setTimezone(new DateTimeZone('Asia/Bangkok'))->format('c'), 'state'=>$state, 'code'=>$code);
        $job['log']=array_slice($job['log'],-20);
        return $job;
    }
    private function change(int $id, array &$snapshot, array $job, string $state, string $code): bool {
        $job=$this->stamp($job,$state,$code);
        if (!$this->store->replace($id,$snapshot['raw'],$job)) { return false; }
        $snapshot=array('raw'=>json_encode($job,JSON_THROW_ON_ERROR),'job'=>$job);
        return true;
    }
    public function enqueue(int $id, array $ready): bool {
        if ($id<=56 || empty($ready['eligible']) || !empty($ready['qa'])) { return false; }
        $job=array('id'=>$id,'generation'=>$ready['generation'],'saved_at'=>$ready['saved_at'],
            'service'=>$ready['service'],'state'=>'pending','attempts'=>0,'next'=>($this->clock)(),
            'lease'=>0,'message_id'=>null,'log'=>array());
        $job=$this->stamp($job,'pending','queued');
        if ($this->store->insert($id,$job)) { return true; }
        return $this->store->read($id)!==null;
    }
    public function rejectRecoveredMarker(int $id): void {
        if($id<=56){return;}
        $job=$this->stamp(array('id'=>$id,'attempts'=>0,'next'=>0,'lease'=>0,'log'=>array()),'failed','saved_record_changed');
        $this->store->insert($id,$job);
    }
    public function tick(int $id, Malendo_Gmail_Transport $transport, callable $eligible): string {
        if (!$transport->enabled()) { return 'disabled'; }
        $snapshot=$this->store->read($id);
        if (!$snapshot) { return 'missing'; }
        $job=$snapshot['job']; $now=($this->clock)();
        if ($job['state']==='sending' && $job['lease']<=$now) {
            $this->change($id,$snapshot,$job,'unknown_delivery','expired_send');
            return 'unknown_delivery';
        }
        if ($job['state']==='claimed' && $job['lease']<=$now) {
            if (!$this->change($id,$snapshot,$job,'retry','expired_before_send')) { return 'busy'; }
            $job=$snapshot['job'];
        }
        if (!in_array($job['state'],array('pending','retry'),true) || $job['next']>$now) { return $job['state']; }
        if ($job['attempts']>=self::MAX_ATTEMPTS) {
            $this->change($id,$snapshot,$job,'failed','attempt_limit'); return 'failed';
        }
        if (!$eligible($id,$job)) {
            $this->change($id,$snapshot,$job,'failed','saved_record_changed'); return 'failed';
        }
        $job['attempts']++; $job['lease']=$now+self::LEASE;
        if (!$this->change($id,$snapshot,$job,'claimed','claimed')) { return 'busy'; }
        // Every transition has a fence. A paused old worker cannot send after a new claim.
        $beforeSend=function() use($id,&$snapshot,$eligible): bool {
            if (!$eligible($id,$snapshot['job'])) { return false; }
            $j=$snapshot['job'];
            if ($j['lease']<=($this->clock)()) { return false; }
            return $this->change($id,$snapshot,$j,'sending','send_started');
        };
        $after401=function() use($id,&$snapshot): bool {
            return $this->change($id,$snapshot,$snapshot['job'],'claimed','send_rejected_401');
        };
        try { $result=$transport->deliver($snapshot['job'],$beforeSend,$after401); }
        catch (Throwable $e) { $result=array('state'=>$snapshot['job']['state']==='sending'?'unknown_delivery':'retry','code'=>'transport_exception'); }
        $job=$snapshot['job'];
        if (($result['state'] ?? '')==='lost') { return 'busy'; }
        $state=$result['state']; $code=$result['code'];
        if ($state==='retry') {
            if ($job['attempts']>=self::MAX_ATTEMPTS) { $state='failed'; $code='attempt_limit'; }
            else { $job['next']=($this->clock)()+max(60*(2**($job['attempts']-1))+($this->jitter)(), (int)($result['retry_after']??0)); }
        }
        if ($state==='accepted') { $job['message_id']=$result['message_id']; }
        $job['lease']=0;
        return $this->change($id,$snapshot,$job,$state,$code) ? $state : 'busy';
    }
}

final class Malendo_Gmail_Transport {
    const SCOPE='https://www.googleapis.com/auth/gmail.send';
    const SENDER='malendophuket@gmail.com';
    const RECIPIENT='acrabash@gmail.com';
    const SEND_URL='https://gmail.googleapis.com/gmail/v1/users/malendophuket%40gmail.com/messages/send';
    private $on;
    private $credentials;
    private $http;
    public function __construct(bool $enabled, callable $credentials, ?callable $http=null) {
        $this->on=$enabled; $this->credentials=$credentials; $this->http=$http ?? array(self::class,'http');
    }
    public function enabled(): bool { return $this->on; }
    private function result(string $state,string $code): array { return array('state'=>$state,'code'=>$code); }
    private function retryResult(array $response,string $code): array {
        $delay=$response['retry_after']??'';
        $seconds=preg_match('/^[0-9]+$/D',(string)$delay)?(int)$delay:max(0,(int)strtotime((string)$delay)-time());
        if($seconds>86400){return $this->result('failed','retry_after_requires_review');}
        return array('state'=>'retry','code'=>$code,'retry_after'=>$seconds);
    }
    public static function credentials(string $path): array {
        $real=realpath($path); $web=realpath(ABSPATH); $code=realpath(__DIR__);
        if (!$real || is_link($path) || !is_file($real) || !$web || !$code ||
            str_starts_with($real,$web.DIRECTORY_SEPARATOR) || str_starts_with($real,$code.DIRECTORY_SEPARATOR) ||
            (fileperms($real)&0777)!==0600 || !function_exists('posix_geteuid') || fileowner($real)!==posix_geteuid() || filesize($real)>8192) {
            throw new RuntimeException('credentials_unavailable');
        }
        // Refuse a file anywhere inside a Git worktree, even outside the webroot.
        for($dir=dirname($real);$dir!==dirname($dir);$dir=dirname($dir)){
            if(file_exists($dir.'/.git')){throw new RuntimeException('credentials_in_git');}
        }
        $data=json_decode(file_get_contents($real),true,16,JSON_THROW_ON_ERROR);
        foreach(array('client_id','client_secret','refresh_token') as $k) {
            if (!isset($data[$k]) || !is_string($data[$k]) || $data[$k]==='' || preg_match('/[\r\n]/',$data[$k])) { throw new RuntimeException('credentials_invalid'); }
        }
        if (($data['sender']??'')!==self::SENDER) { throw new RuntimeException('credentials_sender'); }
        return $data;
    }
    public static function mime(array $job): string {
        $services=array('Property management','Rental','Buying or selling','Project check','Owner services','Other');
        if (!is_int($job['id']) || $job['id']<=56 || !in_array($job['service'],$services,true) ||
            !preg_match('/^[a-f0-9]{32}$/D',$job['generation']) || !is_int($job['saved_at'])) { throw new RuntimeException('message_invalid'); }
        $subject='Malendo — New enquiry #'.$job['id'];
        $body='Enquiry ID: '.$job['id']."\r\nSaved at: ".(new DateTimeImmutable('@'.$job['saved_at']))->setTimezone(new DateTimeZone('Asia/Bangkok'))->format('Y-m-d H:i:s').' Asia/Bangkok'.
            "\r\nService: ".$job['service']."\r\nOpen in WordPress: https://malendo-property.com/wp-admin/post.php?post=".$job['id']."&action=edit\r\nWordPress sign-in and permission to view this record are required.\r\n";
        return 'From: '.self::SENDER."\r\nTo: ".self::RECIPIENT."\r\nSubject: =?UTF-8?B?".base64_encode($subject)."?=\r\n".
            'Message-ID: <malendo-v1-'.$job['generation'].'-'.$job['id']."@malendo-property.com>\r\n".
            'Date: '.gmdate('D, d M Y H:i:s O',$job['saved_at'])."\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n".chunk_split(base64_encode($body),76,"\r\n");
    }
    private function token(array $credentials): array {
        $r=($this->http)('https://oauth2.googleapis.com/token',array('Content-Type: application/x-www-form-urlencoded'),
            http_build_query(array('client_id'=>$credentials['client_id'],'client_secret'=>$credentials['client_secret'],
                'refresh_token'=>$credentials['refresh_token'],'grant_type'=>'refresh_token'),'','&',PHP_QUERY_RFC3986));
        $data=json_decode($r['body']??'',true);
        if (($data['error']??'')==='invalid_grant' || in_array($r['status'],array(400,401,403),true)) { return $this->result('needs_reauth','oauth_rejected'); }
        if ($r['status']!==200) { return $this->retryResult($r,'oauth_unavailable'); }
        $scopes=preg_split('/\s+/',trim((string)($data['scope']??'')));
        if ($scopes!==array(self::SCOPE) || ($data['token_type']??'')!=='Bearer' ||
            !is_string($data['access_token']??null) || !preg_match('/^[A-Za-z0-9._~-]+$/D',$data['access_token'])) {
            return $this->result('needs_reauth','oauth_scope_or_token');
        }
        return array('token'=>$data['access_token']);
    }
    public function deliver(array $job,callable $beforeSend,callable $after401): array {
        if (!$this->on) { return $this->result('disabled','transport_disabled'); }
        try { $credentials=($this->credentials)(); $mime=self::mime($job); }
        catch (Throwable $e) { return $this->result('needs_reauth','configuration_invalid'); }
        for($auth=0;$auth<2;$auth++) {
            $token=$this->token($credentials);
            if (!isset($token['token'])) { return $token; }
            if (!$beforeSend()) { return $this->result('lost','claim_lost'); }
            $r=($this->http)(self::SEND_URL,array('Content-Type: application/json','Authorization: Bearer '.$token['token']),
                json_encode(array('raw'=>rtrim(strtr(base64_encode($mime),'+/','-_'),'=')),JSON_THROW_ON_ERROR));
            unset($token);
            $data=json_decode($r['body']??'',true); $status=(int)$r['status'];
            if ($status===401 && $auth===0) { if (!$after401()) { return $this->result('lost','claim_lost'); } continue; }
            if ($status===401) { return $this->result('needs_reauth','gmail_unauthorized'); }
            if ($status===403) { return $this->result('needs_reauth','gmail_permission_denied'); }
            if ($status===200 && is_string($data['id']??null) && preg_match('/^[a-zA-Z0-9_-]{1,128}$/D',$data['id'])) {
                return array('state'=>'accepted','code'=>'gmail_accepted','message_id'=>$data['id']);
            }
            // Retry only explicit rejection or a proven connection failure before upload.
            if (($status===0 && ($r['before_send']??false)) ||
                (in_array($status,array(429,503),true) && ($data['error']['code']??null)===$status)) {
                return $this->retryResult($r,$status===0?'connect_failed':'gmail_rejected_transient');
            }
            if ($status>=400 && $status<500) { return $this->result('failed','gmail_rejected_permanent'); }
            return $this->result('unknown_delivery','send_outcome_unknown');
        }
        return $this->result('needs_reauth','gmail_unauthorized');
    }
    public static function http(string $url,array $headers,string $body): array {
        if (!in_array($url,array('https://oauth2.googleapis.com/token',self::SEND_URL),true) || !function_exists('curl_init')) {
            throw new RuntimeException('transport_unavailable');
        }
        $ch=curl_init($url); $response=''; $retry='';
        curl_setopt_array($ch,array(CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>$body,CURLOPT_HTTPHEADER=>$headers,
            CURLOPT_FOLLOWLOCATION=>false,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_SSL_VERIFYPEER=>true,
            CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>20,CURLOPT_PROXY=>'',
            CURLOPT_WRITEFUNCTION=>static function($ch,$chunk) use(&$response) { if(strlen($response)+strlen($chunk)>32768){return 0;} $response.=$chunk; return strlen($chunk); },
            CURLOPT_HEADERFUNCTION=>static function($ch,$line) use(&$retry) { if(stripos($line,'Retry-After:')===0){$retry=trim(substr($line,12));} return strlen($line); }));
        $ok=curl_exec($ch); $errno=curl_errno($ch); $status=(int)curl_getinfo($ch,CURLINFO_RESPONSE_CODE); curl_close($ch);
        return array('status'=>$ok===false?0:$status,'body'=>$response,'retry_after'=>$retry,
            'before_send'=>$ok===false && in_array($errno,array(CURLE_COULDNT_RESOLVE_HOST,CURLE_COULDNT_CONNECT),true));
    }
}

function malendo_notification_activation(): ?array {
    $a=get_option('malendo_notify_activation_v1',null);
    return is_array($a) && is_int($a['after_id']??null) && $a['after_id']>=56 &&
        preg_match('/^[a-f0-9]{32}$/D',(string)($a['generation']??'')) ? $a : null;
}
function malendo_lead_fields(): array { return array('name','email','phone','service','message','landing','locale','consented_at'); }
function malendo_lead_fields_hash(array $fields): string { ksort($fields); return hash('sha256',json_encode($fields,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)); }
function malendo_lead_saved_marker(int $id,array $expected,?array $activation,bool $qa): bool {
    wp_cache_delete($id,'post_meta');
    foreach(malendo_lead_fields() as $field) {
        if (!array_key_exists($field,$expected) || !metadata_exists('post',$id,'_malendo_'.$field) || (string)get_post_meta($id,'_malendo_'.$field,true)!==$expected[$field]) { return false; }
    }
    if (get_post_type($id)!=='malendo_lead' || get_post_status($id)!=='private') { return false; }
    $marker=array('hash'=>malendo_lead_fields_hash($expected),'eligible'=>$activation!==null && $id>$activation['after_id'] && $id>56 && !$qa,
        'generation'=>$activation['generation']??'', 'qa'=>$qa,'saved_at'=>time(),'service'=>$expected['service']);
    $raw=json_encode($marker,JSON_THROW_ON_ERROR);
    update_post_meta($id,'_malendo_saved_v1',$raw);
    wp_cache_delete($id,'post_meta');
    return get_post_meta($id,'_malendo_saved_v1',true)===$raw;
}
function malendo_notification_ready(int $id): ?array {
    if ($id<=56 || get_post_type($id)!=='malendo_lead' || get_post_status($id)!=='private') { return null; }
    wp_cache_delete($id,'post_meta');
    $m=json_decode((string)get_post_meta($id,'_malendo_saved_v1',true),true); $a=malendo_notification_activation();
    if (!$a || !$m || empty($m['eligible']) || !empty($m['qa']) || $m['generation']!==$a['generation'] || $id<=$a['after_id']) { return null; }
    $fields=array(); foreach(malendo_lead_fields() as $f){if(!metadata_exists('post',$id,'_malendo_'.$f)){return null;}$fields[$f]=(string)get_post_meta($id,'_malendo_'.$f,true);}
    return hash_equals($m['hash'],malendo_lead_fields_hash($fields)) ? $m : null;
}
function malendo_queue_saved_lead(int $id): void {
    try {
        $ready=malendo_notification_ready($id);
        if ($ready) { (new Malendo_Outbox(new Malendo_WP_Outbox()))->enqueue($id,$ready); }
    } catch(Throwable $e) { error_log('Malendo notification queue deferred; enquiry ID '.(int)$id); }
}
add_action('malendo_enquiry_saved','malendo_queue_saved_lead',20);

function malendo_notifications_reconcile(int $limit=50): void {
    global $wpdb;
    // Only explicit new-code completion markers, never unmarked historical enquiries.
    $ids=$wpdb->get_col($wpdb->prepare("SELECT DISTINCT m.post_id FROM {$wpdb->postmeta} m LEFT JOIN {$wpdb->options} o ON o.option_name=CONCAT(%s,m.post_id) WHERE m.meta_key='_malendo_saved_v1' AND m.meta_value LIKE %s AND o.option_id IS NULL ORDER BY m.post_id LIMIT %d",
        Malendo_WP_Outbox::PREFIX,'%"eligible":true%',max(1,min(50,$limit))));
    foreach($ids as $id){
        if(malendo_notification_ready((int)$id)){malendo_queue_saved_lead((int)$id);}
        else{(new Malendo_Outbox(new Malendo_WP_Outbox()))->rejectRecoveredMarker((int)$id);}
    }
}
function malendo_notifications_worker(Malendo_Gmail_Transport $transport,int $limit=10): array {
    if (!$transport->enabled()) { return array('status'=>'disabled','processed'=>0); }
    global $wpdb;
    malendo_notifications_reconcile();
    // Query the top-level state, never historical log states. Future retries cannot starve due rows.
    $keys=$wpdb->get_col($wpdb->prepare("SELECT option_name FROM {$wpdb->options} WHERE option_name LIKE %s AND ((JSON_UNQUOTE(JSON_EXTRACT(option_value,'$.state')) IN ('pending','retry') AND CAST(JSON_UNQUOTE(JSON_EXTRACT(option_value,'$.next')) AS UNSIGNED)<=%d) OR (JSON_UNQUOTE(JSON_EXTRACT(option_value,'$.state')) IN ('claimed','sending') AND CAST(JSON_UNQUOTE(JSON_EXTRACT(option_value,'$.lease')) AS UNSIGNED)<=%d)) ORDER BY option_id LIMIT %d",
        $wpdb->esc_like(Malendo_WP_Outbox::PREFIX).'%', time(),time(),max(1,min(10,$limit))));
    if($wpdb->last_error){throw new RuntimeException('outbox_query_failed');}
    $out=array(); $engine=new Malendo_Outbox(new Malendo_WP_Outbox()); $deadline=microtime(true)+40;
    foreach($keys as $key) {
        if(count($out)>=max(1,min(10,$limit)) || microtime(true)>$deadline){break;}
        $id=(int)substr($key,strlen(Malendo_WP_Outbox::PREFIX));
        $out[$id]=$engine->tick($id,$transport,static function($id,$job){$m=malendo_notification_ready($id);return $m && $m['generation']===$job['generation'] && $m['saved_at']===$job['saved_at'] && $m['service']===$job['service'];});
    }
    return array('status'=>'complete','results'=>$out);
}
add_action('admin_menu',static function(): void {
    add_submenu_page('edit.php?post_type=malendo_lead','Notification status','Notifications','manage_options','malendo-notifications',static function(): void {
        if(!current_user_can('manage_options')){return;}
        global $wpdb;
        echo '<div class="wrap"><h1>Malendo notifications</h1><p>API accepted is not confirmed inbox delivery. Unknown delivery requires manual reconciliation; never replay automatically.</p>';
        echo '<p>Queue activation: '.(malendo_notification_activation()?'configured':'off').'. Transport is CLI-only and disabled unless explicitly enabled. Verify the external timer separately.</p>';
        $heartbeat=get_option('malendo_notify_worker_v1',array());
        $recent=is_array($heartbeat) && ($heartbeat['time']??0)>=time()-300 && ($heartbeat['status']??'')==='complete';
        echo '<p><strong>'.($recent?'Worker heartbeat is recent.':'Worker heartbeat missing, stale or failed. Notifications may be stopped.').'</strong></p>';
        $rows=$wpdb->get_col($wpdb->prepare("SELECT option_value FROM {$wpdb->options} WHERE option_name LIKE %s ORDER BY option_id DESC LIMIT 100",$wpdb->esc_like(Malendo_WP_Outbox::PREFIX).'%'));
        echo '<table><tr><th>ID</th><th>Status</th><th>Attempts</th><th>Code</th><th>Updated UTC</th></tr>';
        foreach($rows as $raw){$j=json_decode($raw,true);if(!is_array($j)){continue;}echo '<tr>';foreach(array($j['id'],$j['state'],$j['attempts'],$j['code'],gmdate('c',$j['updated'])) as $v){echo '<td>'.esc_html((string)$v).'</td>';}echo '</tr>';}
        echo '</table><p>Up to 100 recent queue entries. Save failures remain on their enquiry record.</p></div>';
    });
});
add_action('add_meta_boxes_malendo_lead',static function(): void {
    add_meta_box('malendo_save_status','Save / notification status',static function($post): void {
        if(!current_user_can('manage_options')){return;}
        $error=get_post_meta($post->ID,'_malendo_save_error',true);
        $marker=get_post_meta($post->ID,'_malendo_saved_v1',true);
        echo '<p>'.esc_html($error ? 'Incomplete save: '.$error : ($marker ? 'Completion marker recorded.' : 'Completion unverified: legacy or interrupted record; owner review required.')).'</p>';
        try{$s=(new Malendo_WP_Outbox())->read((int)$post->ID);echo '<p>'.esc_html($s ? $s['job']['state'].' / '.$s['job']['code'] : 'No notification queue entry.').'</p>';}
        catch(Throwable $e){echo '<p>Outbox read failed; owner review required.</p>';}
    },'malendo_lead','side','high');
});
