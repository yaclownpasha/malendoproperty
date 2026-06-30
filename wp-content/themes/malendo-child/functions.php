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
