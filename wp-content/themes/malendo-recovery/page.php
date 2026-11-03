<?php
if (malendo_is_ru() && (int)get_post_meta(get_queried_object_id(), '_malendo_translation_source_id', true) === (int)get_option('page_on_front')) {
    get_template_part('front-page');
    return;
}
get_header(); ?>
<?php while (have_posts()) : the_post(); ?>
<section class="inner-hero"><div class="container"><p class="eyebrow">Malendo Property · Phuket</p><h1><?php the_title(); ?></h1></div></section>
<main id="main" class="container page-section">
  <article <?php post_class('entry-content'); ?>>
    <?php the_content(); ?>
  </article>
</main>
<?php endwhile; ?>
<?php get_footer(); ?>
