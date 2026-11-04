<?php
/**
 * Malendo owner enquiries. Private WordPress records; no external plugin.
 * This file contains no credentials and does not send outbound email.
 */
if (!defined('ABSPATH')) { exit; }

add_action('init', static function (): void {
    register_post_type('malendo_lead', array(
        'labels' => array('name' => 'Malendo Enquiries', 'singular_name' => 'Enquiry', 'menu_name' => 'Enquiries'),
        'public' => false,
        'show_ui' => true,
        'show_in_rest' => false,
        'exclude_from_search' => true,
        'has_archive' => false,
        'rewrite' => false,
        'supports' => array('title'),
        'menu_icon' => 'dashicons-email-alt',
        'capability_type' => 'post',
        'map_meta_cap' => true
    ));
}, 10);

function malendo_recovery_redirect_form(string $state): void {
    $ru_contact = malendo_translation_id(6);
    $is_ru = isset($_POST['_malendo_locale']) && $_POST['_malendo_locale'] === 'ru' && $ru_contact;
    $target = home_url('/contact/');
    if ($is_ru && get_post_status($ru_contact) === 'publish') { $target = get_permalink($ru_contact); }
    elseif ($is_ru && current_user_can('edit_post', $ru_contact)) { $target = get_preview_post_link($ru_contact); }
    if (!empty($_POST['_malendo_qa'])) { $target = add_query_arg('malendo_qa', '1', $target); }
    wp_safe_redirect(add_query_arg($state === 'submitted' ? 'submitted' : 'form_error', $state === 'submitted' ? '1' : $state, $target), 303);
    exit;
}

add_action('admin_post_nopriv_malendo_lead_submit', 'malendo_recovery_receive_lead');
add_action('admin_post_malendo_lead_submit', 'malendo_recovery_receive_lead');
function malendo_recovery_receive_lead(): void {
    if (!isset($_SERVER['REQUEST_METHOD']) || $_SERVER['REQUEST_METHOD'] !== 'POST') {
        status_header(405);
        exit;
    }
    $nonce = isset($_POST['_malendo_nonce']) && is_string($_POST['_malendo_nonce'])
        ? sanitize_text_field(wp_unslash($_POST['_malendo_nonce'])) : '';
    if (!wp_verify_nonce($nonce, 'malendo_enquiry')) {
        malendo_recovery_redirect_form('security');
    }
    if (!empty($_POST['website'])) {
        malendo_recovery_redirect_form('invalid');
    }
    if (($_POST['consent'] ?? null) !== 'yes') {
        malendo_recovery_redirect_form('consent');
    }
    $request = static function (string $key, int $max): string {
        $v = isset($_POST[$key]) && is_string($_POST[$key]) ? wp_unslash($_POST[$key]) : '';
        return mb_substr($key === 'message' ? sanitize_textarea_field($v) : sanitize_text_field($v), 0, $max);
    };
    $name = $request('full_name', 120);
    $email = $request('email', 200);
    $phone = $request('phone', 80);
    $message = $request('message', 2500);
    $service = $request('service', 80);
    $services = array('Property management', 'Rental', 'Buying or selling', 'Project check', 'Owner services', 'Other');
    if (!in_array($service, $services, true)) {
        $service = 'Other';
    }
    if (mb_strlen($name) < 2 || mb_strlen($message) < 10 || (!$email && !$phone)) {
        malendo_recovery_redirect_form('required');
    }
    if ($email !== '' && !is_email($email)) {
        malendo_recovery_redirect_form('email');
    }
    $ip = isset($_SERVER['REMOTE_ADDR']) ? (string)$_SERVER['REMOTE_ADDR'] : 'unknown';
    $rateKey = 'malendo_lead_limit_' . hash('sha256', $ip . wp_salt('nonce'));
    if (get_transient($rateKey)) {
        malendo_recovery_redirect_form('rate');
    }
    // Capture the activation generation before insertion; never backfill old enquiries.
    $activation = malendo_notification_activation();
    $qa = !empty($_POST['_malendo_qa']) || isset($_GET['malendo_qa']);
    $title = sprintf('Enquiry %s — %s', current_time('Y-m-d H:i'), $service);
    $id = wp_insert_post(array(
        'post_type' => 'malendo_lead',
        'post_status' => 'private',
        'post_title' => $title,
        'post_author' => 0,
    ), true);
    if (is_wp_error($id) || !$id) {
        malendo_recovery_redirect_form('server');
    }
    $fields = array('name' => $name, 'email' => $email, 'phone' => $phone,
                   'service' => $service, 'message' => $message,
                   'landing' => home_url((isset($_POST['_malendo_locale']) && $_POST['_malendo_locale'] === 'ru') ? '/ru/contact/' : '/contact/'),
                   'locale' => (isset($_POST['_malendo_locale']) && $_POST['_malendo_locale'] === 'ru') ? 'ru' : 'en',
                   'consented_at' => current_time('mysql', true));
    foreach ($fields as $key => $value) {
        update_post_meta($id, '_malendo_' . $key, wp_slash($value));
    }
    // update_post_meta(false) can mean unchanged, so verify exact read-back instead.
    // The final durable marker closes the save/enqueue crash gap for reconciliation.
    if (!malendo_lead_saved_marker((int)$id, $fields, $activation, $qa)) {
        update_post_meta($id, '_malendo_save_error', 'required_fields_or_marker');
        error_log('Malendo incomplete enquiry save; ID ' . (int)$id);
        malendo_recovery_redirect_form('server');
    }
    do_action('malendo_enquiry_saved', (int)$id);
    set_transient($rateKey, 1, 45);
    malendo_recovery_redirect_form('submitted');
}

add_shortcode('malendo_contact_form', static function (): string {
    $submitted = isset($_GET['submitted']) && $_GET['submitted'] === '1';
    $error = isset($_GET['form_error']) && is_string($_GET['form_error'])
        ? sanitize_text_field(wp_unslash($_GET['form_error'])) : '';
    ob_start();
    if ($submitted) {
        echo malendo_text('<div class="form-message form-success" role="status"><strong>Enquiry received.</strong> Your message has been saved for review by Malendo Property. For urgent requests, use WhatsApp.</div>','<div class="form-message form-success" role="status"><strong>Запрос получен.</strong> Сообщение сохранено для рассмотрения Malendo Property. По срочным вопросам используйте WhatsApp.</div>');
    } elseif ($error !== '') {
        echo malendo_text('<div class="form-message form-error" role="alert">Your enquiry was not submitted. Check required fields, consent and email format, then try again. For urgent requests, use WhatsApp.</div>','<div class="form-message form-error" role="alert">Запрос не отправлен. Проверьте обязательные поля, согласие и email, затем повторите попытку. По срочным вопросам используйте WhatsApp.</div>');
    }
    ?>
    <form class="malendo-form" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" method="post">
      <input type="hidden" name="action" value="malendo_lead_submit">
      <input type="hidden" name="_malendo_locale" value="<?php echo malendo_is_ru() ? 'ru' : 'en'; ?>">
      <?php if (isset($_GET['malendo_qa'])) { echo '<input type="hidden" name="_malendo_qa" value="1">'; } ?>
      <?php wp_nonce_field('malendo_enquiry', '_malendo_nonce'); ?>
      <div class="hidden-honeypot" aria-hidden="true">
        <label for="malendo-website">Leave this empty</label>
        <input type="text" id="malendo-website" name="website" autocomplete="off" tabindex="-1">
      </div>
      <div class="form-columns">
        <label><?php echo malendo_text('Full name','Ваше имя'); ?> <span>*</span><input type="text" name="full_name" maxlength="120" minlength="2" required autocomplete="name"></label>
        <label><?php echo malendo_text('Email','Email'); ?> <input type="email" name="email" maxlength="200" autocomplete="email"></label>
        <label><?php echo malendo_text('WhatsApp / phone','WhatsApp / телефон'); ?> <input type="tel" name="phone" maxlength="80" autocomplete="tel"></label>
        <label><?php echo malendo_text('Service','Услуга'); ?> <span>*</span><select name="service" required>
          <?php foreach (array('Property management','Rental','Buying or selling','Project check','Owner services','Other') as $s) {
              $labels = array('Property management'=>'Управление недвижимостью','Rental'=>'Аренда','Buying or selling'=>'Покупка или продажа','Project check'=>'Проверка проекта','Owner services'=>'Услуги владельцам','Other'=>'Другое');
              echo '<option value="' . esc_attr($s) . '">' . esc_html(malendo_text($s,$labels[$s])) . '</option>';
          } ?>
        </select></label>
      </div>
      <p class="small muted"><?php echo malendo_text('Include at least an email address or a phone number.','Укажите email или номер телефона.'); ?></p>
      <label><?php echo malendo_text('How can Malendo help?','Чем Malendo может помочь?'); ?> <span>*</span><textarea name="message" rows="6" maxlength="2500" minlength="10" required placeholder="<?php echo esc_attr(malendo_text('Property area, type, budget or management needs, and timeline','Район, тип объекта, бюджет или задачи управления и желаемые сроки')); ?>"></textarea></label>
      <label class="form-consent"><input type="checkbox" name="consent" value="yes" required> <?php echo malendo_text('I agree that Malendo Property may store my contact details and enquiry to respond, as described in the','Я разрешаю Malendo Property хранить мои контактные данные и обращение для ответа в соответствии с'); ?> <a href="<?php echo esc_url(malendo_local_url('/privacy-policy/')); ?>" target="_blank" rel="noopener"><?php echo malendo_text('privacy policy','политикой конфиденциальности'); ?></a>. <?php echo malendo_text('I will not submit passwords or sensitive identity documents.','Я не буду отправлять пароли и конфиденциальные документы.'); ?></label>
      <button class="button" type="submit"><?php echo malendo_text('Send enquiry','Отправить запрос'); ?></button>
      <p class="small muted"><?php echo malendo_text("Your enquiry is stored securely for Malendo's staff. Response times are not guaranteed. No purchase or booking is made through this form.","Обращение хранится в закрытом разделе для сотрудников Malendo. Срок ответа не гарантируется. Отправка формы не является покупкой или бронированием."); ?></p>
    </form>
    <?php
    return (string)ob_get_clean();
});

add_action('add_meta_boxes_malendo_lead', static function (): void {
    add_meta_box('malendo_lead_details', 'Enquiry details', static function ($post): void {
        foreach (array('name'=>'Name', 'email'=>'Email', 'phone'=>'Phone/WhatsApp',
                       'service'=>'Service','message'=>'Message', 'locale'=>'Language', 'landing'=>'Form URL',
                       'consented_at'=>'Consent UTC') as $key => $label) {
            echo '<p><strong>' . esc_html($label) . ':</strong></p><p style="white-space:pre-wrap;word-break:break-word">' .
                esc_html((string)get_post_meta($post->ID, '_malendo_'.$key, true)) . '</p>';
        }
    }, 'malendo_lead', 'normal', 'high');
});
add_filter('manage_malendo_lead_posts_columns', static function (array $cols): array {
    return array('cb'=>$cols['cb'], 'title'=>'Enquiry', 'lead_service'=>'Service', 'lead_contact'=>'Contact', 'date'=>'Date');
});
add_action('manage_malendo_lead_posts_custom_column', static function (string $column, int $id): void {
    if ($column === 'lead_service') {
        echo esc_html((string)get_post_meta($id,'_malendo_service',true));
    }
    if ($column === 'lead_contact') {
        echo esc_html((string)get_post_meta($id,'_malendo_email',true) . ' ' . (string)get_post_meta($id,'_malendo_phone',true));
    }
}, 10, 2);
