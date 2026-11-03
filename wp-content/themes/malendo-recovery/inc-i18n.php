<?php
/** Malendo EN/RU page pairs. No external translation service or analytics calls. */
if (!defined('ABSPATH')) { exit; }
function malendo_is_ru(): bool {
    return is_singular('page') && get_post_meta(get_queried_object_id(), '_malendo_locale', true) === 'ru_RU';
}
function malendo_text(string $en, string $ru): string { return malendo_is_ru() ? $ru : $en; }
function malendo_translation_id(int $en_id): int {
    $ids = get_posts(array('post_type'=>'page', 'post_status'=>array('publish','draft'), 'numberposts'=>2,
        'fields'=>'ids', 'meta_query'=>array(
            array('key'=>'_malendo_translation_source_id','value'=>$en_id),
            array('key'=>'_malendo_locale','value'=>'ru_RU'))));
    return count($ids) === 1 ? (int)$ids[0] : 0;
}
function malendo_page_url(int $id): string {
    if (get_post_status($id) === 'publish') { return get_permalink($id); }
    if (is_preview() && current_user_can('edit_post', $id)) { return get_preview_post_link($id); }
    return '';
}
function malendo_local_url(string $path): string {
    if (!malendo_is_ru()) { return home_url($path); }
    $en = $path === '/' ? get_post((int)get_option('page_on_front')) : get_page_by_path(trim($path,'/'));
    $ru_id = $en ? malendo_translation_id((int)$en->ID) : 0;
    $url = $ru_id ? malendo_page_url($ru_id) : '';
    return $url ?: home_url($path);
}
function malendo_language_links(): void {
    if (!is_singular('page')) { return; }
    $id = get_queried_object_id();
    $en = malendo_is_ru() ? (int)get_post_meta($id,'_malendo_translation_source_id',true) : $id;
    $ru = malendo_translation_id($en);
    if (!$ru || !malendo_page_url($ru)) { return; }
    echo '<span class="language-links" aria-label="Language / Язык"><a lang="en" href="'.esc_url(get_permalink($en)).'">EN</a> / <a lang="ru" href="'.esc_url(malendo_page_url($ru)).'">RU</a></span>';
}
add_filter('language_attributes', static function (string $attrs): string {
    return malendo_is_ru() ? 'lang="ru-RU"' : $attrs;
});
add_filter('wp_robots', static function (array $robots): array {
    if (is_preview()) {
        unset($robots['index'], $robots['follow']);
        $robots['noindex'] = true;
        $robots['nofollow'] = true;
    }
    return $robots;
});
add_filter('the_content', static function (string $content): string {
    if (!malendo_is_ru() || !is_preview() || !current_user_can('edit_post', get_queried_object_id())) { return $content; }
    return preg_replace_callback('~href="(/ru/[^"?#]*)"~', static function (array $m): string {
        $page = get_page_by_path(trim($m[1], '/'));
        $url = $page ? malendo_page_url((int)$page->ID) : '';
        return $url ? 'href="'.esc_url($url).'"' : $m[0];
    }, $content);
}, 12);
add_action('wp_head', static function (): void {
    if (!is_singular('page') || is_preview()) { return; }
    $id=get_queried_object_id();
    $en=malendo_is_ru() ? (int)get_post_meta($id,'_malendo_translation_source_id',true) : $id;
    $ru=malendo_translation_id($en);
    if (!$ru || get_post_status($en)!=='publish' || get_post_status($ru)!=='publish') { return; }
    foreach (array('en'=>$en,'ru'=>$ru,'x-default'=>$en) as $lang=>$page) {
        echo '<link rel="alternate" hreflang="'.esc_attr($lang).'" href="'.esc_url(get_permalink($page)).'">'."\n";
    }
}, 2);
