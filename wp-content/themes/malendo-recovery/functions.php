<?php
if (!defined('ABSPATH')) { exit; }
add_action('after_setup_theme', function () {
    add_theme_support('title-tag');
    add_theme_support('post-thumbnails');
    add_theme_support('html5', array('search-form','comment-form','comment-list','gallery','caption','style','script'));
});
add_action('wp_enqueue_scripts', function () {
    wp_enqueue_style('malendo-recovery-style', get_stylesheet_uri(), array(), '0.1.0');
});
add_action('wp_head', function () {
    if (!is_singular('page')) { return; }
    $description = get_post_meta(get_queried_object_id(), '_malendo_meta_description', true);
    if (is_string($description) && $description !== '') {
        echo '<meta name="description" content="' . esc_attr($description) . '">' . "\n";
    }
}, 1);
add_filter('xmlrpc_enabled', '__return_false');

require_once __DIR__ . '/inc-i18n.php';
require_once __DIR__ . '/inc-notifications.php';
require_once __DIR__ . '/inc-leads.php';
require_once __DIR__ . '/inc-analytics.php';
