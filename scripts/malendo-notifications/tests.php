<?php
/** Synthetic-only: no WordPress bootstrap, DB connection, curl or real HTTP. */
declare(strict_types=1);
define('ABSPATH',__DIR__.'/synthetic-webroot/');
ob_start();
$GLOBALS['actions']=array(); $GLOBALS['shortcodes']=array();
function add_action($hook,$callback,$priority=10,$args=1){$GLOBALS['actions'][$hook][$priority][]=$callback;}
function add_filter(...$args){}
function add_shortcode($name,$callback){$GLOBALS['shortcodes'][$name]=$callback;}
function do_action($hook,...$args){$a=$GLOBALS['actions'][$hook]??array();ksort($a);foreach($a as $callbacks){foreach($callbacks as $f){$f(...$args);}}}
function get_option($name,$default=false){return $GLOBALS['options'][$name]??$default;}
function get_post_meta($id,$key,$single=true){return $GLOBALS['meta'][$id][$key]??'';}
function metadata_exists($type,$id,$key){return array_key_exists($key,$GLOBALS['meta'][$id]??array());}
function update_post_meta($id,$key,$value){if($key===($GLOBALS['fail_meta']??'')){return false;}$value=is_string($value)?stripslashes($value):$value;$same=metadata_exists('post',$id,$key)&&$GLOBALS['meta'][$id][$key]===$value;$GLOBALS['meta'][$id][$key]=$value;return !$same;}
function wp_slash($s){return addslashes($s);}
function wp_cache_delete(...$args){}
function get_post_type($id){return $GLOBALS['posts'][$id]['post_type']??false;}
function get_post_status($id){return $GLOBALS['posts'][$id]['post_status']??false;}
function wp_insert_post($post,$error){if(!empty($GLOBALS['insert_fail'])){return 0;}$id=++$GLOBALS['last_id'];$GLOBALS['posts'][$id]=$post;return $id;}
function wp_unslash($s){return stripslashes($s);}
function sanitize_text_field($s){return trim(strip_tags($s));}
function sanitize_textarea_field($s){return trim(strip_tags($s));}
function wp_verify_nonce($s,$action){return $s==='valid';}
function is_email($s){return filter_var($s,FILTER_VALIDATE_EMAIL)!==false;}
function is_wp_error($s){return false;}
function current_time($format,$gmt=false){return $format==='mysql'?'2026-11-04 01:00:00':'2026-11-04 08:00';}
function home_url($path='/'){return 'https://malendo-property.com'.$path;}
function wp_salt($which){return 'synthetic-salt';}
function get_transient($key){return false;}
function set_transient(...$args){}
function malendo_translation_id($id){return 0;}
function current_user_can(...$args){return false;}
function add_query_arg($key,$value,$url){return $url.'?'.$key.'='.$value;}
class FormRedirect extends RuntimeException {}
function wp_safe_redirect($url,$status){throw new FormRedirect($url);}
function status_header($code){}
function wp_get_environment_type(){return 'production';}
function is_user_logged_in(){return $GLOBALS['admin']??false;}
function is_preview(){return $GLOBALS['preview']??false;}
function is_page($ids){return true;}
function nocache_headers(){}
if(!function_exists('mb_substr')){function mb_substr($s,$start,$len){return substr($s,$start,$len);}}
if(!function_exists('mb_strlen')){function mb_strlen($s){return strlen($s);}}

// A deliberately limited wpdb fake: checks adapter parameters, never executes SQL.
final class FakeWPDB {
    public $options='test_options'; public $postmeta='test_postmeta'; public $posts='test_posts'; public $last_error=''; public $outbox=array(); public $sql=array();
    function prepare($sql,...$args){return array($sql,$args);}
    function esc_like($s){return addcslashes($s,'_%\\');}
    function get_var($q){[$sql,$a]=$q;$this->sql[]=$sql;
        if(str_contains($sql,'option_value')){return $this->outbox[$a[0]]??null;}
        foreach($GLOBALS['meta'] as $id=>$m){if(($m['_malendo_analytics_receipt']??'')===$a[0]){return $id;}}return null;
    }
    function query($q){[$sql,$a]=$q;$this->sql[]=$sql;
        if(str_starts_with($sql,'INSERT IGNORE')){if(isset($this->outbox[$a[0]])){return 0;}$this->outbox[$a[0]]=$a[1];return 1;}
        if(str_contains($sql,'BINARY option_value')){if(($this->outbox[$a[1]]??null)!==$a[2]){return 0;}$this->outbox[$a[1]]=$a[0];return 1;}
        if(str_contains($sql,"SET meta_value = 'consumed'")){[$id,$hash]=$a;if(($GLOBALS['meta'][$id]['_malendo_analytics_receipt']??null)!==$hash){return 0;}$GLOBALS['meta'][$id]['_malendo_analytics_receipt']='consumed';return 1;}
        throw new RuntimeException('Unexpected synthetic SQL');
    }
    function get_col($q){[$sql,$a]=$q;$this->sql[]=$sql;
        if(str_contains($sql,'SELECT DISTINCT m.post_id')){
            $ids=array();foreach($GLOBALS['meta'] as $id=>$m){$ready=json_decode($m['_malendo_saved_v1']??'null',true);if(!empty($ready['eligible'])&&!isset($this->outbox[Malendo_WP_Outbox::PREFIX.$id])){$ids[]=$id;}}return array_slice($ids,0,50);
        }
        if(str_contains($sql,'JSON_EXTRACT')){
            $keys=array();foreach($this->outbox as $key=>$raw){$j=json_decode($raw,true);if((in_array($j['state'],array('pending','retry'),true)&&$j['next']<=$a[1])||(in_array($j['state'],array('claimed','sending'),true)&&$j['lease']<=$a[2])){$keys[]=$key;}}return array_slice($keys,0,$a[3]);
        }
        throw new RuntimeException('Unexpected synthetic query');
    }
}
$theme=dirname(__DIR__,2).'/wp-content/themes/malendo-recovery/';
require $theme.'inc-notifications.php';
require $theme.'inc-leads.php';
require $theme.'inc-analytics.php';

final class MemoryOutbox implements Malendo_Outbox_Store {
    public $rows=array();
    function read(int $id):?array{if(!isset($this->rows[$id])){return null;}return array('raw'=>$this->rows[$id],'job'=>json_decode($this->rows[$id],true));}
    function insert(int $id,array $j):bool{if(isset($this->rows[$id])){return false;}$this->rows[$id]=json_encode($j,JSON_THROW_ON_ERROR);return true;}
    function replace(int $id,string $old,array $j):bool{if(($this->rows[$id]??null)!==$old){return false;}$this->rows[$id]=json_encode($j,JSON_THROW_ON_ERROR);return true;}
}
final class FileOutbox implements Malendo_Outbox_Store {
    private $path;
    function __construct(string $path){$this->path=$path;}
    private function access(callable $f){$h=fopen($this->path,'c+');flock($h,LOCK_EX);$raw=stream_get_contents($h);$rows=$raw===''?array():json_decode($raw,true,512,JSON_THROW_ON_ERROR);$result=$f($rows);rewind($h);ftruncate($h,0);fwrite($h,json_encode($rows,JSON_THROW_ON_ERROR));fflush($h);flock($h,LOCK_UN);fclose($h);return $result;}
    function read(int $id):?array{return $this->access(static function(&$rows)use($id){return isset($rows[$id])?array('raw'=>$rows[$id],'job'=>json_decode($rows[$id],true)):null;});}
    function insert(int $id,array $j):bool{return $this->access(static function(&$rows)use($id,$j){if(isset($rows[$id])){return false;}$rows[$id]=json_encode($j,JSON_THROW_ON_ERROR);return true;});}
    function replace(int $id,string $old,array $j):bool{return $this->access(static function(&$rows)use($id,$old,$j){if(($rows[$id]??null)!==$old){return false;}$rows[$id]=json_encode($j,JSON_THROW_ON_ERROR);return true;});}
}
function check($value,$message='assertion'){if(!$value){throw new RuntimeException($message);}}
function reset_form():void{
    $GLOBALS['meta']=array();$GLOBALS['posts']=array();$GLOBALS['last_id']=100;$GLOBALS['fail_meta']='';$GLOBALS['insert_fail']=false;
    $GLOBALS['options']=array('malendo_notify_activation_v1'=>array('after_id'=>100,'generation'=>str_repeat('a',32)));
    $GLOBALS['wpdb']=new FakeWPDB();$GLOBALS['admin']=false;$GLOBALS['preview']=false;unset($GLOBALS['malendo_saved_enquiry_event']);
    $_GET=array();$_COOKIE=array('malendo_analytics_choice'=>'allow');$_SERVER['REQUEST_METHOD']='POST';$_SERVER['REMOTE_ADDR']='192.0.2.1';
    $_POST=array('_malendo_nonce'=>'valid','consent'=>'yes','full_name'=>'SYNTHETIC PERSON','email'=>'fixture@example.invalid','phone'=>'','message'=>'Synthetic enquiry only.','service'=>'Rental');
}
function submit():string{try{malendo_recovery_receive_lead();}catch(FormRedirect $r){return $r->getMessage();}throw new RuntimeException('Missing redirect');}
function ready():array{return array('eligible'=>true,'qa'=>false,'generation'=>str_repeat('a',32),'saved_at'=>1793725200,'service'=>'Rental');}
function fake_credentials():array{return array('client_id'=>'synthetic','client_secret'=>'fixture-secret','refresh_token'=>'fixture-refresh','sender'=>Malendo_Gmail_Transport::SENDER);}
function response(int $status,array $body,array $extra=array()):array{return $extra+array('status'=>$status,'body'=>json_encode($body));}
function token_response():array{return response(200,array('access_token'=>'synthetic-token','token_type'=>'Bearer','scope'=>Malendo_Gmail_Transport::SCOPE));}
function transport(array &$calls,array $responses,bool $enabled=true):Malendo_Gmail_Transport{
    return new Malendo_Gmail_Transport($enabled,'fake_credentials',static function($url,$headers,$body)use(&$calls,&$responses){$calls[]=array($url,$headers,$body);check(count($responses)>0,'unexpected HTTP');return array_shift($responses);});
}
$tests=array();
$tests['form_success_one_queue_and_receipt']=static function(){reset_form();check(str_contains(submit(),'submitted=1'));check(count($GLOBALS['wpdb']->outbox)===1);check(metadata_exists('post',101,'_malendo_analytics_receipt'));};
foreach(array_merge(malendo_lead_fields(),array('saved_v1')) as $field){
    $tests['save_failure_'.$field]=static function()use($field){reset_form();$GLOBALS['fail_meta']='_malendo_'.$field;check(str_contains(submit(),'form_error=server'));check(count($GLOBALS['posts'])===1,'partial record deleted');check(!$GLOBALS['wpdb']->outbox);check(!metadata_exists('post',101,'_malendo_analytics_receipt'));};
}
$tests['unchanged_meta_false_is_not_failure']=static function(){reset_form();submit();$f=array();foreach(malendo_lead_fields() as $k){$f[$k]=get_post_meta(101,'_malendo_'.$k,true);check(update_post_meta(101,'_malendo_'.$k,$f[$k])===false);}check(malendo_lead_saved_marker(101,$f,malendo_notification_activation(),false));};
foreach(array('nonce','honeypot','consent','email','required') as $case){$tests['form_reject_'.$case]=static function()use($case){reset_form();switch($case){case 'nonce':$_POST['_malendo_nonce']='bad';break;case 'honeypot':$_POST['website']='bot';break;case 'consent':unset($_POST['consent']);break;case 'email':$_POST['email']='bad';break;case 'required':$_POST['message']='tiny';}check(str_contains(submit(),'form_error='));check(!$GLOBALS['wpdb']->outbox&&!$GLOBALS['posts']);};}
$tests['insert_failure_no_success']=static function(){reset_form();$GLOBALS['insert_fail']=true;check(str_contains(submit(),'form_error=server'));check(!$GLOBALS['wpdb']->outbox);};
foreach(array('no',array('yes')) as $i=>$consent){$tests['reject_invalid_consent_'.$i]=static function()use($consent){reset_form();$_POST['consent']=$consent;check(str_contains(submit(),'form_error=consent'));check(!$GLOBALS['posts']&&!$GLOBALS['wpdb']->outbox);};}
$tests['form_preserves_backslashes_and_quotes']=static function(){reset_form();$text='Synthetic C:\\folder\\unit "quoted" message';$_POST['message']=wp_slash($text);check(str_contains(submit(),'submitted=1'));check(get_post_meta(101,'_malendo_message',true)===$text);};
$tests['duplicate_hook_unique_job']=static function(){reset_form();submit();$before=$GLOBALS['wpdb']->outbox;do_action('malendo_enquiry_saved',101);check(count($GLOBALS['wpdb']->outbox)===1);check($GLOBALS['wpdb']->outbox===$before);};
$tests['consent_deny_still_queues_no_analytics']=static function(){reset_form();$_COOKIE['malendo_analytics_choice']='deny';check(str_contains(submit(),'submitted=1'));check(count($GLOBALS['wpdb']->outbox)===1);check(!metadata_exists('post',101,'_malendo_analytics_receipt'));};
$tests['qa_saved_without_queue_or_analytics']=static function(){reset_form();$_POST['_malendo_qa']='1';submit();check(!$GLOBALS['wpdb']->outbox);check(!metadata_exists('post',101,'_malendo_analytics_receipt'));};
foreach(array('admin','preview') as $flag){$tests['analytics_excludes_'.$flag]=static function()use($flag){reset_form();$GLOBALS[$flag]=true;submit();check(!metadata_exists('post',101,'_malendo_analytics_receipt'));};}
$tests['activation_off_no_backfill']=static function(){reset_form();$GLOBALS['options']=array();submit();check(!$GLOBALS['wpdb']->outbox);$GLOBALS['options']['malendo_notify_activation_v1']=array('after_id'=>100,'generation'=>str_repeat('b',32));malendo_notifications_reconcile();check(!$GLOBALS['wpdb']->outbox);};
$tests['historical_52_56_untouched']=static function(){reset_form();foreach(array(52,56) as $id){$GLOBALS['posts'][$id]=array('post_type'=>'malendo_lead','post_status'=>'private');$GLOBALS['meta'][$id]=array('synthetic_protected'=>'unchanged');}$before=$GLOBALS['meta'];malendo_queue_saved_lead(52);malendo_queue_saved_lead(56);malendo_notifications_reconcile();check($before===$GLOBALS['meta']&&!$GLOBALS['wpdb']->outbox);};
$tests['save_enqueue_gap_reconciles_once']=static function(){reset_form();submit();$GLOBALS['wpdb']->outbox=array();malendo_notifications_reconcile();check(count($GLOBALS['wpdb']->outbox)===1);$before=$GLOBALS['wpdb']->outbox;malendo_notifications_reconcile();check($before===$GLOBALS['wpdb']->outbox);};
$tests['changed_saved_field_stops']=static function(){reset_form();submit();$GLOBALS['meta'][101]['_malendo_service']='Other';check(malendo_notification_ready(101)===null);$calls=array();$t=transport($calls,array());$e=new Malendo_Outbox(new Malendo_WP_Outbox());check($e->tick(101,$t,static fn($id,$j)=>malendo_notification_ready($id)!==null)==='failed');check(!$calls);};
$tests['analytics_receipt_atomic_one_event_and_forgery']=static function(){reset_form();submit();unset($GLOBALS['malendo_saved_enquiry_event']);$_COOKIE['malendo_lead_receipt']=str_repeat('c',64);$GLOBALS['meta'][101]['_malendo_analytics_receipt']=hash('sha256',$_COOKIE['malendo_lead_receipt']);$GLOBALS['meta'][101]['_malendo_analytics_expires']=time()+300;do_action('template_redirect');check(($GLOBALS['malendo_saved_enquiry_event']['service']??'')==='rental');unset($GLOBALS['malendo_saved_enquiry_event']);do_action('template_redirect');check(!isset($GLOBALS['malendo_saved_enquiry_event']));$_GET['submitted']='1';$_COOKIE['malendo_lead_receipt']=str_repeat('d',64);do_action('template_redirect');check(!isset($GLOBALS['malendo_saved_enquiry_event']));};
$tests['disabled_zero_requests_and_credential_reads']=static function(){$s=new MemoryOutbox();$e=new Malendo_Outbox($s);$e->enqueue(101,ready());$before=$s->rows;$t=new Malendo_Gmail_Transport(false,static function(){throw new RuntimeException('credentials read');},static function(){throw new RuntimeException('network');});check($e->tick(101,$t,static fn()=>true)==='disabled');check($s->rows===$before);};
foreach(array(429,503) as $status){$tests['bounded_retry_'.$status]=static function()use($status){$now=time();$s=new MemoryOutbox();$e=new Malendo_Outbox($s,static function()use(&$now){return $now;},static fn()=>0);$e->enqueue(101,ready());$calls=array();$responses=array();for($i=0;$i<5;$i++){array_push($responses,token_response(),response($status,array('error'=>array('code'=>$status)),array('retry_after'=>'600')));}$t=transport($calls,$responses);for($i=1;$i<=5;$i++){check($e->tick(101,$t,static fn()=>true)===($i===5?'failed':'retry'));if($i<5){$j=$s->read(101)['job'];check($j['next']>=$now+600);$count=count($calls);$e->tick(101,$t,static fn()=>true);check(count($calls)===$count);$now=$j['next'];}}check(count($calls)===10);};}
$tests['timeout_unknown_no_replay']=static function(){$s=new MemoryOutbox();$e=new Malendo_Outbox($s);$e->enqueue(101,ready());$calls=array();$t=transport($calls,array(token_response(),array('status'=>0,'body'=>'','before_send'=>false)));check($e->tick(101,$t,static fn()=>true)==='unknown_delivery');check($e->tick(101,$t,static fn()=>true)==='unknown_delivery');check(count($calls)===2);};
$tests['connect_failure_before_upload_retry']=static function(){$s=new MemoryOutbox();$e=new Malendo_Outbox($s);$e->enqueue(101,ready());$calls=array();$t=transport($calls,array(token_response(),array('status'=>0,'body'=>'','before_send'=>true)));check($e->tick(101,$t,static fn()=>true)==='retry');};
foreach(array('invalid_grant','wide_scope','missing_scope') as $case){$tests['reauth_'.$case]=static function()use($case){$s=new MemoryOutbox();$e=new Malendo_Outbox($s);$e->enqueue(101,ready());$calls=array();$r=token_response();if($case==='invalid_grant'){$r=response(400,array('error'=>'invalid_grant'));}else{$r=response(200,array('access_token'=>'synthetic','token_type'=>'Bearer','scope'=>$case==='wide_scope'?Malendo_Gmail_Transport::SCOPE.' https://mail.google.com/':''));}$t=transport($calls,array($r));check($e->tick(101,$t,static fn()=>true)==='needs_reauth');check(count($calls)===1);};}
$tests['one_401_refresh_then_accepted']=static function(){$s=new MemoryOutbox();$e=new Malendo_Outbox($s);$e->enqueue(101,ready());$calls=array();$t=transport($calls,array(token_response(),response(401,array()),token_response(),response(200,array('id'=>'synthetic-id'))));check($e->tick(101,$t,static fn()=>true)==='accepted');check(count($calls)===4);check($e->tick(101,$t,static fn()=>true)==='accepted');check(count($calls)===4);check($s->read(101)['job']['message_id']==='synthetic-id');};
$tests['repeated_401_stops']=static function(){$s=new MemoryOutbox();$e=new Malendo_Outbox($s);$e->enqueue(101,ready());$calls=array();$t=transport($calls,array(token_response(),response(401,array()),token_response(),response(401,array())));check($e->tick(101,$t,static fn()=>true)==='needs_reauth');check(count($calls)===4);};
$tests['permission_403_needs_reauth']=static function(){$s=new MemoryOutbox();$e=new Malendo_Outbox($s);$e->enqueue(101,ready());$calls=array();$t=transport($calls,array(token_response(),response(403,array('error'=>array('code'=>403)))));check($e->tick(101,$t,static fn()=>true)==='needs_reauth');};
foreach(array(200,502,504) as $status){$tests['ambiguous_response_'.$status]=static function()use($status){$s=new MemoryOutbox();$e=new Malendo_Outbox($s);$e->enqueue(101,ready());$calls=array();$t=transport($calls,array(token_response(),response($status,array())));check($e->tick(101,$t,static fn()=>true)==='unknown_delivery');};}
$tests['message_headers_privacy_and_injection']=static function(){$j=ready()+array('id'=>101);$mime=Malendo_Gmail_Transport::mime($j);check(str_contains($mime,"From: malendophuket@gmail.com\r\nTo: acrabash@gmail.com\r\n"));check(!preg_match('/\r\n(?:Cc|Bcc):/i',$mime));preg_match('/Subject: =\?UTF-8\?B\?([^?]+)/',$mime,$m);check(base64_decode($m[1])==='Malendo — New enquiry #101');$body=base64_decode(explode("\r\n\r\n",$mime,2)[1]);check(str_contains($body,'Asia/Bangkok')&&str_contains($body,'post=101&action=edit'));check(!str_contains($body,'fixture@example.invalid')&&!str_contains($body,'SYNTHETIC PERSON'));$j['service']="Rental\r\nBcc: injected@example.invalid";try{Malendo_Gmail_Transport::mime($j);throw new LogicException('injection accepted');}catch(RuntimeException $e){check($e->getMessage()==='message_invalid');}};
$tests['wpdb_cas_fences_stale_revision']=static function(){reset_form();$s=new Malendo_WP_Outbox();$e=new Malendo_Outbox($s);$e->enqueue(101,ready());$old=$s->read(101);$j=$old['job'];$j['state']='claimed';check($s->replace(101,$old['raw'],$j));check(!$s->replace(101,$old['raw'],$old['job']));check(str_contains(implode('\n',$GLOBALS['wpdb']->sql),'BINARY option_value=BINARY %s'));};
$tests['reconcile_damaged_marker_blocks_without_starvation']=static function(){reset_form();submit();$GLOBALS['wpdb']->outbox=array();$GLOBALS['meta'][101]['_malendo_message']='changed';malendo_notifications_reconcile();$row=(new Malendo_WP_Outbox())->read(101);check($row['job']['state']==='failed');check($row['job']['code']==='saved_record_changed');};
$tests['logs_exclude_credentials_and_client_data']=static function(){reset_form();submit();$calls=array();$t=transport($calls,array(token_response(),response(200,array('id'=>'synthetic-id'))));$e=new Malendo_Outbox(new Malendo_WP_Outbox());check($e->tick(101,$t,static fn()=>true)==='accepted');$raw=implode('', $GLOBALS['wpdb']->outbox);foreach(array('synthetic-token','fixture-secret','fixture-refresh','fixture@example.invalid','SYNTHETIC PERSON')as $secret){check(!str_contains($raw,$secret));}};
$tests['future_retry_and_terminal_logs_do_not_starve_due']=static function(){reset_form();$s=new Malendo_WP_Outbox();$e=new Malendo_Outbox($s);for($id=101;$id<112;$id++){$e->enqueue($id,ready());$r=$s->read($id);$j=$r['job'];$j['state']='retry';$j['next']=time()+3600;$s->replace($id,$r['raw'],$j);} $e->enqueue(112,ready());$calls=array();$t=transport($calls,array());$r=malendo_notifications_worker($t,1);check(isset($r['results'][112])&&count($r['results'])===1);check(!$calls);};
$tests['unknown_on_acceptance_persistence_failure']=static function(){$s=new class implements Malendo_Outbox_Store{public $inner;function __construct(){$this->inner=new MemoryOutbox();}function read(int $id):?array{return $this->inner->read($id);}function insert(int $id,array $j):bool{return $this->inner->insert($id,$j);}function replace(int $id,string $old,array $j):bool{return $j['state']==='accepted'?false:$this->inner->replace($id,$old,$j);}};$now=time();$e=new Malendo_Outbox($s,static function()use(&$now){return $now;});$e->enqueue(101,ready());$calls=array();$t=transport($calls,array(token_response(),response(200,array('id'=>'accepted-but-not-persisted'))));check($e->tick(101,$t,static fn()=>true)==='busy');$now+=181;check($e->tick(101,$t,static fn()=>true)==='unknown_delivery');check(count($calls)===2);};
$tests['expired_lease_fences_old_worker']=static function(){$now=time();$s=new MemoryOutbox();$e=new Malendo_Outbox($s,static function()use(&$now){return $now;});$e->enqueue(101,ready());$calls=array();$second=transport($calls,array(token_response(),response(200,array('id'=>'winner'))));$old=new Malendo_Gmail_Transport(true,'fake_credentials',static function($url)use(&$now,$e,$second){check(str_contains($url,'oauth2'));$now+=181;check($e->tick(101,$second,static fn()=>true)==='accepted');return token_response();});check($e->tick(101,$old,static fn()=>true)==='busy');check(count($calls)===2);};
function isolated_files():array{$root=getenv('MALENDO_TEST_TMP');check(is_string($root)&&is_dir($root),'test temp required');$key=bin2hex(random_bytes(6));return array($root.'/'.$key.'.json',$root.'/'.$key.'.sends');}
function count_send(string $file):void{$h=fopen($file,'a');flock($h,LOCK_EX);fwrite($h,"send\n");fflush($h);flock($h,LOCK_UN);fclose($h);}
$tests['two_process_workers_one_send']=static function(){check(function_exists('pcntl_fork'),'pcntl required, cannot claim PASS');[$file,$counter]=isolated_files();$s=new FileOutbox($file);(new Malendo_Outbox($s))->enqueue(101,ready());$children=array();for($i=0;$i<2;$i++){$pid=pcntl_fork();check($pid>=0);if($pid===0){$t=new Malendo_Gmail_Transport(true,'fake_credentials',static function($url)use($counter){usleep(100000);if(str_contains($url,'oauth2')){return token_response();}count_send($counter);return response(200,array('id'=>'winner'));});(new Malendo_Outbox(new FileOutbox($file)))->tick(101,$t,static fn()=>true);exit(0);}$children[]=$pid;}foreach($children as $pid){pcntl_waitpid($pid,$status);check(pcntl_wexitstatus($status)===0);}check(count(file($counter))===1);check($s->read(101)['job']['state']==='accepted');};
foreach(array('before_send','after_send') as $stage){$tests['process_crash_'.$stage]=static function()use($stage){check(function_exists('pcntl_fork'));[$file,$counter]=isolated_files();$now=time();$s=new FileOutbox($file);(new Malendo_Outbox($s))->enqueue(101,ready());$pid=pcntl_fork();check($pid>=0);if($pid===0){$credentials=$stage==='before_send'?static function(){exit(77);}:'fake_credentials';$t=new Malendo_Gmail_Transport(true,$credentials,static function($url)use($counter){if(str_contains($url,'oauth2')){return token_response();}count_send($counter);exit(77);});(new Malendo_Outbox(new FileOutbox($file)))->tick(101,$t,static fn()=>true);exit(99);}pcntl_waitpid($pid,$status);check(pcntl_wexitstatus($status)===77);$e=new Malendo_Outbox($s,static fn()=>$now+181);$calls=array();$t=transport($calls,array(token_response(),response(200,array('id'=>'resumed'))));check($e->tick(101,$t,static fn()=>true)===($stage==='after_send'?'unknown_delivery':'accepted'));check(count($calls)===($stage==='after_send'?0:2));if($stage==='after_send'){check(count(file($counter))===1);}};}
$tests['sigterm_after_send_no_replay']=static function(){
    check(function_exists('pcntl_fork'));[$file,$counter]=isolated_files();$now=time();$s=new FileOutbox($file);(new Malendo_Outbox($s))->enqueue(101,ready());
    $pid=pcntl_fork();check($pid>=0);
    if($pid===0){$t=new Malendo_Gmail_Transport(true,'fake_credentials',static function($url)use($counter){if(str_contains($url,'oauth2')){return token_response();}count_send($counter);sleep(10);return response(200,array('id'=>'never-recorded'));});(new Malendo_Outbox(new FileOutbox($file)))->tick(101,$t,static fn()=>true);exit(99);}
    $until=microtime(true)+3;while(!is_file($counter)&&microtime(true)<$until){usleep(10000);}
    check(is_file($counter),'send marker not reached');
    // Signal only the synthetic child created above.
    if(!function_exists('posix_kill')){pcntl_waitpid($pid,$status);throw new RuntimeException('posix_kill unavailable: SIGTERM NOT RUN');}
    posix_kill($pid,SIGTERM);pcntl_waitpid($pid,$status);check(pcntl_wifsignaled($status)&&pcntl_wtermsig($status)===SIGTERM);
    $calls=array();$t=transport($calls,array());$e=new Malendo_Outbox($s,static fn()=>$now+181);check($e->tick(101,$t,static fn()=>true)==='unknown_delivery');check(!$calls&&count(file($counter))===1);
};
$tests['oauth_retry_after_respected']=static function(){$now=time();$s=new MemoryOutbox();$e=new Malendo_Outbox($s);$e->enqueue(101,ready());$calls=array();$t=transport($calls,array(response(429,array(),array('retry_after'=>'3600'))));check($e->tick(101,$t,static fn()=>true)==='retry');check($s->read(101)['job']['next']>=$now+3600);check(count($calls)===1);};

$results=array();foreach($tests as $name=>$test){try{$test();$results[$name]='PASS';}catch(Throwable $e){$results[$name]='FAIL: '.$e->getMessage();}}
ob_end_clean();
echo json_encode(array('php'=>PHP_VERSION,'tests'=>$results,'passed'=>count(array_filter($results,static fn($r)=>$r==='PASS')),'total'=>count($results),
    'isolation'=>'Synthetic stubs + file CAS, no native WordPress/MySQL; no HTTP transport invoked'),JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES)."\n";
exit(count(array_filter($results,static fn($r)=>$r!=='PASS'))?1:0);
