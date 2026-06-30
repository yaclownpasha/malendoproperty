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
