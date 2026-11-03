<?php get_header(); ?>
<section class="inner-hero"><div class="container"><p class="eyebrow">Malendo Property</p><h1><?php echo esc_html(is_home() ? 'Updates' : get_the_archive_title()); ?></h1></div></section>
<main id="main" class="container page-section">
<?php if (have_posts()) : while (have_posts()) : the_post(); ?>
<article class="entry-content"><h2><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h2><?php the_excerpt(); ?></article>
<?php endwhile; the_posts_pagination(); else: ?>
<p>Nothing published in this section yet.</p>
<?php endif; ?>
</main><?php get_footer(); ?>
