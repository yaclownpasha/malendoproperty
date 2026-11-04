<?php
/** Review-only CLI entrypoint; no installation or activation occurs when this file is copied. */
if (PHP_SAPI!=='cli') { http_response_code(404); exit; }
$args=array_slice($argv,1);
$activate=null;
if(count($args)===1 && preg_match('/^--activate-after-id=([0-9]+)$/D',$args[0],$m)){$activate=(int)$m[1];}
elseif($args!==array('--run')){fwrite(STDERR,"Use --run or --activate-after-id=<current maximum post ID>; activation requires separate authorization.\n");exit(2);}
$enabled=getenv('MALENDO_GMAIL_TRANSPORT')==='enabled';
if($activate===null && !$enabled){echo "{\"status\":\"disabled\",\"network_requests\":0}\n";exit(0);}
// This path is supplied only by the reviewed service config; no secrets in CLI arguments.
$site=getenv('MALENDO_WORDPRESS_ROOT');
$lockPath=getenv('MALENDO_NOTIFICATION_LOCK');
if(!$site || !is_file($site.'/wp-load.php') || !$lockPath || !is_dir(dirname($lockPath)) || is_link($lockPath)){
    fwrite(STDERR,"Configuration unavailable.\n");exit(2);
}
umask(0077);
$lock=fopen($lockPath,'c');
if(!$lock || !flock($lock,LOCK_EX|LOCK_NB)){fwrite(STDERR,"Worker busy or lock unavailable.\n");exit(3);}
$stopping=false;
$correctSite=false;
if(function_exists('pcntl_async_signals')){
    pcntl_async_signals(true);
    // A signal never replays a send. An in-flight item completes its persisted outcome.
    pcntl_signal(SIGTERM,static function()use(&$stopping){$stopping=true;});
    pcntl_signal(SIGINT,static function()use(&$stopping){$stopping=true;});
}
try{
    define('MALENDO_NOTIFICATION_WORKER',true);
    define('DISABLE_WP_CRON',true);
    require $site.'/wp-load.php';
    if(home_url('/')!=='https://malendo-property.com/' || get_option('stylesheet')!=='malendo-recovery'){
        throw new RuntimeException('wrong_site');
    }
    $correctSite=true;
    if($activate!==null){
        global $wpdb;
        $max=(int)malendo_checked_query($wpdb->get_var("SELECT MAX(ID) FROM {$wpdb->posts}"));
        if($activate < MALENDO_LAST_HISTORICAL_LEAD || $activate!==$max || malendo_notification_activation()!==null){throw new RuntimeException('activation_refused');}
        // Immutable generation. Never reset on code rollback or deploy.
        $a=array('after_id'=>$max,'generation'=>bin2hex(random_bytes(16)),'activated_at'=>time());
        $inserted = malendo_checked_query($wpdb->query($wpdb->prepare(
            "INSERT IGNORE INTO {$wpdb->options} (option_name,option_value,autoload) VALUES (%s,%s,'no')",
            'malendo_notify_activation_v1', serialize($a)
        )));
        if ($inserted !== 1 || malendo_notification_activation() !== $a) { throw new RuntimeException('activation_failed'); }
        echo "{\"status\":\"activated\"}\n";
    }else{
        update_option('malendo_notify_worker_v1',array('time'=>time(),'status'=>'running'),false);
        $credentials=getenv('MALENDO_GMAIL_CREDENTIALS') ?: '';
        $transport=new Malendo_Gmail_Transport(true,static fn()=>Malendo_Gmail_Transport::credentials($credentials));
        $end=microtime(true)+40;
        for($n=0;$n<10 && !$stopping && microtime(true)<$end;$n++){
            $r=malendo_notifications_worker($transport,1);
            echo json_encode($r,JSON_THROW_ON_ERROR)."\n";
            if(empty($r['results'])){break;}
        }
        update_option('malendo_notify_worker_v1',array('time'=>time(),'status'=>'complete'),false);
    }
}catch(Throwable $e){
    if($correctSite){update_option('malendo_notify_worker_v1',array('time'=>time(),'status'=>'failed'),false);}
    // Do not print exception text: transport/library errors can contain credentials or PII.
    fwrite(STDERR,"Malendo worker stopped; inspect protected queue status and configuration.\n");exit(1);
}finally{flock($lock,LOCK_UN);fclose($lock);}
