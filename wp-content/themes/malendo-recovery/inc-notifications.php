<?php
/** Durable, send-only outbox. Loading the theme never performs network requests. */
if (!defined('ABSPATH')) { exit; }

const MALENDO_LAST_HISTORICAL_LEAD = 57;
const MALENDO_CONFIRM_PREFIX = 'malendo_confirm_v3_';

class Malendo_Notification_DB_Error extends RuntimeException {}
class Malendo_Notification_Activation_Invalid extends RuntimeException {}
class Malendo_Confirmation_Unresolved extends RuntimeException {}

/** Inspect last_error before any later query can clear it. Never log its SQL or text. */
function malendo_checked_query($result) {
    global $wpdb;
    if ($result === false || $wpdb->last_error !== '') {
        throw new Malendo_Notification_DB_Error('notification_db_unavailable');
    }
    return $result;
}

/** get_var maps a stored empty string to null; keep corrupt and absent distinct. */
function malendo_notification_option_raw(string $name): ?string {
    global $wpdb;
    $row = malendo_checked_query($wpdb->get_row($wpdb->prepare(
        "SELECT option_value FROM {$wpdb->options} WHERE option_name=%s", $name
    ), ARRAY_A));
    return $row === null ? null : $row['option_value'];
}

interface Malendo_Outbox_Store {
    public function read(int $id): ?array;
    public function insert(int $id, array $job): bool;
    public function replace(int $id, string $expected, array $job): bool;
}

final class Malendo_WP_Outbox implements Malendo_Outbox_Store {
    const PREFIX = 'malendo_notify_v1_';
    public function read(int $id): ?array {
        $raw = malendo_notification_option_raw(self::PREFIX.$id);
        if (!is_string($raw)) { return null; }
        $job = json_decode($raw, true);
        if (!is_array($job) || ($job['id'] ?? null) !== $id) { throw new RuntimeException('outbox_corrupt'); }
        return array('raw'=>$raw, 'job'=>$job);
    }
    public function insert(int $id, array $job): bool {
        global $wpdb;
        // option_name has a unique index; no read/check/write race and no autoload.
        return malendo_checked_query($wpdb->query($wpdb->prepare("INSERT IGNORE INTO {$wpdb->options} (option_name,option_value,autoload) VALUES (%s,%s,'no')",
            self::PREFIX.$id, json_encode($job, JSON_THROW_ON_ERROR)))) === 1;
    }
    public function replace(int $id, string $expected, array $job): bool {
        global $wpdb;
        // Binary comparison is essential with case-insensitive WordPress collations.
        return malendo_checked_query($wpdb->query($wpdb->prepare("UPDATE {$wpdb->options} SET option_value=%s WHERE option_name=%s AND BINARY option_value=BINARY %s",
            json_encode($job, JSON_THROW_ON_ERROR), self::PREFIX.$id, $expected))) === 1;
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
        if ($id <= MALENDO_LAST_HISTORICAL_LEAD || empty($ready['eligible']) || !empty($ready['qa'])) { return false; }
        $job=array('id'=>$id,'protocol'=>3,'generation'=>$ready['generation'],'saved_at'=>$ready['saved_at'],
            'service'=>$ready['service'],'state'=>'pending','attempts'=>0,'next'=>($this->clock)(),
            'lease'=>0,'message_id'=>null,'log'=>array());
        $job=$this->stamp($job,'pending','queued');
        if ($this->store->insert($id,$job)) { return true; }
        return $this->store->read($id)!==null;
    }
    public function recordAttention(int $id, string $code): void {
        if ($id <= MALENDO_LAST_HISTORICAL_LEAD) { return; }
        $state = $code === 'saved_record_changed' ? 'failed' : 'needs_review';
        $job = $this->stamp(['id'=>$id, 'attempts'=>0, 'next'=>0, 'lease'=>0, 'log'=>[]], $state, $code);
        // Insert only: never replace an accepted, sending or unknown job.
        if (!$this->store->insert($id, $job) && !$this->store->read($id)) {
            throw new Malendo_Notification_DB_Error('attention_not_persisted');
        }
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
        if (($job['protocol'] ?? null) !== 3 || !is_int($job['attempts'] ?? null) || $job['attempts'] < 0) {
            return $this->change($id,$snapshot,$job,'needs_review','unproven_send_budget') ? 'needs_review' : 'busy';
        }
        if ($job['attempts']>=self::MAX_ATTEMPTS) {
            $this->change($id,$snapshot,$job,'failed','attempt_limit'); return 'failed';
        }
        if (!$eligible($id,$job)) {
            $this->change($id,$snapshot,$job,'failed','saved_record_changed'); return 'failed';
        }
        $job['lease']=$now+self::LEASE;
        if (!$this->change($id,$snapshot,$job,'claimed','claimed')) { return 'busy'; }
        // Every transition has a fence. A paused old worker cannot send after a new claim.
        $beforeSend=function() use($id,&$snapshot,$eligible): bool {
            if (!$eligible($id,$snapshot['job'])) { return false; }
            $j=$snapshot['job'];
            if ($j['lease']<=($this->clock)() || $j['attempts']>=self::MAX_ATTEMPTS) { return false; }
            // Reserve exactly one POST in the same CAS that grants this worker permission.
            $j['attempts']++;
            return $this->change($id,$snapshot,$j,'sending','send_started');
        };
        $after401=function() use($id,&$snapshot): bool {
            if ($snapshot['job']['attempts'] >= self::MAX_ATTEMPTS) {
                $this->change($id,$snapshot,$snapshot['job'],'failed','attempt_limit');
                return false;
            }
            return $this->change($id,$snapshot,$snapshot['job'],'claimed','send_rejected_401');
        };
        try { $result=$transport->deliver($snapshot['job'],$beforeSend,$after401); }
        catch (Malendo_Notification_DB_Error $error) {
            // claimed can also follow a rejected POST. Never refund a persisted reservation.
            if ($snapshot['job']['state'] === 'claimed') {
                $job = $snapshot['job'];
                $job['lease'] = 0;
                $job['next'] = ($this->clock)() + 60;
                $this->change($id, $snapshot, $job, 'retry', 'db_read_deferred');
            }
            throw $error;
        }
        catch (Throwable $e) { $result=array('state'=>$snapshot['job']['state']==='sending'?'unknown_delivery':'retry','code'=>'transport_exception'); }
        $job=$snapshot['job'];
        if (($result['state'] ?? '')==='lost') { return $job['state']==='failed' ? 'failed' : 'busy'; }
        $state=$result['state']; $code=$result['code'];
        if ($state==='retry') {
            // Token acquisition can fail without any send. Bound those retries separately.
            if ($job['state']==='claimed') { $job['pre_send_failures']=1+($job['pre_send_failures']??0); }
            $used=max($job['attempts'], $job['pre_send_failures']??0);
            if ($used>=self::MAX_ATTEMPTS) { $state='failed'; $code='attempt_limit'; }
            else { $job['next']=($this->clock)()+max(60*(2**($used-1))+($this->jitter)(), (int)($result['retry_after']??0)); }
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
        if (!is_int($job['id']) || $job['id'] <= MALENDO_LAST_HISTORICAL_LEAD || !in_array($job['service'],$services,true) ||
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
            if ($status === 403) {
                $reasons = $data['error']['errors'] ?? null;
                $onlyRateLimits = is_array($reasons) && count($reasons) > 0;
                foreach (is_array($reasons) ? $reasons : [] as $item) {
                    $reason = $item['reason'] ?? null;
                    if (in_array($reason, ['domainPolicy', 'forbidden', 'insufficientPermissions'], true)) {
                        return $this->result('needs_reauth', 'gmail_permission_denied');
                    }
                    if (!in_array($reason, ['rateLimitExceeded', 'userRateLimitExceeded'], true)) {
                        $onlyRateLimits = false;
                    }
                }
                return $onlyRateLimits ? $this->retryResult($r, 'gmail_rate_limited')
                    : $this->result('failed', 'gmail_403_requires_review');
            }
            if ($status === 503) {
                return $this->result('unknown_delivery', 'gmail_503_outcome_unknown');
            }
            if ($status===200 && is_string($data['id']??null) && preg_match('/^[a-zA-Z0-9_-]{1,128}$/D',$data['id'])) {
                return array('state'=>'accepted','code'=>'gmail_accepted','message_id'=>$data['id']);
            }
            // Retry only explicit rejection or a proven connection failure before upload.
            if (($status===0 && ($r['before_send']??false)) ||
                ($status===429 && ($data['error']['code']??null)===$status)) {
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
    // get_option can negative-cache a failed read. Read the immutable fence directly.
    $raw = malendo_notification_option_raw('malendo_notify_activation_v1');
    if ($raw === null) { return null; }
    $a = @unserialize($raw, ['allowed_classes'=>false]);
    if (!is_array($a) || !is_int($a['after_id'] ?? null) || $a['after_id'] < MALENDO_LAST_HISTORICAL_LEAD
        || !is_string($a['generation'] ?? null) || !preg_match('/^[a-f0-9]{32}$/D', $a['generation'])) {
        throw new Malendo_Notification_Activation_Invalid('activation_invalid');
    }
    return $a;
}

function malendo_lead_fields(): array { return array('name','email','phone','service','message','landing','locale','consented_at'); }
function malendo_lead_fields_hash(array $fields): string { ksort($fields); return hash('sha256',json_encode($fields,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)); }

/** One database snapshot. Null means missing/wrong post; false means duplicate/damaged metadata. */
function malendo_lead_snapshot(int $id): array|false|null {
    global $wpdb;
    $keys = array_map(static fn($f) => '_malendo_' . $f, [...malendo_lead_fields(), 'saved_v1']);
    $placeholders = implode(',', array_fill(0, count($keys), '%s'));
    $rows = malendo_checked_query($wpdb->get_results($wpdb->prepare(
        "SELECT p.post_type,p.post_status,m.meta_key,m.meta_value FROM {$wpdb->posts} p
         LEFT JOIN {$wpdb->postmeta} m ON m.post_id=p.ID AND m.meta_key IN ($placeholders)
         WHERE p.ID=%d", ...[...$keys, $id]
    ), ARRAY_A));
    if (!$rows || $rows[0]['post_type'] !== 'malendo_lead' || $rows[0]['post_status'] !== 'private') {
        return null;
    }
    $fields = [];
    foreach ($rows as $row) {
        if ($row['meta_key'] === null) { continue; }
        $field = substr($row['meta_key'], strlen('_malendo_'));
        $value = $row['meta_value'];
        // WP double-serializes literal serialized strings stored by update_post_meta.
        if (is_serialized($value)) { $value = @unserialize($value, ['allowed_classes'=>false]); }
        if (!is_string($value) || array_key_exists($field, $fields)) { return false; }
        $fields[$field] = $value;
    }
    return $fields;
}

/** In the submit request, retry only a SELECT. Never repeat an insert or the saved hook. */
function malendo_form_snapshot(int $id): array|false|null {
    try { return malendo_lead_snapshot($id); }
    catch (Malendo_Notification_DB_Error $e) { return malendo_lead_snapshot($id); }
}

/** First writer wins in the unique option_name index. A hold and a confirmation cannot coexist. */
function malendo_claim_confirmation(int $id, string $value): bool {
    global $wpdb;
    return malendo_checked_query($wpdb->query($wpdb->prepare(
        "INSERT IGNORE INTO {$wpdb->options} (option_name,option_value,autoload) VALUES (%s,%s,'no')",
        MALENDO_CONFIRM_PREFIX.$id, $value
    ))) === 1;
}

function malendo_publish_confirmation(int $id, string $prepared): bool {
    $digest = hash('sha256', $prepared);
    try {
        if (malendo_claim_confirmation($id, $digest)) { return true; }
    } catch (Malendo_Notification_DB_Error $e) { /* The INSERT may already have committed. */ }
    try {
        // Fence a late confirmation before reporting failure. Never undo a committed one.
        if (!malendo_claim_confirmation($id, 'hold')) {
            $winner = malendo_notification_option_raw(MALENDO_CONFIRM_PREFIX.$id);
            if ($winner === $digest) { return true; }
            if ($winner !== 'hold') { throw new Malendo_Confirmation_Unresolved(); }
        }
    } catch (Malendo_Notification_DB_Error $e) {
        throw new Malendo_Confirmation_Unresolved();
    }
    throw new Malendo_Notification_DB_Error('confirmation_held');
}

function malendo_lead_saved_marker(int $id, array $expected, ?array $activation, bool $qa, ?string $review=null): bool {
    $snapshot = malendo_form_snapshot($id);
    if (!is_array($snapshot)) { return false; }
    $existing = $snapshot['saved_v1'] ?? null;
    unset($snapshot['saved_v1']);
    if (count($snapshot) !== count(malendo_lead_fields()) || count($expected) !== count($snapshot)) { return false; }
    foreach ($expected as $key=>$value) {
        if (($snapshot[$key] ?? null) !== $value) { return false; }
    }
    if ($existing !== null) {
        // Idempotent read only. Never promote a legacy marker or another request's preparation.
        $stored = json_decode($existing,true);
        return ($stored['phase'] ?? null) === 'prepared' && ($stored['hash'] ?? null) === malendo_lead_fields_hash($expected)
            && malendo_notification_option_raw(MALENDO_CONFIRM_PREFIX.$id) === hash('sha256',$existing);
    }
    $candidate = $id > MALENDO_LAST_HISTORICAL_LEAD && !$qa;
    $marker = [
        'phase'=>'prepared', 'nonce'=>bin2hex(random_bytes(16)), 'hash'=>malendo_lead_fields_hash($expected),
        // A prepared marker never contains the old worker's eligible=true permission.
        'intent'=>$candidate && $activation !== null && $id > $activation['after_id'],
        'generation'=>$activation['generation'] ?? '', 'qa'=>$qa, 'saved_at'=>time(), 'service'=>$expected['service']
    ];
    if ($review !== null && $candidate) {
        $marker['intent'] = null;
        $marker['review'] = $review; // Never infer the generation of an in-flight submission later.
    }
    $raw = json_encode($marker, JSON_THROW_ON_ERROR);
    add_post_meta($id, '_malendo_saved_v1', wp_slash($raw), true);
    global $wpdb;
    if ($wpdb->last_error !== '') { throw new Malendo_Notification_DB_Error('marker_write_failed'); }
    $verified = malendo_form_snapshot($id);
    if (!is_array($verified) || ($verified['saved_v1'] ?? null) !== $raw) { return false; }
    unset($verified['saved_v1']);
    if (malendo_lead_fields_hash($verified) !== $marker['hash']) { return false; }
    return malendo_publish_confirmation($id, $raw);
}

/** Confirmed absence, damaged data and read failures have separate outcomes. */
function malendo_notification_decision(int $id): array {
    if ($id <= MALENDO_LAST_HISTORICAL_LEAD) { return ['state'=>'excluded']; }
    $fields = malendo_lead_snapshot($id);
    if ($fields === null || (is_array($fields) && !isset($fields['saved_v1']))) { return ['state'=>'excluded']; }
    $damaged = ['state'=>'attention', 'code'=>'saved_record_changed'];
    if ($fields === false) { return $damaged; }
    $prepared = $fields['saved_v1'];
    $marker = json_decode($prepared, true);
    unset($fields['saved_v1']);
    if (!is_array($marker) || !is_bool($marker['qa'] ?? null)) { return $damaged; }
    if ($marker['qa'] || ($marker['intent'] ?? null) === false) { return ['state'=>'excluded']; }
    if (($marker['phase'] ?? null) !== 'prepared') { return ['state'=>'excluded']; }
    $proof = malendo_notification_option_raw(MALENDO_CONFIRM_PREFIX.$id);
    if ($proof === null) { return ['state'=>'excluded']; }
    if ($proof === 'hold') { return ['state'=>'attention','code'=>'confirmation_held']; }
    if ($proof !== hash('sha256',$prepared)) { return $damaged; }
    if (in_array($marker['review'] ?? null, ['activation_read_unknown','activation_invalid'], true)) {
        return ['state'=>'attention', 'code'=>$marker['review']];
    }
    if (($marker['intent'] ?? null) !== true || !is_string($marker['hash'] ?? null)
        || !is_int($marker['saved_at'] ?? null) || count($fields) !== count(malendo_lead_fields())
        || !hash_equals($marker['hash'], malendo_lead_fields_hash($fields))
        || ($marker['service'] ?? null) !== $fields['service']) { return $damaged; }
    try { $activation = malendo_notification_activation(); }
    catch (Malendo_Notification_Activation_Invalid $e) { return ['state'=>'attention','code'=>'activation_invalid']; }
    if (!$activation || ($marker['generation'] ?? null) !== $activation['generation'] || $id <= $activation['after_id']) {
        return ['state'=>'attention','code'=>'generation_unproven'];
    }
    $marker['eligible'] = true; // Computed permission, never persisted on the preparation.
    return ['state'=>'ready', 'marker'=>$marker];
}

function malendo_notification_ready(int $id): ?array {
    return malendo_notification_decision($id)['marker'] ?? null;
}

function malendo_recover_notification(int $id): void {
    $decision = malendo_notification_decision($id);
    $queue = new Malendo_Outbox(new Malendo_WP_Outbox());
    if ($decision['state'] === 'ready' && !$queue->enqueue($id, $decision['marker'])) {
        throw new Malendo_Notification_DB_Error('notification_not_persisted');
    }
    if ($decision['state'] === 'attention') { $queue->recordAttention($id, $decision['code']); }
}
function malendo_queue_saved_lead(int $id): void {
    try { malendo_recover_notification($id); }
    catch (Throwable $e) { error_log('Malendo notification queue deferred; enquiry ID '.(int)$id); }
}
add_action('malendo_enquiry_saved','malendo_queue_saved_lead',20);

function malendo_notifications_reconcile(int $limit=50): void {
    global $wpdb;
    $ids = malendo_checked_query($wpdb->get_col($wpdb->prepare(
        "SELECT DISTINCT m.post_id FROM {$wpdb->postmeta} m JOIN {$wpdb->posts} p
         ON p.ID=m.post_id AND p.post_type='malendo_lead' AND p.post_status='private'
         JOIN {$wpdb->options} c ON c.option_name=CONCAT(%s,m.post_id) LEFT JOIN {$wpdb->options} o
         ON o.option_name=CONCAT(%s,m.post_id) WHERE m.post_id>%d AND m.meta_key='_malendo_saved_v1'
         AND (m.meta_value LIKE %s OR m.meta_value LIKE %s) AND o.option_id IS NULL
         ORDER BY m.post_id LIMIT %d", MALENDO_CONFIRM_PREFIX, Malendo_WP_Outbox::PREFIX, MALENDO_LAST_HISTORICAL_LEAD,
         '%"intent":true%', '%"review":%', max(1,min(50,$limit))
    )));
    foreach ($ids as $id) { malendo_recover_notification((int)$id); }
}
function malendo_notifications_worker(Malendo_Gmail_Transport $transport,int $limit=10): array {
    if (!$transport->enabled()) { return array('status'=>'disabled','processed'=>0); }
    global $wpdb;
    malendo_notifications_reconcile();
    // Query the top-level state, never historical log states. Future retries cannot starve due rows.
    $keys=$wpdb->get_col($wpdb->prepare("SELECT option_name FROM {$wpdb->options} WHERE option_name LIKE %s AND ((JSON_UNQUOTE(JSON_EXTRACT(option_value,'$.state')) IN ('pending','retry') AND CAST(JSON_UNQUOTE(JSON_EXTRACT(option_value,'$.next')) AS UNSIGNED)<=%d) OR (JSON_UNQUOTE(JSON_EXTRACT(option_value,'$.state')) IN ('claimed','sending') AND CAST(JSON_UNQUOTE(JSON_EXTRACT(option_value,'$.lease')) AS UNSIGNED)<=%d)) ORDER BY option_id LIMIT %d",
        $wpdb->esc_like(Malendo_WP_Outbox::PREFIX).'%', time(),time(),max(1,min(10,$limit))));
    malendo_checked_query($keys);
    $out=array(); $engine=new Malendo_Outbox(new Malendo_WP_Outbox()); $deadline=microtime(true)+40;
    foreach($keys as $key) {
        if(count($out)>=max(1,min(10,$limit)) || microtime(true)>$deadline){break;}
        $id=(int)substr($key,strlen(Malendo_WP_Outbox::PREFIX));
        $out[$id]=$engine->tick($id,$transport,static function($id,$job){$m=malendo_notification_ready($id);return $m && $m['generation']===$job['generation'] && $m['saved_at']===$job['saved_at'] && $m['service']===$job['service'];});
    }
    return array('status'=>'complete','results'=>$out);
}
function malendo_notification_owner(): bool {
    $configured = getenv('MALENDO_NOTIFICATION_OWNER_ID');
    return is_string($configured) && preg_match('/^[1-9][0-9]*$/D', $configured)
        && (string)get_current_user_id() === $configured && current_user_can('manage_options');
}

add_action('admin_menu',static function(): void {
    if (!malendo_notification_owner()) { return; }
    add_submenu_page('edit.php?post_type=malendo_lead','Notification status','Notifications','manage_options','malendo-notifications',static function(): void {
        if (!malendo_notification_owner()) { return; }
        global $wpdb;
        echo '<div class="wrap"><h1>Malendo notifications</h1><p>API accepted is not confirmed inbox delivery. Unknown delivery requires manual reconciliation; never replay automatically.</p>';
        try { $activation = malendo_notification_activation() ? 'configured' : 'off'; }
        catch (RuntimeException $e) { $activation = 'unverified; owner review required'; }
        echo '<p>Queue activation: '.$activation.'. Transport is CLI-only and disabled unless explicitly enabled. Verify the external timer separately.</p>';
        $heartbeat=get_option('malendo_notify_worker_v1',array());
        $recent=is_array($heartbeat) && ($heartbeat['time']??0)>=time()-300 && ($heartbeat['status']??'')==='complete';
        echo '<p><strong>'.($recent?'Worker heartbeat is recent.':'Worker heartbeat missing, stale or failed. Notifications may be stopped.').'</strong></p>';
        $page = max(1, min(1000000, (int)($_GET['notify_page'] ?? 1)));
        $rows = $wpdb->get_col($wpdb->prepare("SELECT option_value FROM {$wpdb->options} WHERE option_name LIKE %s
            ORDER BY option_id DESC LIMIT 101 OFFSET %d", $wpdb->esc_like(Malendo_WP_Outbox::PREFIX).'%', ($page-1)*100));
        if ($wpdb->last_error !== '') { echo '<p>Queue read failed. Check again.</p></div>'; return; }
        $more = count($rows) > 100;
        $rows = array_slice($rows, 0, 100);
        echo '<table><tr><th>ID</th><th>Status</th><th>Attempts</th><th>Code</th><th>Updated UTC</th></tr>';
        foreach($rows as $raw){$j=json_decode($raw,true);if(!is_array($j)){continue;}echo '<tr>';foreach(array($j['id'],$j['state'],$j['attempts'],$j['code'],gmdate('c',$j['updated'])) as $v){echo '<td>'.esc_html((string)$v).'</td>';}echo '</tr>';}
        echo '</table><p>Needs review and unknown delivery require manual reconciliation. Save failures are also shown on their enquiry record.</p>';
        if ($more) { echo '<a href="'.esc_url(add_query_arg('notify_page',$page+1)).'">Older entries</a>'; }
        echo '</div>';
    });
});
add_action('add_meta_boxes_malendo_lead',static function(): void {
    if (!malendo_notification_owner()) { return; }
    add_meta_box('malendo_save_status','Save / notification status',static function($post): void {
        if (!malendo_notification_owner()) { return; }
        $error=get_post_meta($post->ID,'_malendo_save_error',true);
        $marker=get_post_meta($post->ID,'_malendo_saved_v1',true);
        try {
            $confirmed = is_string($marker) && $marker !== '' && malendo_notification_option_raw(MALENDO_CONFIRM_PREFIX.(int)$post->ID) === hash('sha256',$marker);
        } catch (Malendo_Notification_DB_Error $e) { $confirmed = false; }
        echo '<p>'.esc_html($error ? 'Incomplete save: '.$error : ($confirmed ? 'Completion marker recorded and confirmed.' : 'Completion unverified: legacy or interrupted record; owner review required.')).'</p>';
        try{$s=(new Malendo_WP_Outbox())->read((int)$post->ID);echo '<p>'.esc_html($s ? $s['job']['state'].' / '.$s['job']['code'] : 'No notification queue entry.').'</p>';}
        catch(Throwable $e){echo '<p>Outbox read failed; owner review required.</p>';}
    },'malendo_lead','side','high');
});
