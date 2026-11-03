<!doctype html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo('charset'); ?>">
<meta name="viewport" content="width=device-width, initial-scale=1">
<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>

<header class="site-header">
  <div class="container header-inner">
    <a class="brand" href="<?php echo esc_url(malendo_local_url('/')); ?>" aria-label="<?php echo esc_attr(malendo_text('Malendo Property home','Главная Malendo Property')); ?>">
      <span class="brand-main">MALENDO</span><span class="brand-sub">PROPERTY · PHUKET</span>
    </a>
    <nav class="main-nav" aria-label="<?php echo esc_attr(malendo_text('Main navigation','Основное меню')); ?>">
      <a href="<?php echo esc_url(malendo_local_url('/thailand/phuket/services/property-management/')); ?>"><?php echo malendo_text('Management','Управление'); ?></a>
      <a href="<?php echo esc_url(malendo_local_url('/properties/')); ?>"><?php echo malendo_text('Rent &amp; Buy','Аренда и покупка'); ?></a>
      <a href="<?php echo esc_url(malendo_local_url('/request-phuket-project-check/')); ?>"><?php echo malendo_text('Project Checks','Проверка проектов'); ?></a>
      <a href="<?php echo esc_url(malendo_local_url('/about-us/')); ?>"><?php echo malendo_text('About','О компании (EN)'); ?></a>
      <a class="nav-cta" href="<?php echo esc_url(malendo_local_url('/contact/')); ?>"><?php echo malendo_text('Contact us','Контакты'); ?></a>
      <?php malendo_language_links(); ?>
    </nav>
  </div>
</header>
