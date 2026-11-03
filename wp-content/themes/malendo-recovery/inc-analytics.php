<?php
/** Malendo-only, consent-gated analytics. No contact details enter event payloads. */
if (!defined('ABSPATH')) { exit; }

function malendo_analytics_test_mode(): bool {
    return defined('MALENDO_ANALYTICS_TEST_MODE') && MALENDO_ANALYTICS_TEST_MODE === true;
}
function malendo_analytics_scope(): bool {
    return malendo_analytics_test_mode() ||
        (wp_get_environment_type() === 'production' && home_url('/') === 'https://malendo-property.com/');
}
function malendo_analytics_qa(): bool {
    return isset($_GET['malendo_qa']) || !empty($_POST['_malendo_qa']) || is_user_logged_in() || is_preview();
}

add_action('malendo_enquiry_saved', static function (int $id): void {
    if (!malendo_analytics_scope() || malendo_analytics_qa() ||
        ($_COOKIE['malendo_analytics_choice'] ?? '') !== 'allow') { return; }
    try {
        $token = bin2hex(random_bytes(32));
        update_post_meta($id, '_malendo_analytics_expires', time() + 300);
        if (!update_post_meta($id, '_malendo_analytics_receipt', hash('sha256', $token))) { return; }
        setcookie('malendo_lead_receipt', $token, array(
            'expires'=>time()+300, 'path'=>'/', 'secure'=>!malendo_analytics_test_mode(),
            'httponly'=>true, 'samesite'=>'Lax'
        ));
    } catch (Throwable $e) {
        // A measurement failure must never interrupt saving an enquiry.
        error_log('Malendo: analytics receipt could not be created. Enquiry remains saved.');
    }
});

add_action('template_redirect', static function (): void {
    if (!malendo_analytics_scope() || malendo_analytics_qa() ||
        ($_COOKIE['malendo_analytics_choice'] ?? '') !== 'allow' ||
        !is_page(array(6, 35))) { return; }
    $token = $_COOKIE['malendo_lead_receipt'] ?? '';
    if (!is_string($token) || !preg_match('/^[a-f0-9]{64}$/D', $token)) { return; }
    nocache_headers();
    setcookie('malendo_lead_receipt', '', array('expires'=>time()-3600,'path'=>'/',
        'secure'=>!malendo_analytics_test_mode(),'httponly'=>true,'samesite'=>'Lax'));
    global $wpdb;
    $hash = hash('sha256', $token);
    $id = (int)$wpdb->get_var($wpdb->prepare(
        "SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key = '_malendo_analytics_receipt' AND meta_value = %s LIMIT 1", $hash));
    if (!$id || get_post_type($id) !== 'malendo_lead' || get_post_status($id) !== 'private' ||
        (int)get_post_meta($id, '_malendo_analytics_expires', true) < time()) { return; }
    // Conditional SQL update provides one atomic claim, including simultaneous page loads.
    $claimed = $wpdb->query($wpdb->prepare(
        "UPDATE {$wpdb->postmeta} SET meta_value = 'consumed' WHERE post_id = %d AND meta_key = '_malendo_analytics_receipt' AND meta_value = %s", $id, $hash));
    if ($claimed !== 1) { return; }
    wp_cache_delete($id, 'post_meta');
    $services = array('Property management'=>'property_management','Rental'=>'rental',
        'Buying or selling'=>'buying_or_selling','Project check'=>'project_check','Owner services'=>'owner_services','Other'=>'other');
    $service = (string)get_post_meta($id, '_malendo_service', true);
    $GLOBALS['malendo_saved_enquiry_event'] = array(
        'business'=>'malendo', 'service'=>$services[$service] ?? 'other',
        'locale'=>get_post_meta($id,'_malendo_locale',true)==='ru' ? 'ru' : 'en'
    );
}, 5);

add_action('wp_footer', static function (): void {
    if (!malendo_analytics_scope() || is_admin()) { return; }
    $qa = malendo_analytics_qa() || malendo_analytics_test_mode();
    $config = array('measurementId'=>'G-D99Y7TY0LC','qa'=>$qa,'locale'=>malendo_is_ru() ? 'ru' : 'en',
        'receipt'=>$GLOBALS['malendo_saved_enquiry_event'] ?? null);
    ?>
    <button type="button" id="malendo-analytics-preferences" class="malendo-analytics-preferences"><?php echo malendo_text('Analytics preferences','Настройки аналитики'); ?></button>
    <aside id="malendo-consent" class="malendo-consent" aria-label="<?php echo esc_attr(malendo_text('Optional analytics','Необязательная аналитика')); ?>" hidden>
      <p><?php echo malendo_text('Allow optional Google Analytics to help us understand visits and enquiries? Your contact details and message are not sent to Analytics. The form works with either choice.','Разрешить Google Analytics для анализа посещений и обращений? Контакты и текст заявки в аналитику не передаются. Форма работает при любом выборе.'); ?> <a href="<?php echo esc_url(malendo_local_url('/privacy-policy/')); ?>"><?php echo malendo_text('Privacy policy','Политика конфиденциальности'); ?></a></p>
      <div class="malendo-consent-actions"><button type="button" class="button button--outline" id="malendo-consent-deny"><?php echo malendo_text('Continue without analytics','Продолжить без аналитики'); ?></button><button type="button" class="button" id="malendo-consent-allow"><?php echo malendo_text('Allow analytics','Разрешить аналитику'); ?></button></div>
    </aside>
    <script id="malendo-analytics-config" type="application/json"><?php echo wp_json_encode($config, JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT); ?></script>
    <script src="<?php echo esc_url(get_stylesheet_directory_uri().'/analytics.js?ver=20261103a'); ?>" defer></script>
    <?php
}, 20);
