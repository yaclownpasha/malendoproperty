<?php
defined('ABSPATH') || exit;

add_action('wp_enqueue_scripts', function () {
    wp_enqueue_style(
        'malendo-child-style',
        get_stylesheet_uri(),
        [],
        wp_get_theme()->get('Version')
    );

    wp_enqueue_script(
        'malendo-lead-events',
        get_stylesheet_directory_uri() . '/assets/js/lead-events.js',
        [],
        wp_get_theme()->get('Version'),
        true
    );
}, 20);

function malendo_dequeue_woocommerce_assets_on_non_woo_pages() {
    if (
        is_admin() ||
        (function_exists('wp_doing_ajax') && wp_doing_ajax()) ||
        (defined('REST_REQUEST') && REST_REQUEST) ||
        (defined('WP_CLI') && WP_CLI) ||
        (function_exists('wp_is_json_request') && wp_is_json_request())
    ) {
        return;
    }

    if (!function_exists('is_woocommerce')) {
        return;
    }

    $woocommerce_page_checks = [
        'is_woocommerce',
        'is_shop',
        'is_cart',
        'is_checkout',
        'is_account_page',
        'is_product',
        'is_product_category',
        'is_product_tag',
        'is_product_taxonomy',
        'is_wc_endpoint_url',
    ];

    foreach ($woocommerce_page_checks as $woocommerce_page_check) {
        if (function_exists($woocommerce_page_check) && $woocommerce_page_check()) {
            return;
        }
    }

    if (function_exists('is_tax') && is_tax(['product_cat', 'product_tag'])) {
        return;
    }

    // Performance safety patch: remove this block to rollback. It only strips WooCommerce frontend assets on clearly non-WooCommerce pages.
    $woocommerce_style_handles = [
        'woocommerce-general',
        'woocommerce-layout',
        'woocommerce-smallscreen',
        'woocommerce-inline',
        'wc-blocks-style',
        'wc-blocks-vendors-style',
        'wc-blocks-packages-style',
        'wc-blocks-style-all-products',
        'wc-blocks-style-all-reviews',
    ];

    $woocommerce_script_handles = [
        'woocommerce',
        'wc-add-to-cart',
        'wc-cart-fragments',
        'wc-add-to-cart-variation',
        'wc-js-cookie',
        'wc-jquery-blockui',
        'sourcebuster-js',
        'wc-order-attribution',
    ];

    foreach ($woocommerce_style_handles as $woocommerce_style_handle) {
        wp_dequeue_style($woocommerce_style_handle);
        wp_deregister_style($woocommerce_style_handle);
    }

    foreach ($woocommerce_script_handles as $woocommerce_script_handle) {
        wp_dequeue_script($woocommerce_script_handle);
        wp_deregister_script($woocommerce_script_handle);
    }
}
add_action('wp_enqueue_scripts', 'malendo_dequeue_woocommerce_assets_on_non_woo_pages', 99);

function malendo_dequeue_cf7_assets_on_non_form_pages() {
    if (
        is_admin() ||
        (function_exists('wp_doing_ajax') && wp_doing_ajax()) ||
        (defined('REST_REQUEST') && REST_REQUEST) ||
        (defined('WP_CLI') && WP_CLI) ||
        (function_exists('wp_is_json_request') && wp_is_json_request()) ||
        (function_exists('is_feed') && is_feed())
    ) {
        return;
    }

    $request_method = isset($_SERVER['REQUEST_METHOD']) ? strtoupper((string) $_SERVER['REQUEST_METHOD']) : '';

    if ($request_method === 'HEAD') {
        return;
    }

    if (function_exists('is_page') && is_page(['contact', 'submit-your-application'])) {
        return;
    }

    if (function_exists('is_front_page') && is_front_page()) {
        return;
    }

    $raw_request_path = isset($_SERVER['REQUEST_URI']) ? (string) wp_parse_url((string) $_SERVER['REQUEST_URI'], PHP_URL_PATH) : '';
    $request_path = untrailingslashit($raw_request_path);

    // /properties/ was verified as a non-CF7 archive; keep this exception narrow so other uncertain archives stay protected.
    $is_verified_non_cf7_archive = in_array($raw_request_path, ['/properties', '/properties/'], true);

    if (in_array($request_path, ['/contact', '/submit-your-application'], true)) {
        return;
    }

    if (function_exists('is_singular') && is_singular('estate')) {
        return;
    }

    if (!$is_verified_non_cf7_archive) {
        $queried_object = function_exists('get_queried_object') ? get_queried_object() : null;

        if (!$queried_object instanceof WP_Post) {
            return;
        }

        $post_content = (string) $queried_object->post_content;

        if (
            (function_exists('has_shortcode') && has_shortcode($post_content, 'contact-form-7')) ||
            stripos($post_content, '[contact-form-7') !== false ||
            stripos($post_content, 'wpcf7') !== false
        ) {
            return;
        }
    }

    // Performance safety patch: remove this block to rollback. It only strips Contact Form 7 assets from pages with no detected CF7 form.
    $cf7_style_handles = [
        'contact-form-7',
        'wpcf7',
        'wpcf7-recaptcha',
        'swv',
    ];

    $cf7_script_handles = [
        'contact-form-7',
        'wpcf7',
        'wpcf7-recaptcha',
        'swv',
    ];

    foreach ($cf7_style_handles as $cf7_style_handle) {
        wp_dequeue_style($cf7_style_handle);
        wp_deregister_style($cf7_style_handle);
    }

    foreach ($cf7_script_handles as $cf7_script_handle) {
        wp_dequeue_script($cf7_script_handle);
        wp_deregister_script($cf7_script_handle);
    }
}
add_action('wp_enqueue_scripts', 'malendo_dequeue_cf7_assets_on_non_form_pages', 100);

add_action('wp_head', function () {
    ?>
    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-D99Y7TY0LC"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());

      gtag('config', 'G-D99Y7TY0LC');
    </script>
    <?php
}, 1);

add_filter('rest_endpoints', function ($endpoints) {
    if (is_user_logged_in()) {
        return $endpoints;
    }

    unset($endpoints['/wp/v2/users']);
    unset($endpoints['/wp/v2/users/(?P<id>[\\d]+)']);

    return $endpoints;
});

add_filter('wp_robots', function ($robots) {
    if (is_author()) {
        $robots['noindex'] = true;
        $robots['follow'] = true;

        unset($robots['index']);
    }

    return $robots;
});

add_action('template_redirect', function () {
    if (
        is_admin() ||
        wp_doing_ajax() ||
        is_feed() ||
        (defined('REST_REQUEST') && REST_REQUEST) ||
        (defined('WP_CLI') && WP_CLI) ||
        (function_exists('wp_is_json_request') && wp_is_json_request())
    ) {
        return;
    }

    $request_method = isset($_SERVER['REQUEST_METHOD']) ? strtoupper((string) $_SERVER['REQUEST_METHOD']) : '';

    if ($request_method === 'HEAD') {
        return;
    }

    $accept = isset($_SERVER['HTTP_ACCEPT']) ? (string) $_SERVER['HTTP_ACCEPT'] : '';

    if ($accept !== '' && stripos($accept, 'text/html') === false && stripos($accept, '*/*') === false) {
        return;
    }

    ob_start(function ($html) {
        if (!is_string($html) || $html === '') {
            return $html;
        }

        // Temporary safety patch until the bad WP admin/MyHome menu URL is fixed at the source.
        return str_replace(
            [
                'https://malendo.property/submit-your-application/',
                'http://malendo.property/submit-your-application/',
            ],
            'https://malendo-property.com/submit-your-application/',
            $html
        );
    });
}, 0);

function malendo_verification_content_shortcode_tags() {
    return [
        'malendo_verification_box',
        'malendo_last_checked',
        'malendo_verification_disclaimer',
        'malendo_verification_cta',
        'malendo_verification_toc',
    ];
}

function malendo_page_has_verification_content_shortcode() {
    if (!function_exists('is_singular') || !is_singular('page')) {
        return false;
    }

    $page = get_queried_object();

    if (!$page instanceof WP_Post) {
        return false;
    }

    $content = (string) $page->post_content;

    foreach (malendo_verification_content_shortcode_tags() as $shortcode_tag) {
        if (has_shortcode($content, $shortcode_tag)) {
            return true;
        }
    }

    return false;
}

function malendo_enqueue_verification_content_assets() {
    if (
        is_admin() ||
        (function_exists('wp_doing_ajax') && wp_doing_ajax()) ||
        (defined('REST_REQUEST') && REST_REQUEST) ||
        (defined('WP_CLI') && WP_CLI) ||
        (function_exists('wp_is_json_request') && wp_is_json_request()) ||
        !malendo_page_has_verification_content_shortcode()
    ) {
        return;
    }

    $theme_version = wp_get_theme()->get('Version');

    wp_enqueue_style(
        'malendo-verification-content',
        get_stylesheet_directory_uri() . '/assets/css/verification-content.css',
        [],
        $theme_version
    );

    wp_enqueue_script(
        'malendo-verification-content',
        get_stylesheet_directory_uri() . '/assets/js/verification-content.js',
        [],
        $theme_version,
        true
    );
}
add_action('wp_enqueue_scripts', 'malendo_enqueue_verification_content_assets', 30);

function malendo_verification_box_shortcode($attributes, $content = '') {
    $types = [
        'verified' => 'Verified',
        'developer-claim' => 'Developer claim',
        'public-report' => 'Public report',
        'inconsistency' => 'Inconsistency to check',
        'unknown' => 'Unknown',
        'buyer-question' => 'Buyer question',
    ];
    $attributes = shortcode_atts(
        [
            'type' => 'unknown',
            'title' => '',
        ],
        $attributes,
        'malendo_verification_box'
    );
    $type = sanitize_key((string) $attributes['type']);

    if (!isset($types[$type])) {
        $type = 'unknown';
    }

    $title = trim(wp_strip_all_tags((string) $attributes['title']));

    if ($title === '') {
        $title = $types[$type];
    }

    $body = wp_kses_post(do_shortcode(wpautop((string) $content)));
    $accessible_label = sprintf('%s: %s', $types[$type], $title);

    return sprintf(
        '<section class="malendo-verification-box malendo-verification-box--%1$s" role="note" aria-label="%2$s"><p class="malendo-verification-box__status">%3$s</p><p class="malendo-verification-box__title">%4$s</p><div class="malendo-verification-box__content">%5$s</div></section>',
        esc_attr($type),
        esc_attr($accessible_label),
        esc_html($types[$type]),
        esc_html($title),
        $body
    );
}

function malendo_last_checked_shortcode($attributes) {
    $attributes = shortcode_atts(
        [
            'date' => '',
        ],
        $attributes,
        'malendo_last_checked'
    );
    $date_value = trim((string) $attributes['date']);
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $date_value);
    $date_errors = DateTimeImmutable::getLastErrors();

    if (
        !$date ||
        ($date_errors !== false && ($date_errors['warning_count'] > 0 || $date_errors['error_count'] > 0)) ||
        $date->format('Y-m-d') !== $date_value
    ) {
        return '';
    }

    return sprintf(
        '<p class="malendo-last-checked"><span class="malendo-last-checked__label">%1$s</span> <time datetime="%2$s">%3$s</time></p>',
        esc_html__('Last checked:', 'malendo-child'),
        esc_attr($date_value),
        esc_html($date->format('j F Y'))
    );
}

function malendo_verification_disclaimer_shortcode($attributes) {
    $default_text = 'Public-source research only. This page is not legal, tax, financial or investment advice. Buyers should verify documents with qualified Thai legal and professional advisers.';
    $attributes = shortcode_atts(
        [
            'text' => $default_text,
        ],
        $attributes,
        'malendo_verification_disclaimer'
    );
    $text = trim(sanitize_text_field((string) $attributes['text']));

    if ($text === '') {
        $text = $default_text;
    }

    return sprintf(
        '<aside class="malendo-verification-disclaimer" role="note" aria-label="%1$s"><p>%2$s</p></aside>',
        esc_attr__('Verification disclaimer', 'malendo-child'),
        esc_html($text)
    );
}

function malendo_verification_internal_url($url) {
    $url = trim((string) $url);

    if ($url === '') {
        return '';
    }

    if (strpos($url, '/') === 0 && strpos($url, '//') !== 0) {
        $url = home_url($url);
    } else {
        $url = esc_url_raw($url, ['http', 'https']);
    }

    if ($url === '') {
        return '';
    }

    $url = wp_validate_redirect($url, '');

    if ($url === '') {
        return '';
    }

    $home_host = strtolower((string) wp_parse_url(home_url('/'), PHP_URL_HOST));
    $url_host = strtolower((string) wp_parse_url($url, PHP_URL_HOST));

    if ($url_host === '' || $url_host !== $home_host) {
        return '';
    }

    return $url;
}

function malendo_verification_cta_shortcode($attributes) {
    $types = [
        'project-check' => 'Request a Project Check',
        'developer-check' => 'Request a Developer Check',
        'current-availability' => 'Check Current Availability',
        'send-documents' => 'Send Project Documents',
        'compare-projects' => 'Compare Projects',
    ];
    $attributes = shortcode_atts(
        [
            'type' => '',
            'url' => '',
            'label' => '',
        ],
        $attributes,
        'malendo_verification_cta'
    );
    $type = sanitize_key((string) $attributes['type']);

    if (!isset($types[$type])) {
        return '';
    }

    $url = malendo_verification_internal_url($attributes['url']);

    if ($url === '') {
        return '';
    }

    $label = trim(wp_strip_all_tags((string) $attributes['label']));

    if ($label === '') {
        $label = $types[$type];
    }

    return sprintf(
        '<div class="malendo-verification-cta-wrap"><a class="malendo-verification-cta malendo-verification-cta--%1$s" href="%2$s" data-malendo-verification-cta="%1$s">%3$s</a></div>',
        esc_attr($type),
        esc_url($url),
        esc_html($label)
    );
}

function malendo_verification_toc_shortcode() {
    return sprintf(
        '<nav class="malendo-verification-toc" data-malendo-verification-toc aria-label="%1$s" hidden><p class="malendo-verification-toc__title">%2$s</p><ol class="malendo-verification-toc__list" data-malendo-verification-toc-list></ol></nav>',
        esc_attr__('Table of contents', 'malendo-child'),
        esc_html__('On this page', 'malendo-child')
    );
}

function malendo_register_verification_content_shortcodes() {
    add_shortcode('malendo_verification_box', 'malendo_verification_box_shortcode');
    add_shortcode('malendo_last_checked', 'malendo_last_checked_shortcode');
    add_shortcode('malendo_verification_disclaimer', 'malendo_verification_disclaimer_shortcode');
    add_shortcode('malendo_verification_cta', 'malendo_verification_cta_shortcode');
    add_shortcode('malendo_verification_toc', 'malendo_verification_toc_shortcode');
}
add_action('init', 'malendo_register_verification_content_shortcodes');
