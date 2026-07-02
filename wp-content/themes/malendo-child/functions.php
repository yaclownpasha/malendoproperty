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
        'js-cookie',
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
