<footer class="footer">
  <div class="container">
    <div class="footer-grid">
      <div>
        <a class="brand" href="<?php echo esc_url(malendo_local_url('/')); ?>"><span class="brand-main">MALENDO</span><span class="brand-sub">PROPERTY · PHUKET</span></a>
        <p><?php echo malendo_text('Phuket property management, owner services, rentals, buying and evidence-led project checks.','Управление недвижимостью на Пхукете, помощь владельцам, аренда, покупка и проверка проектов по источникам.'); ?></p>
      </div>
      <div>
        <h3><?php echo malendo_text('Services','Услуги'); ?></h3>
        <nav class="footer-links" aria-label="Footer services">
          <a href="<?php echo esc_url(malendo_local_url('/thailand/phuket/services/property-management/')); ?>"><?php echo malendo_text('Property management','Управление недвижимостью'); ?></a>
          <a href="<?php echo esc_url(malendo_local_url(malendo_is_ru() ? '/properties/' : '/rent-property/rent-apartment/')); ?>"><?php echo malendo_text('Renting in Phuket','Аренда на Пхукете'); ?></a>
          <a href="<?php echo esc_url(malendo_local_url(malendo_is_ru() ? '/properties/' : '/sell-property/sell-apartment/')); ?>"><?php echo malendo_text('Buying in Phuket','Покупка на Пхукете'); ?></a>
          <a href="<?php echo esc_url(malendo_local_url('/request-phuket-project-check/')); ?>"><?php echo malendo_text('Project verification','Проверка проектов'); ?></a>
        </nav>
      </div>
      <div>
        <h3><?php echo malendo_text('Connect','Связаться'); ?></h3>
        <nav class="footer-links" aria-label="Footer contact">
          <a href="<?php echo esc_url(malendo_local_url('/contact/')); ?>"><?php echo malendo_text('Contact page','Контакты'); ?></a>
          <a href="<?php echo esc_url(malendo_local_url('/submit-your-application/')); ?>"><?php echo malendo_text('Submit your property','Предложить объект'); ?></a>
          <a href="mailto:malendophuket@gmail.com">malendophuket@gmail.com</a>
        </nav>
      </div>
    </div>
    <div class="footnote">© <?php echo esc_html(wp_date('Y')); ?> <?php echo malendo_text('Malendo Property. Property details and availability are subject to verification. Project checks are public-source research, not legal, engineering or investment advice.','Malendo Property. Характеристики и наличие объектов требуют проверки. Проверка проектов — исследование открытых источников, а не юридическая, инженерная или инвестиционная консультация.'); ?></div>
  </div>
</footer>
<?php wp_footer(); ?>
</body>
</html>
