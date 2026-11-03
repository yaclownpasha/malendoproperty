(function () {
  'use strict';
  var configNode = document.getElementById('malendo-analytics-config');
  if (!configNode) return;
  var config = JSON.parse(configNode.textContent);
  if (config.measurementId !== 'G-D99Y7TY0LC') return;
  var banner = document.getElementById('malendo-consent');
  var allow = document.getElementById('malendo-consent-allow');
  var deny = document.getElementById('malendo-consent-deny');
  var preferences = document.getElementById('malendo-analytics-preferences');
  var started = false, pageSent = false, receiptSent = false, formStarted = false;
  var choice = (document.cookie.match(/(?:^|;\s*)malendo_analytics_choice=(allow|deny)(?:;|$)/) || [])[1] || '';
  var id = config.measurementId;
  var permittedHost = location.hostname === 'malendo-property.com';
  var dryRun = config.qa || !permittedHost;
  function safePage() { return location.origin + location.pathname; }
  function gtag() { window.dataLayer.push(arguments); }
  function event(name, parameters) {
    if (choice !== 'allow' || dryRun || !started) return;
    gtag('event', name, Object.assign({send_to:id,business:'malendo',locale:config.locale,page_location:safePage()},parameters || {}));
  }
  function start() {
    if (choice !== 'allow' || dryRun) return;
    window['ga-disable-' + id] = false;
    if (!started) {
      started = true;
      window.dataLayer = window.dataLayer || [];
      window.gtag = gtag;
      gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
      gtag('consent','update',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
      gtag('js',new Date());
      gtag('set',{allow_google_signals:false,allow_ad_personalization_signals:false});
      gtag('config',id,{send_page_view:false,cookie_prefix:'malendo_ga',cookie_domain:location.hostname,
        page_location:safePage(),page_referrer:document.referrer ? document.referrer.split(/[?#]/)[0] : '',
        allow_google_signals:false,allow_ad_personalization_signals:false});
      var tag = document.createElement('script');
      tag.async = true;
      tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
      tag.id = 'malendo-google-tag';
      document.head.appendChild(tag);
    } else {
      gtag('consent','update',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
    }
    if (!pageSent) { pageSent = true; event('page_view'); }
    if (config.receipt && !receiptSent) {
      receiptSent = true;
      event('malendo_enquiry_saved',{service:config.receipt.service,locale:config.receipt.locale});
    }
  }
  function save(value) {
    choice = value;
    document.cookie = 'malendo_analytics_choice=' + value + '; Max-Age=15552000; Path=/; SameSite=Lax; Secure';
    banner.hidden = true;
    if (value === 'allow') { start(); return; }
    window['ga-disable-' + id] = true;
    if (started) gtag('consent','update',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
    document.cookie.split(';').forEach(function (entry) {
      var name = entry.trim().split('=')[0];
      if (!name.startsWith('malendo_ga')) return;
      document.cookie = name + '=; Max-Age=0; Path=/; Secure; SameSite=Lax';
      document.cookie = name + '=; Max-Age=0; Path=/; Domain=' + location.hostname + '; Secure; SameSite=Lax';
    });
  }
  allow.addEventListener('click',function () { save('allow'); });
  deny.addEventListener('click',function () { save('deny'); });
  preferences.addEventListener('click',function () { banner.hidden=false; deny.focus(); });
  banner.hidden = choice !== '';
  document.addEventListener('focusin',function (e) {
    if (formStarted || choice !== 'allow' || !e.target.closest('.malendo-form')) return;
    formStarted=true;
    event('malendo_form_start');
  });
  document.addEventListener('click',function (e) {
    var a=e.target.closest('a[href]');
    if (!a) return;
    var method=a.href.startsWith('https://wa.me/') ? 'whatsapp' : a.href.startsWith('mailto:') ? 'email' : '';
    if (method) event('malendo_contact_click',{contact_method:method});
  });
  start();
})();
