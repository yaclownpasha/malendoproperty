<?php
/** Synthetic-only: no WordPress bootstrap, DB connection, curl or real HTTP. */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
define('ABSPATH',__DIR__.'/synthetic-webroot/');
if (getenv('MALENDO_TEST_WPDB_CORE')) {
    require getenv('MALENDO_TEST_WPDB_CORE');
    class QA_Core_Logger extends wpdb {
        public function __construct() {}
        public function get_caller() { return 'synthetic_meta_fault'; }
    }
}
if (!defined('ARRAY_A')) { define('ARRAY_A', 'ARRAY_A'); }
function is_serialized($v) { return is_string($v) && preg_match('/^[asOibd]:|^N;$/D',$v); }
ob_start();
$GLOBALS['actions']=array(); $GLOBALS['shortcodes']=array();
function add_action($hook,$callback,$priority=10,$args=1){$GLOBALS['actions'][$hook][$priority][]=$callback;}
function add_filter(...$args){}
function add_shortcode($name,$callback){$GLOBALS['shortcodes'][$name]=$callback;}
function do_action($hook,...$args){$a=$GLOBALS['actions'][$hook]??array();ksort($a);foreach($a as $callbacks){foreach($callbacks as $f){$f(...$args);}}}
function get_option($name,$default=false){return $GLOBALS['options'][$name]??$default;}
function get_post_meta($id,$key,$single=true){return $GLOBALS['meta'][$id][$key]??'';}
function metadata_exists($type,$id,$key){return array_key_exists($key,$GLOBALS['meta'][$id]??array());}
function update_post_meta($id,$key,$value){$db=$GLOBALS['wpdb'];$db->last_error='';
    if($key===($GLOBALS['fail_meta']??'')){
        if (!empty($GLOBALS['sql_canary'])) { $db->metaError($value); }
        return false;
    }$value=is_string($value)?stripslashes($value):$value;$same=metadata_exists('post',$id,$key)&&$GLOBALS['meta'][$id][$key]===$value;$GLOBALS['meta'][$id][$key]=$value;return !$same;}
function wp_slash($s){return addslashes($s);}
function add_post_meta($id,$key,$value,$unique=false){
    if($unique && metadata_exists('post',$id,$key)){return false;}
    return update_post_meta($id,$key,$value);
}
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
function current_user_can(...$args){return $args===['manage_options'] && !empty($GLOBALS['can_manage']);}
function get_current_user_id(){return $GLOBALS['user_id']??0;}
function add_submenu_page($parent,$title,$menu,$cap,$slug,$cb){$GLOBALS['queue_page']=$cb;}
function add_meta_box($id,$title,$cb,...$rest){$GLOBALS['boxes'][$id]=$cb;}
function esc_html($s){return htmlspecialchars((string)$s);}
function esc_url($s){return htmlspecialchars((string)$s);}
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
    public $onMarkerRead; public $onConfirmation; public $proofs=[];
    public $faults=[]; public $suppressed=false; public $queries=[]; public $logger;
    function __construct(){if(class_exists('QA_Core_Logger')){$this->logger=new QA_Core_Logger();}}
    function suppress_errors($new=true){
        $old=$this->suppressed;$this->suppressed=$new;
        if($this->logger){$this->logger->suppress_errors($new);}return $old;
    }
    function metaError($value){
        $this->last_error='synthetic_sql_error';$query='INSERT INTO fixture VALUES ('.$value.')';
        $this->queries[]=[$query];
        if ($this->logger) {$this->logger->last_query=$query;$this->logger->print_error('injected error');}
        else {$GLOBALS['EZSQL_ERROR'][]=['query'=>$query];if(!$this->suppressed){error_log($query);}}
        if(!empty($GLOBALS['throw_write'])){throw new RuntimeException('write_exception');}
    }
    function readFault($key){
        $this->last_error='';
        if(($this->faults[$key]??0)<1){return false;}
        $this->faults[$key]--;$this->last_error='transient_failure';return true;
    }
    function get_results($q,$mode){
        [$sql,$args]=$q;$id=array_pop($args);
        if(!str_contains($sql,'p.post_type,p.post_status,m.meta_key,m.meta_value')){throw new RuntimeException('unexpected snapshot');}
        if($this->onMarkerRead && isset($GLOBALS['meta'][$id]['_malendo_saved_v1'])){($this->onMarkerRead)();return [];}
        if($this->readFault('snapshot')){return [];}
        if(isset($GLOBALS['meta'][$id]['_malendo_saved_v1']) && $this->readFault('marker_snapshot')){return [];}
        if(!isset($GLOBALS['posts'][$id])){return [];}
        $post=$GLOBALS['posts'][$id];$result=[];
        foreach($args as $key){if(array_key_exists($key,$GLOBALS['meta'][$id]??[])){
            $v=$GLOBALS['meta'][$id][$key];$result[]=$post+['meta_key'=>$key,'meta_value'=>is_serialized($v)?serialize($v):$v];
        }}
        return $result?:[$post+['meta_key'=>null,'meta_value'=>null]];
    }
    function prepare($sql,...$args){return array($sql,$args);}
    function esc_like($s){return addcslashes($s,'_%\\');}
    function get_row($q,$mode){
        $value=$this->get_var($q);
        return $value===null?null:['option_value'=>$value];
    }
    function get_var($q){[$sql,$a]=$q;$this->sql[]=$sql;
        if(str_contains($sql,'option_value')){
            if(str_starts_with($a[0],MALENDO_CONFIRM_PREFIX)){
                if($this->readFault('proof_read')){return null;}
                return $this->proofs[$a[0]]??null;
            }
            if($a[0]==='malendo_notify_activation_v1'){
                if($this->readFault('activation')){return null;}
                if(isset($GLOBALS['activation_raw'])){return $GLOBALS['activation_raw'];}
                return isset($GLOBALS['options'][$a[0]])?serialize($GLOBALS['options'][$a[0]]):null;
            }
            if($this->readFault('outbox_read')){return null;}
            return $this->outbox[$a[0]]??null;
        }
        foreach($GLOBALS['meta'] as $id=>$m){if(($m['_malendo_analytics_receipt']??'')===$a[0]){return $id;}}return null;
    }
    function query($q){[$sql,$a]=$q;$this->sql[]=$sql;
        if(str_starts_with($sql,'INSERT IGNORE') && str_starts_with($a[0],MALENDO_CONFIRM_PREFIX)){
            if($this->readFault('proof_insert')){return false;}
            if(isset($this->proofs[$a[0]])){return 0;}
            $this->proofs[$a[0]]=$a[1];
            if($this->onConfirmation){($this->onConfirmation)();}
            return $this->readFault('lost_proof_ack')?false:1;
        }
        if(str_starts_with($sql,'INSERT IGNORE')){if($this->readFault('insert')){return false;}if(isset($this->outbox[$a[0]])){return 0;}$this->outbox[$a[0]]=$a[1];return 1;}
        if(str_contains($sql,'BINARY option_value')){if($this->readFault('replace')){return false;}if(($this->outbox[$a[1]]??null)!==$a[2]){return 0;}
            $this->outbox[$a[1]]=$a[0];
            if(json_decode($a[0],true)['state']==='sending' && $this->readFault('lost_reservation_ack')){return false;}
            return 1;
        }
        if(str_contains($sql,"SET meta_value = 'consumed'")){[$id,$hash]=$a;if(($GLOBALS['meta'][$id]['_malendo_analytics_receipt']??null)!==$hash){return 0;}$GLOBALS['meta'][$id]['_malendo_analytics_receipt']='consumed';return 1;}
        throw new RuntimeException('Unexpected synthetic SQL');
    }
    function get_col($q){[$sql,$a]=$q;$this->sql[]=$sql;
        if(str_contains($sql,'SELECT DISTINCT m.post_id')){
            if($this->readFault('reconcile')){return [];}
            $ids=array();foreach($GLOBALS['meta'] as $id=>$m){$ready=json_decode($m['_malendo_saved_v1']??'null',true);if($id>$a[2] && isset($this->proofs[$a[0].$id]) && (!empty($ready['intent'])||isset($ready['review']))&&!isset($this->outbox[$a[1].$id])){$ids[]=$id;}}return array_slice($ids,0,$a[5]);
        }
        if(str_contains($sql,'JSON_EXTRACT')){
            if($this->readFault('due')){return [];}
            $keys=array();foreach($this->outbox as $key=>$raw){$j=json_decode($raw,true);if((in_array($j['state'],array('pending','retry'),true)&&$j['next']<=$a[1])||(in_array($j['state'],array('claimed','sending'),true)&&$j['lease']<=$a[2])){$keys[]=$key;}}return array_slice($keys,0,$a[3]);
        }
        if(str_contains($sql,'ORDER BY option_id DESC')){return array_reverse(array_values($this->outbox));}
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
    unset($GLOBALS['activation_raw']);$GLOBALS['sql_canary']=false;$GLOBALS['throw_write']=false;$GLOBALS['EZSQL_ERROR']=[];
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
$tests['historical_52_56_57_untouched']=static function(){reset_form();foreach(array(52,56,57) as $id){$GLOBALS['posts'][$id]=array('post_type'=>'malendo_lead','post_status'=>'private');$GLOBALS['meta'][$id]=array('synthetic_protected'=>'unchanged');}$before=$GLOBALS['meta'];malendo_queue_saved_lead(52);malendo_queue_saved_lead(56);malendo_queue_saved_lead(57);malendo_notifications_reconcile();check($before===$GLOBALS['meta']&&!$GLOBALS['wpdb']->outbox);};
$tests['save_enqueue_gap_reconciles_once']=static function(){reset_form();submit();$GLOBALS['wpdb']->outbox=array();malendo_notifications_reconcile();check(count($GLOBALS['wpdb']->outbox)===1);$before=$GLOBALS['wpdb']->outbox;malendo_notifications_reconcile();check($before===$GLOBALS['wpdb']->outbox);};
$tests['changed_saved_field_stops']=static function(){reset_form();submit();$GLOBALS['meta'][101]['_malendo_service']='Other';check(malendo_notification_ready(101)===null);$calls=array();$t=transport($calls,array());$e=new Malendo_Outbox(new Malendo_WP_Outbox());check($e->tick(101,$t,static fn($id,$j)=>malendo_notification_ready($id)!==null)==='failed');check(!$calls);};
$tests['analytics_receipt_atomic_one_event_and_forgery']=static function(){reset_form();submit();unset($GLOBALS['malendo_saved_enquiry_event']);$_COOKIE['malendo_lead_receipt']=str_repeat('c',64);$GLOBALS['meta'][101]['_malendo_analytics_receipt']=hash('sha256',$_COOKIE['malendo_lead_receipt']);$GLOBALS['meta'][101]['_malendo_analytics_expires']=time()+300;do_action('template_redirect');check(($GLOBALS['malendo_saved_enquiry_event']['service']??'')==='rental');unset($GLOBALS['malendo_saved_enquiry_event']);do_action('template_redirect');check(!isset($GLOBALS['malendo_saved_enquiry_event']));$_GET['submitted']='1';$_COOKIE['malendo_lead_receipt']=str_repeat('d',64);do_action('template_redirect');check(!isset($GLOBALS['malendo_saved_enquiry_event']));};
$tests['disabled_zero_requests_and_credential_reads']=static function(){$s=new MemoryOutbox();$e=new Malendo_Outbox($s);$e->enqueue(101,ready());$before=$s->rows;$t=new Malendo_Gmail_Transport(false,static function(){throw new RuntimeException('credentials read');},static function(){throw new RuntimeException('network');});check($e->tick(101,$t,static fn()=>true)==='disabled');check($s->rows===$before);};
foreach(array(429) as $status){$tests['bounded_retry_'.$status]=static function()use($status){$now=time();$s=new MemoryOutbox();$e=new Malendo_Outbox($s,static function()use(&$now){return $now;},static fn()=>0);$e->enqueue(101,ready());$calls=array();$responses=array();for($i=0;$i<5;$i++){array_push($responses,token_response(),response($status,array('error'=>array('code'=>$status)),array('retry_after'=>'600')));}$t=transport($calls,$responses);for($i=1;$i<=5;$i++){check($e->tick(101,$t,static fn()=>true)===($i===5?'failed':'retry'));if($i<5){$j=$s->read(101)['job'];check($j['next']>=$now+600);$count=count($calls);$e->tick(101,$t,static fn()=>true);check(count($calls)===$count);$now=$j['next'];}}check(count($calls)===10);};}
$tests['timeout_unknown_no_replay']=static function(){$s=new MemoryOutbox();$e=new Malendo_Outbox($s);$e->enqueue(101,ready());$calls=array();$t=transport($calls,array(token_response(),array('status'=>0,'body'=>'','before_send'=>false)));check($e->tick(101,$t,static fn()=>true)==='unknown_delivery');check($e->tick(101,$t,static fn()=>true)==='unknown_delivery');check(count($calls)===2);};
$tests['connect_failure_before_upload_retry']=static function(){$s=new MemoryOutbox();$e=new Malendo_Outbox($s);$e->enqueue(101,ready());$calls=array();$t=transport($calls,array(token_response(),array('status'=>0,'body'=>'','before_send'=>true)));check($e->tick(101,$t,static fn()=>true)==='retry');};
foreach(array('invalid_grant','wide_scope','missing_scope') as $case){$tests['reauth_'.$case]=static function()use($case){$s=new MemoryOutbox();$e=new Malendo_Outbox($s);$e->enqueue(101,ready());$calls=array();$r=token_response();if($case==='invalid_grant'){$r=response(400,array('error'=>'invalid_grant'));}else{$r=response(200,array('access_token'=>'synthetic','token_type'=>'Bearer','scope'=>$case==='wide_scope'?Malendo_Gmail_Transport::SCOPE.' https://mail.google.com/':''));}$t=transport($calls,array($r));check($e->tick(101,$t,static fn()=>true)==='needs_reauth');check(count($calls)===1);};}
$tests['one_401_refresh_then_accepted']=static function(){$s=new MemoryOutbox();$e=new Malendo_Outbox($s);$e->enqueue(101,ready());$calls=array();$t=transport($calls,array(token_response(),response(401,array()),token_response(),response(200,array('id'=>'synthetic-id'))));check($e->tick(101,$t,static fn()=>true)==='accepted');check(count($calls)===4);check($e->tick(101,$t,static fn()=>true)==='accepted');check(count($calls)===4);check($s->read(101)['job']['message_id']==='synthetic-id');};
$tests['repeated_401_stops']=static function(){$s=new MemoryOutbox();$e=new Malendo_Outbox($s);$e->enqueue(101,ready());$calls=array();$t=transport($calls,array(token_response(),response(401,array()),token_response(),response(401,array())));check($e->tick(101,$t,static fn()=>true)==='needs_reauth');check(count($calls)===4);};
$tests['permission_403_needs_reauth']=static function(){$s=new MemoryOutbox();$e=new Malendo_Outbox($s);$e->enqueue(101,ready());$calls=array();$t=transport($calls,array(token_response(),response(403,array('error'=>array('code'=>403,'errors'=>array(array('reason'=>'domainPolicy')))))));check($e->tick(101,$t,static fn()=>true)==='needs_reauth');};
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

function expect_db_fault(callable $run): void {
    try { $run(); } catch (Malendo_Notification_DB_Error $e) { return; }
    throw new RuntimeException('expected a visible database failure');
}
$tests['r1_activation_read_unknown_survives_crash_no_backfill']=static function(){
    reset_form(); $db=$GLOBALS['wpdb']; $db->faults['activation']=1;
    check(str_contains(submit(),'submitted=1'));
    $m=json_decode(get_post_meta(101,'_malendo_saved_v1',true),true);
    check(array_key_exists('intent',$m) && $m['intent']===null && $m['review']==='activation_read_unknown');
    $db->outbox=[]; // Crash after completion marker and before enqueue.
    malendo_notifications_reconcile();
    $s=new Malendo_WP_Outbox(); $row=$s->read(101);
    check($row['job']['state']==='needs_review' && $row['job']['code']===$m['review']);
    $calls=[]; $engine=new Malendo_Outbox($s); $t=transport($calls,[]);
    for($i=0;$i<2;$i++){check($engine->tick(101,$t,static fn()=>true)==='needs_review');}
    check(!$calls && $s->read(101)===$row);
};
$tests['r1_absent_corrupt_and_unreadable_activation_differ']=static function(){
    reset_form();$GLOBALS['options']=[];check(malendo_notification_activation()===null);
    $GLOBALS['options']['malendo_notify_activation_v1']=['generation'=>'corrupt'];
    check(str_contains(submit(),'submitted=1'));
    $row=(new Malendo_WP_Outbox())->read(101);check($row['job']['code']==='activation_invalid');
    $GLOBALS['wpdb']->faults['activation']=1;expect_db_fault('malendo_notification_activation');
};
$tests['r1_empty_stored_activation_is_not_off']=static function(){
    reset_form();$GLOBALS['activation_raw']='';
    check(str_contains(submit(),'submitted=1'));
    check((new Malendo_WP_Outbox())->read(101)['job']['code']==='activation_invalid');
};
$tests['r1_qa_unknown_activation_is_excluded']=static function(){
    reset_form();$GLOBALS['wpdb']->faults['activation']=1;$_POST['_malendo_qa']='1';
    check(str_contains(submit(),'submitted=1'));malendo_notifications_reconcile();check(!$GLOBALS['wpdb']->outbox);
};
$tests['r1_history_cannot_enqueue_even_with_forged_eligible_marker']=static function(){
    reset_form();$q=new Malendo_Outbox(new Malendo_WP_Outbox());
    foreach([52,56,57] as $id){check(!$q->enqueue($id,ready()));check(malendo_notification_decision($id)['state']==='excluded');}
    check(!$GLOBALS['wpdb']->outbox);
};
$tests['r1_submit_readback_retries_only_select']=static function(){
    reset_form();$GLOBALS['wpdb']->faults['snapshot']=1;
    check(str_contains(submit(),'submitted=1'));check(count($GLOBALS['posts'])===1);
    check((new Malendo_WP_Outbox())->read(101)['job']['state']==='pending');
};
$tests['r1_marker_read_failure_retries_without_duplicate_hooks']=static function(){
    reset_form();$GLOBALS['wpdb']->faults['marker_snapshot']=1;
    check(str_contains(submit(),'submitted=1'));check(count($GLOBALS['posts'])===1);
    check(count($GLOBALS['wpdb']->outbox)===1 && (new Malendo_WP_Outbox())->read(101)['job']['state']==='pending');
};
$tests['r1_unverified_save_visible_no_false_success']=static function(){
    reset_form();$GLOBALS['wpdb']->faults['snapshot']=2;
    check(str_contains(submit(),'form_error=server'));
    check((new Malendo_WP_Outbox())->read(101)['job']['state']==='needs_review');
    check(!metadata_exists('post',101,'_malendo_analytics_receipt'));
};
foreach(['snapshot','marker_snapshot','activation','insert','outbox_read'] as $fault){
    $tests['r1_single_fault_'.$fault.'_then_exactly_one_job']=static function()use($fault){
        reset_form();submit();$db=$GLOBALS['wpdb'];$db->outbox=[];
        if($fault==='outbox_read'){malendo_notifications_reconcile();}
        $db->faults[$fault]=1;
        expect_db_fault($fault==='outbox_read'?static fn()=>(new Malendo_WP_Outbox())->read(101):'malendo_notifications_reconcile');
        malendo_notifications_reconcile();malendo_notifications_reconcile();
        check(count($db->outbox)===1 && (new Malendo_WP_Outbox())->read(101)['job']['state']==='pending');
    };
}
foreach(['reconcile','due','snapshot','replace'] as $fault){
    $tests['r1_worker_propagates_'.$fault.'_and_recovers']=static function()use($fault){
        reset_form();submit();$db=$GLOBALS['wpdb'];$db->faults[$fault]=1;
        $calls=[];$t=transport($calls,[token_response(),response(200,['id'=>'winner'])]);
        expect_db_fault(static fn()=>malendo_notifications_worker($t,1));
        check(!$calls);check((new Malendo_WP_Outbox())->read(101)['job']['state']==='pending');
        $out=malendo_notifications_worker($t,1);check($out['results'][101]==='accepted' && count($calls)===2);
    };
}
$tests['r1_second_eligibility_read_does_not_spend_last_attempt']=static function(){
    reset_form();submit();$s=new Malendo_WP_Outbox();$old=$s->read(101);$j=$old['job'];$j['attempts']=4;$s->replace(101,$old['raw'],$j);
    $now=time();$e=new Malendo_Outbox($s,static function()use(&$now){return $now;},static fn()=>0);
    $t=new Malendo_Gmail_Transport(true,'fake_credentials',static function($url){
        check(str_contains($url,'oauth2'));$GLOBALS['wpdb']->faults['snapshot']=1;return token_response();
    });
    $eligible=static fn($id,$job)=>malendo_notification_ready($id)!==null;
    expect_db_fault(static fn()=>$e->tick(101,$t,$eligible));$row=$s->read(101)['job'];
    check($row['state']==='retry' && $row['attempts']===4);
    $now=$row['next'];$calls=[];$t=transport($calls,[token_response(),response(200,['id'=>'winner'])]);
    check($e->tick(101,$t,$eligible)==='accepted' && count($calls)===2);
};
foreach(['rateLimitExceeded','userRateLimitExceeded','domainPolicy','insufficientPermissions','newReason',null] as $reason){
    $tests['r2_403_'.($reason??'missing')]=static function()use($reason){
        $now=time();$s=new MemoryOutbox();$e=new Malendo_Outbox($s,static fn()=>$now,static fn()=>0);
        $e->enqueue(101,ready());$calls=[];
        $t=transport($calls,[token_response(),response(403,['error'=>['code'=>403,'errors'=>[['reason'=>$reason,'message'=>'PRIVATE-RAW-RESPONSE']]]],['retry_after'=>'510'])]);
        $status=$e->tick(101,$t,static fn()=>true);
        $rate=in_array($reason,['rateLimitExceeded','userRateLimitExceeded'],true);
        $denied=in_array($reason,['domainPolicy','insufficientPermissions'],true);
        check($status===($rate?'retry':($denied?'needs_reauth':'failed')));
        $r=$s->read(101);
        if($rate){check($r['job']['next']>=$now+510);}
        check(!str_contains($r['raw'],'PRIVATE-RAW-RESPONSE'));$e->tick(101,$t,static fn()=>true);check(count($calls)===2);
    };
}
$tests['r3_accept_then_503_no_second_post_after_restart']=static function(){
    $now=time();$s=new MemoryOutbox();$clock=static function()use(&$now){return $now;};
    $q=new Malendo_Outbox($s,$clock);$q->enqueue(101,ready());$posts=0;
    $t=new Malendo_Gmail_Transport(true,'fake_credentials',static function($url)use(&$posts){
        if(str_contains($url,'oauth2')){return token_response();}
        $posts++; // Simulated Gmail accepted this POST before returning its error.
        return response(503,['error'=>['code'=>503,'errors'=>[['reason'=>'backendError']]]],['retry_after'=>'10']);
    });
    check($q->tick(101,$t,static fn()=>true)==='unknown_delivery');
    foreach([600,86400] as $delta){$now+=$delta;$next=new Malendo_Outbox($s,$clock);check($next->tick(101,$t,static fn()=>true)==='unknown_delivery');}
    check($posts===1 && $s->read(101)['job']['code']==='gmail_503_outcome_unknown');
};
foreach(['name'=>'full_name','email'=>'email','phone'=>'phone','message'=>'message'] as $field=>$input){
    $tests['r4_log_redaction_'.$field]=static function()use($field,$input){
        reset_form();$db=$GLOBALS['wpdb'];$GLOBALS['sql_canary']=true;$GLOBALS['fail_meta']='_malendo_'.$field;
        $canary='PII-CANARY-'.$field.($field==='email'?'@example.invalid':'-SYNTHETIC');
        $_POST[$input]=$canary;
        $log=getenv('MALENDO_TEST_TMP').'/private-'.$field.'.log';$old=ini_set('error_log',$log);
        try {
            check(str_contains(submit(),'form_error=server'));
            check(!$db->suppressed && count($GLOBALS['posts'])===1 && !$db->outbox);
            $logged=file_get_contents($log);
            check(str_contains($logged,'Malendo incomplete enquiry save; ID 101'));
            check(!str_contains($logged.json_encode([$GLOBALS['EZSQL_ERROR'],$db->queries,$db->outbox]),$canary));
        } finally {if($old===''){ini_restore('error_log');}else{ini_set('error_log',$old);}}
    };
}
$tests['r4_finally_restores_both_prior_modes_on_exception']=static function(){
    foreach([false,true] as $prior){
        reset_form();$db=$GLOBALS['wpdb'];$db->suppress_errors($prior);
        $db->queries=[['prior']];$GLOBALS['EZSQL_ERROR']=[['query'=>'prior']];
        $GLOBALS['sql_canary']=true;$GLOBALS['throw_write']=true;$GLOBALS['fail_meta']='_malendo_phone';
        check(str_contains(submit(),'form_error=server'));
        check($db->suppressed===$prior && $db->queries===[['prior']] && $GLOBALS['EZSQL_ERROR']===[['query'=>'prior']]);
    }
};
$tests['r5_owner_capability_registration_direct_callback_and_metabox']=static function(){
    reset_form();submit();$GLOBALS['user_id']=701;$GLOBALS['can_manage']=true;
    putenv('MALENDO_NOTIFICATION_OWNER_ID=701');
    try {
        do_action('admin_menu');do_action('add_meta_boxes_malendo_lead');
        $page=$GLOBALS['queue_page'];$box=$GLOBALS['boxes']['malendo_save_status'];
        ob_start();$page();$box((object)['ID'=>101]);$html=ob_get_clean();
        check(str_contains($html,'Malendo notifications') && str_contains($html,'Completion marker recorded'));
        foreach([[702,true,'701'],[701,false,'701'],[701,true,''],[0,true,'0']] as [$uid,$cap,$configured]){
            $GLOBALS['user_id']=$uid;$GLOBALS['can_manage']=$cap;
            putenv($configured===''?'MALENDO_NOTIFICATION_OWNER_ID':'MALENDO_NOTIFICATION_OWNER_ID='.$configured);
            unset($GLOBALS['queue_page'],$GLOBALS['boxes']['malendo_save_status']);
            do_action('admin_menu');do_action('add_meta_boxes_malendo_lead');
            check(!isset($GLOBALS['queue_page']) && !isset($GLOBALS['boxes']['malendo_save_status']));
            ob_start();$page();$box((object)['ID'=>101]);check(ob_get_clean()==='');
        }
    } finally {putenv('MALENDO_NOTIFICATION_OWNER_ID');}
};

$tests['p0_form_worker_between_marker_and_both_failed_reads']=static function(){
    reset_form(); $db=$GLOBALS['wpdb']; $reads=0; $posts=0;
    $transport=new Malendo_Gmail_Transport(true,'fake_credentials',static function($url)use(&$posts){
        if($url===Malendo_Gmail_Transport::SEND_URL){++$posts;return response(200,['id'=>'mock']);}
        return token_response();
    });
    // Yield the form's SELECT to a worker with a healthy read. Fail only this form's two reads.
    $db->onMarkerRead=static function()use($db,$transport,&$reads){
        $resume=$db->onMarkerRead; $db->onMarkerRead=null;
        malendo_notifications_worker($transport,1);
        if(++$reads<2){$db->onMarkerRead=$resume;}
        $db->last_error='interleaved_read_failure';
    };
    $redirect=submit();
    for($run=0;$run<3;$run++){malendo_notifications_worker($transport,1);}
    $state=(new Malendo_WP_Outbox())->read(101)['job']['state']??null;
    check(str_contains($redirect,'form_error=server') && $reads===2);
    check(count($GLOBALS['posts'])===1 && array_diff(malendo_lead_fields(),array_keys(malendo_lead_snapshot(101)))===[]);
    check(!metadata_exists('post',101,'_malendo_analytics_receipt'));
    $prepared=json_decode(get_post_meta(101,'_malendo_saved_v1',true),true);
    check($prepared['phase']==='prepared' && !array_key_exists('eligible',$prepared));
    check($posts===0 && $state==='needs_review',"posts=$posts state=$state");
};
$tests['p0_seven_workers_401_then_db_read_budget']=static function(){
    $store=new MemoryOutbox(); $now=time(); $posts=0; $afterPost=false; $trace=[];
    $clock=static function()use(&$now){return $now;};
    (new Malendo_Outbox($store,$clock))->enqueue(101,ready());
    $transport=new Malendo_Gmail_Transport(true,'fake_credentials',static function($url)use(&$posts,&$afterPost){
        if($url!==Malendo_Gmail_Transport::SEND_URL){return token_response();}
        ++$posts; $afterPost=true; return response(401,[]);
    });
    for($run=0;$run<7;$run++){
        $now+=640; $afterPost=false;
        try {
            (new Malendo_Outbox($store,$clock))->tick(101,$transport,static function()use(&$afterPost){
                if($afterPost){$afterPost=false;throw new Malendo_Notification_DB_Error('pre_refresh_read');}
                return true;
            });
        } catch(Malendo_Notification_DB_Error $e){check($e->getMessage()==='pre_refresh_read');}
        $trace[]=$store->read(101)['job']['attempts'];
    }
    $job=$store->read(101)['job'];
    check($posts===5 && $trace===[1,2,3,4,5,5,5] && $job['state']==='failed' && $job['code']==='attempt_limit',
        "POSTs=$posts attempts=".implode(',',$trace)." state=".$job['state']);
};

final class SimulatedFormCrash extends RuntimeException {}
foreach(['prepared','confirmed'] as $phase){
    $tests['p0_form_crash_'.$phase]=static function()use($phase){
        reset_form(); $db=$GLOBALS['wpdb'];
        $crash=static function(){throw new SimulatedFormCrash();};
        if($phase==='confirmed'){$db->onConfirmation=$crash;}else{$db->onMarkerRead=$crash;}
        try {submit();throw new LogicException('form did not stop');} catch(SimulatedFormCrash $expected){}
        $db->onConfirmation=$db->onMarkerRead=null;
        $calls=[]; $t=transport($calls,[token_response(),response(200,['id'=>'mock'])]);
        for($run=0;$run<3;$run++){malendo_notifications_worker($t,1);}
        check(count($GLOBALS['posts'])===1 && !metadata_exists('post',101,'_malendo_analytics_receipt'));
        $confirmed=$phase==='confirmed';
        check(count($calls)===($confirmed?2:0) && count($db->outbox)===($confirmed?1:0));
        if($confirmed){check((new Malendo_WP_Outbox())->read(101)['job']['state']==='accepted');}
        else{
            $GLOBALS['user_id']=701;$GLOBALS['can_manage']=true;putenv('MALENDO_NOTIFICATION_OWNER_ID=701');
            try{
                do_action('add_meta_boxes_malendo_lead');ob_start();($GLOBALS['boxes']['malendo_save_status'])((object)['ID'=>101]);
                check(str_contains(ob_get_clean(),'owner review required'));
            }finally{putenv('MALENDO_NOTIFICATION_OWNER_ID');}
        }
    };
}
$tests['p0_failed_proof_insert_is_fenced_before_form_error']=static function(){
    reset_form();$db=$GLOBALS['wpdb'];$db->faults['proof_insert']=1;
    check(str_contains(submit(),'form_error=server'));
    check($db->proofs[MALENDO_CONFIRM_PREFIX.'101']==='hold');
    check(!malendo_claim_confirmation(101,hash('sha256',get_post_meta(101,'_malendo_saved_v1',true))));
    $calls=[];malendo_notifications_worker(transport($calls,[]),1);
    check(!$calls && (new Malendo_WP_Outbox())->read(101)['job']['state']==='needs_review');
    check(!metadata_exists('post',101,'_malendo_analytics_receipt'));
};
$tests['p0_lost_ack_after_worker_accepted_resolves_to_success']=static function(){
    reset_form();$db=$GLOBALS['wpdb'];$calls=[];
    $t=transport($calls,[token_response(),response(200,['id'=>'mock'])]);
    $db->faults['lost_proof_ack']=1;
    $db->onConfirmation=static function()use($t){malendo_notifications_worker($t,1);};
    check(str_contains(submit(),'submitted=1'));
    malendo_notifications_worker($t,1);
    check(count($calls)===2 && count($db->outbox)===1 && (new Malendo_WP_Outbox())->read(101)['job']['attempts']===1);
};
foreach(['written','absent'] as $outcome){
    $tests['p0_unreadable_final_outcome_'.$outcome]=static function()use($outcome){
        reset_form();$db=$GLOBALS['wpdb'];
        if($outcome==='written'){$db->faults=['lost_proof_ack'=>1,'proof_read'=>1];}
        else{$db->faults=['proof_insert'=>2];}
        check(str_contains(submit(),'form_error=confirmation_pending'));
        check(!metadata_exists('post',101,'_malendo_analytics_receipt') && !$db->outbox);
        $calls=[];$t=transport($calls,[token_response(),response(200,['id'=>'mock'])]);
        for($i=0;$i<3;$i++){malendo_notifications_worker($t,1);}
        check(count($calls)===($outcome==='written'?2:0));
        check(count($GLOBALS['posts'])===1);
    };
}
foreach(['legacy_marker','changed_proof','old_job','bad_counter','change_during_token'] as $case){
    $tests['p0_stale_permission_'.$case]=static function()use($case){
        reset_form();submit();$db=$GLOBALS['wpdb'];$s=new Malendo_WP_Outbox();
        if($case==='legacy_marker'){
            $marker=json_decode($GLOBALS['meta'][101]['_malendo_saved_v1'],true);unset($marker['phase'],$marker['intent']);$marker['eligible']=true;
            $GLOBALS['meta'][101]['_malendo_saved_v1']=json_encode($marker);
            unset($db->proofs[MALENDO_CONFIRM_PREFIX.'101']);
        }elseif($case==='changed_proof'){$db->proofs[MALENDO_CONFIRM_PREFIX.'101']=str_repeat('a',64);}
        elseif($case==='old_job' || $case==='bad_counter'){
            $row=$s->read(101);$j=$row['job'];
            if($case==='old_job'){unset($j['protocol']);}else{$j['attempts']='0';}
            check($s->replace(101,$row['raw'],$j));
        }
        $posts=0;$t=new Malendo_Gmail_Transport(true,'fake_credentials',static function($url)use(&$posts,$db,$case){
            if($url===Malendo_Gmail_Transport::SEND_URL){++$posts;return response(200,['id'=>'unexpected']);}
            if($case==='change_during_token'){unset($db->proofs[MALENDO_CONFIRM_PREFIX.'101']);}
            return token_response();
        });
        malendo_notifications_worker($t,1);check($posts===0);
    };
}
$tests['p0_refresh_reserves_its_own_post_before_http']=static function(){
    $s=new MemoryOutbox();$q=new Malendo_Outbox($s);$q->enqueue(101,ready());$reservations=[];
    $t=new Malendo_Gmail_Transport(true,'fake_credentials',static function($url)use($s,&$reservations){
        if($url!==Malendo_Gmail_Transport::SEND_URL){return token_response();}
        $r=$s->read(101)['job'];$reservations[]=[$r['state'],$r['attempts']];
        return count($reservations)===1?response(401,[]):response(200,['id'=>'mock']);
    });
    check($q->tick(101,$t,static fn()=>true)==='accepted');
    check($reservations===[['sending',1],['sending',2]]);
};
$tests['p0_reservation_ack_lost_no_post_after_expiry']=static function(){
    reset_form();submit();$db=$GLOBALS['wpdb'];$now=time();$s=new Malendo_WP_Outbox();
    $q=new Malendo_Outbox($s,static function()use(&$now){return $now;});
    $db->faults['lost_reservation_ack']=1;
    $calls=[];$t=transport($calls,[token_response()]);
    expect_db_fault(static fn()=>$q->tick(101,$t,static fn()=>true));
    $j=$s->read(101)['job'];check($j['state']==='sending' && $j['attempts']===1);
    $now+=Malendo_Outbox::LEASE+1;check($q->tick(101,$t,static fn()=>true)==='unknown_delivery');
    check(count($calls)===1 && $calls[0][0]!==Malendo_Gmail_Transport::SEND_URL);
};
$tests['p0_token_failures_bounded_separately_from_post_budget']=static function(){
    $s=new MemoryOutbox();$now=time();
    $q=new Malendo_Outbox($s,static function()use(&$now){return $now;});$q->enqueue(101,ready());
    $calls=[];$t=transport($calls,array_fill(0,5,response(503,[])));
    for($i=0;$i<7;$i++){$now+=1500;$q->tick(101,$t,static fn()=>true);}
    $j=$s->read(101)['job'];check($j['state']==='failed' && $j['pre_send_failures']===5 && $j['attempts']===0 && count($calls)===5);
};

$tests['p0_401_second_worker_and_wp_snapshot_error']=static function(){
    reset_form();submit();$db=$GLOBALS['wpdb'];$store=new Malendo_WP_Outbox();$now=time();$posts=0;
    $clock=static function()use(&$now){return $now;};
    $allowed=static fn($id)=>malendo_notification_ready($id)!==null;
    $otherCalls=[];$other=transport($otherCalls,[]);
    $t=new Malendo_Gmail_Transport(true,'fake_credentials',static function($url)use($db,$store,$clock,$allowed,$other,&$posts){
        if($url!==Malendo_Gmail_Transport::SEND_URL){return token_response();}
        $posts++;
        check($store->read(101)['job']['attempts']===$posts,'POST before reservation');
        check((new Malendo_Outbox($store,$clock))->tick(101,$other,$allowed)==='sending');
        $db->faults['snapshot']=1;
        return response(401,[]);
    });
    for($run=1;$run<=7;$run++){
        $now+=640;$engine=new Malendo_Outbox($store,$clock);
        if($run<5){expect_db_fault(static fn()=>$engine->tick(101,$t,$allowed));}
        else{check($engine->tick(101,$t,$allowed)==='failed');}
        check($store->read(101)['job']['attempts']===min(5,$run));
    }
    check($posts===5 && !$otherCalls && $store->read(101)['job']['code']==='attempt_limit');
};

$results=array();foreach($tests as $name=>$test){try{$test();$results[$name]='PASS';}catch(Throwable $e){$results[$name]='FAIL: '.$e->getMessage();}}
ob_end_clean();
echo json_encode(array('php'=>PHP_VERSION,'tests'=>$results,'passed'=>count(array_filter($results,static fn($r)=>$r==='PASS')),'total'=>count($results),
    'sql_error_logger'=>class_exists('QA_Core_Logger')?'WordPress wpdb::print_error':'fixture',
    'isolation'=>'Synthetic stubs + file CAS, no native WordPress/MySQL; no HTTP transport invoked'),JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES)."\n";
exit(count(array_filter($results,static fn($r)=>$r!=='PASS'))?1:0);
