# Malendo Performance Optimization Plan

## Purpose

This document turns the live technical audit findings into a practical performance plan for `https://malendo-property.com`.

This is a planning document only. It does not implement asset dequeues, plugin changes, WordPress content changes, theme edits, deploy changes, or server changes.

Source context:

- PR #21 added a read-only technical audit script.
- First audit run found `0` P0 safety findings, `3` P1 SEO/indexation findings, `43` P2 conversion/content findings, and `16` P3 performance/asset findings.
- Sampled pages show heavy global plugin assets, a large homepage image around `707 KB`, and repeated assets from MyHome, WPBakery, WooCommerce, Contact Form 7, RevSlider, Chaty, GTranslate, Font Awesome, Google/Yandex analytics, and one Easy Social Share Buttons fingerprint.

## Executive Summary

What is likely slowing the site:

- Many plugin and theme assets load on every sampled page, even pages that may not need all of them.
- WooCommerce assets appear on all sampled commercial pages, including non-product pages.
- Contact Form 7 assets appear globally, including pages where the business value of form functionality should be confirmed.
- RevSlider assets appear globally and are usually expensive relative to business value unless the page actively uses sliders.
- Multiple icon/font libraries appear, including Font Awesome from more than one source.
- Third-party scripts and domains appear on all sampled pages: Google, Yandex, GTranslate, social domains, and cookie/consent-related domains.
- The homepage references a large image around `707 KB`: `https://malendo-property.com/wp-content/uploads/2023/08/IMG_4657-scaled.jpeg`.

What is safe to optimize first:

- Optimize and replace oversized images in WordPress media/admin workflows.
- Review plugin settings before code. Disable unused modules inside plugins where possible.
- Review RevSlider, Easy Social Share Buttons, Chaty, GTranslate, CookieYes/Complianz, and WooCommerce loading settings.
- Review WooCommerce product/indexation strategy before deciding whether WooCommerce assets need to stay on non-shop pages.
- Run the live QA and technical audit before and after every change.

What is risky to touch:

- MyHome parent theme assets, because they may control search, listing cards, maps, filters, layouts, and responsive behavior.
- WPBakery assets globally, because commercial pages may be built with WPBakery shortcodes or modules.
- WooCommerce assets globally, because product/category pages and order attribution may depend on them.
- Contact Form 7 assets globally, because forms, recaptcha, redirects, and phone input widgets may depend on them.
- Any broad combine/minify/defer setting without visual QA and console checks.

## Asset Inventory

Sampled live pages from the current audit:

| Page | CSS | JS | Images | Large Image Candidates | Third-Party Domains | Plugin/Theme Fingerprints |
| --- | ---: | ---: | ---: | --- | --- | --- |
| `/` | 25 | 33 | 9 | `IMG_4657-scaled.jpeg` 707 KB; `pexels-jimmy-teoh...scaled.jpg` 528 KB; related responsive versions 350 KB / 205 KB / 98 KB | `cdn.gtranslate.net`, `cdnjs.cloudflare.com`, `cookiedatabase.org`, `facebook.com`, `fonts.googleapis.com`, `google.com`, `googletagmanager.com`, `instagram.com`, `mc.yandex.ru`, `t.me` | MyHome, WPBakery, WooCommerce, Contact Form 7, RevSlider, Chaty, GTranslate, Font Awesome, GA/gtag, Yandex |
| `/contact/` | 25 | 33 | 2 | `logo-2.png` 68 KB; Yandex tracking gif | same as homepage | MyHome, WPBakery, WooCommerce, Contact Form 7, RevSlider, Chaty, GTranslate, Font Awesome, GA/gtag, Yandex |
| `/submit-your-application/` | 25 | 33 | 2 | `logo-2.png` 68 KB; Yandex tracking gif | same as homepage | MyHome, WPBakery, WooCommerce, Contact Form 7, RevSlider, Chaty, GTranslate, Font Awesome, GA/gtag, Yandex |
| `/properties/` | 23 | 30 | 2 | `logo-2.png` 68 KB; Yandex tracking gif | same as homepage | MyHome, WPBakery fingerprint, WooCommerce, Contact Form 7, RevSlider, Easy Social Share Buttons fingerprint, Chaty, GTranslate, Font Awesome, GA/gtag, Yandex |
| `/rent-property/rent-villas/` | 24 | 31 | 10 | two `300x300` PNG listing thumbnails around 126 KB and 114 KB; `logo-2.png` 68 KB | same as homepage | MyHome, WPBakery, WooCommerce, Contact Form 7, RevSlider, Chaty, GTranslate, Font Awesome, GA/gtag, Yandex |
| `/rent-property/rent-apartment/` | 24 | 31 | 10 | two `300x300` PNG listing thumbnails around 126 KB and 114 KB; `logo-2.png` 68 KB | same as homepage | MyHome, WPBakery, WooCommerce, Contact Form 7, RevSlider, Chaty, GTranslate, Font Awesome, GA/gtag, Yandex |
| `/sell-property/sell-apartment/` | 24 | 31 | 10 | two `300x300` PNG listing thumbnails around 126 KB and 114 KB; `logo-2.png` 68 KB | same as homepage | MyHome, WPBakery, WooCommerce, Contact Form 7, RevSlider, Chaty, GTranslate, Font Awesome, GA/gtag, Yandex |
| `/thailand/phuket/services/property-management/` | 24 | 31 | 6 | `logo-2.png` 68 KB; Yandex tracking gif | same as homepage plus `malendo.property` legacy reference | MyHome, WPBakery, WooCommerce, Contact Form 7, RevSlider, Chaty, GTranslate, Font Awesome, GA/gtag, Yandex |

Notes:

- Counts are from live HTML and are approximate indicators, not full browser waterfall timings.
- The technical audit uses safe `GET` and `HEAD` requests only. It does not execute JavaScript or submit forms.
- The optional `scripts/audit-malendo-assets.mjs` was not added because PR #21's `scripts/audit-malendo-site.mjs` already provides enough asset data for this planning document.

## Plugin Asset Analysis

| Asset Group | Current Signal | Classification | Recommendation | Risk |
| --- | --- | --- | --- | --- |
| MyHome theme assets | Detected on all sampled pages, about 4 matching assets per page | Required globally or near-globally | Treat as core site functionality. Do not dequeue globally. Only consider highly targeted changes after visual QA on listings, search, filters, maps, and responsive layouts. | High |
| WPBakery assets | Detected on most sampled pages, usually 2 matching assets where active | Likely needed on pages built with WPBakery | Do not dequeue globally. If future code optimization is considered, first identify pages that do not use WPBakery markup/shortcodes. | High |
| WooCommerce assets | Detected on all sampled pages, about 10 matching assets per page | Likely only needed on product/shop/cart/checkout pages, but site has large product inventory | First decide WooCommerce product/indexation strategy. Later, consider conditional dequeue on clearly non-WooCommerce pages only after product, category, cart, checkout, and tracking QA. | Medium to high |
| Contact Form 7 assets | Detected on all sampled pages, 6 to 9 matching assets | Likely only needed on pages with forms, but global lead capture may depend on it | Review whether CF7 forms or recaptcha widgets are present on each page. Later, consider conditional loading only where forms exist. | Medium |
| RevSlider assets | Detected on all sampled pages, about 5 matching assets | Likely only needed where sliders are actively used | In WP admin/plugin settings, confirm where sliders are used. Disable global load if plugin offers a safe setting. Avoid code dequeue until visual QA confirms no slider dependency. | Medium |
| Easy Social Share Buttons assets | Fingerprint found on `/properties/` | Likely removable/disable in plugin settings if social sharing is not business-critical | Disable unused Pinterest/image sharing/social modules in plugin settings if not needed. This also relates to previous ESSB Pinterest console warnings. | Low to medium |
| Chaty assets | Detected on all sampled pages, about 2 matching assets | Potentially useful globally if chat/WhatsApp is a lead channel | Keep if it drives leads. If not, configure page targeting or delayed load in plugin settings. Do not remove without lead-flow review. | Medium |
| CookieYes / consent assets | Cookie/consent domains detected; CookieYes/Complianz behavior should be reviewed | Required for consent/legal behavior, but misconfiguration can add noise | Fix site URL/config warnings in plugin dashboard. Do not remove consent tooling without owner/legal approval. | Medium |
| GTranslate assets | Detected globally | Potentially useful if multilingual traffic converts | Confirm multilingual strategy and analytics. If unused, disable or page-target in plugin settings. | Medium |
| Font Awesome / icon libraries | Detected globally, including CDN Font Awesome sources | Likely some icons needed, but duplicate icon libraries may be wasteful | Inventory icon dependencies before changes. Prefer plugin/theme settings first. Avoid removing icons blindly because menus/social buttons/Chaty/MyHome may rely on them. | Medium |
| Google/Yandex/analytics scripts | GA/gtag and Yandex detected globally | Tracking is required for measurement, but every analytics tag has cost | Keep GA4. Confirm whether Yandex is still needed. Remove or disable unused analytics only after business approval. | Low to medium |

## Image Optimization Plan

Priority image candidates:

- Homepage: `https://malendo-property.com/wp-content/uploads/2023/08/IMG_4657-scaled.jpeg`, about `707 KB`.
- Homepage: `https://malendo-property.com/wp-content/uploads/2025/01/pexels-jimmy-teoh-294331-2402000-scaled.jpg`, about `528 KB`.
- Listing landing pages: several `300x300` PNG thumbnails around `114-126 KB`; check whether they can be JPEG/WebP/AVIF while preserving real-estate photo quality.
- Logo: `logo-2.png`, about `68 KB`; not urgent, but could be reviewed after larger images.

Target sizes:

- Hero image: usually under `250-350 KB` if visual quality remains strong.
- Content images: usually under `150-250 KB` where possible.
- Thumbnails: much smaller, often under `30-80 KB` depending on dimensions and quality.

Recommended approach:

- Use WebP and/or AVIF delivery where supported, with JPEG fallback.
- Preserve real-estate photo quality. Do not overcompress villa, condo, apartment, or property photos until they look cheap or blurry.
- Keep above-the-fold hero images eager if they are true LCP candidates. Do not lazy-load the main hero blindly.
- Lazy-load below-the-fold content/listing images where not already handled by WordPress/MyHome/lazysizes.
- Use properly sized responsive images rather than sending full-size uploads for small slots.
- Prefer WordPress media/plugin workflows over editing files directly in `wp-content/uploads`.

## Safe First Actions In WP Admin / Plugin Settings

1. Optimize the homepage large image around `707 KB` and any other homepage hero/background images above `350 KB`.
2. Confirm WebP/AVIF image delivery is enabled through the host/cache/image optimization stack, if available.
3. Review lazy loading behavior for listing thumbnails and below-the-fold content images.
4. Disable unused Easy Social Share Buttons modules, especially Pinterest/image sharing modules if they are not used.
5. Review whether RevSlider is actually used on the sampled landing pages. Disable global RevSlider asset loading if the plugin offers a safe setting.
6. Review WooCommerce product/indexation strategy. If products are not a primary SEO/business surface, reduce WooCommerce exposure through Yoast/admin first, then consider asset optimization later.
7. Review Chaty loading. Keep it if it drives WhatsApp/phone leads; otherwise test delayed loading or page targeting.
8. Review GTranslate. Keep it if multilingual traffic converts; otherwise consider disabling or page targeting.
9. Fix CookieYes/consent site URL/config warnings before performance tuning consent scripts.
10. Confirm Yandex analytics is still wanted. Remove unused analytics only after owner approval.

## Potential Codex/Git Actions Later

Do not do these yet. They should be considered only after WP-admin/plugin settings are reviewed and the owner confirms the business value of WooCommerce products, forms, chat, translation, and analytics.

| Action | Expected Benefit | Risk | Files Likely Touched | Validation Needed | Now Or Later |
| --- | --- | --- | --- | --- | --- |
| Conditional dequeue of WooCommerce assets on clearly non-product/non-shop pages | Fewer CSS/JS requests and less render-blocking work on landing pages | Can break product lists, cart, checkout, order attribution, product widgets, or imported product pages | `wp-content/themes/malendo-child/functions.php` or child-theme enqueue helper | Live QA, technical audit, product page, product category, cart/checkout if used, add-to-cart, console checks | Later |
| Conditional dequeue of Contact Form 7 assets on pages without forms | Less CSS/JS on landing/archive pages | Can break forms, recaptcha, redirects, phone inputs, or hidden lead widgets | `wp-content/themes/malendo-child/functions.php` or child-theme enqueue helper | Contact page, submit page, any estate inquiry form, safe form-attempt tracking, console checks | Later |
| Conditional dequeue of Easy Social Share Buttons assets if unused | Remove unused social/Pinterest overhead and reduce console-noise risk | Can remove social share UI if owner expects it | Child theme only if plugin settings cannot solve it | Properties archive, estate pages, console checks, social UI check | Later |
| Preload critical homepage hero image | May improve LCP if the image is the true LCP candidate | Can waste bandwidth if wrong image is preloaded or if mobile uses another asset | Child theme enqueue/head hook | Desktop/mobile waterfall, LCP candidate check, homepage visual QA | Later |
| Add resource hints for stable third-party origins | May reduce connection setup time for fonts/analytics/translation/chat | Can add noise or preconnect to unused domains | Child theme enqueue/head hook | Compare before/after with audit and browser waterfall | Later |
| Improve child-theme enqueue hygiene | Keeps child assets small, explicit, and cacheable | Low if limited to child-theme-owned assets | `wp-content/themes/malendo-child/functions.php`, child-theme assets | Live QA, lead tracking checks, no console errors | Later |
| Replace large image references after WP media optimization | Reduces image transfer size | Wrong crop/quality can hurt trust and conversion | Usually WP admin/media, not Git | Visual QA on desktop/mobile, image quality review | WP admin first |

Recommended next Codex PR, only if justified:

- After WP-admin/plugin settings are reviewed, the smallest useful Codex PR would likely be a targeted child-theme conditional dequeue experiment for one low-risk asset group on one page class.
- The first candidate should not be MyHome or WPBakery. A safer candidate may be Easy Social Share Buttons if plugin settings cannot disable unused modules, or Contact Form 7 only on pages proven to have no forms.
- WooCommerce should wait until the product/indexation strategy is decided in Google Search Console and WP admin.

## Do-Not-Do List

- Do not blindly combine or minify all JS/CSS.
- Do not dequeue MyHome globally.
- Do not dequeue WPBakery globally.
- Do not remove WooCommerce or WooCommerce assets without checking product/indexation strategy and product/category behavior.
- Do not lazy-load the above-the-fold hero blindly.
- Do not bulk delete products.
- Do not edit plugin files.
- Do not edit WordPress core.
- Do not edit the MyHome parent theme.
- Do not edit files in `wp-content/uploads` directly from Git.
- Do not remove analytics, Chaty, GTranslate, or consent tooling without owner approval.
- Do not use Git to mask a plugin setting problem that can be fixed safely in the plugin dashboard.

## Validation Plan For Future Performance PRs

Before any future performance PR is merged:

1. Run the live QA script:

```bash
node scripts/check-malendo-live.mjs --markdown
```

2. Run the technical audit from PR #21 if available:

```bash
node scripts/audit-malendo-site.mjs --markdown
```

3. Compare before/after asset counts for the changed page types.
4. Check homepage, contact page, submit application page, properties archive, one rent page, one sell page, one estate/listing page, one product page, and one product category page.
5. Check desktop and mobile visually.
6. Confirm header, footer, menus, search, listing cards, maps/filters if present, and CTAs still work.
7. Test phone, email, WhatsApp, Telegram, Contact, and Submit/Application links.
8. Test Contact Form 7 and submit/application form behavior only with safe/non-destructive form attempts.
9. Confirm GA4 `lead-events.js` still loads and lead events still fire where expected.
10. Confirm no new JS console errors if browser tooling is available.
11. Confirm no PHP warnings/fatals appear in HTML.
12. Clear cache and repeat smoke checks.

## Rollback Plan For Future Performance PRs

If a performance PR breaks layout, forms, search, listings, product pages, or lead tracking:

1. Stop merging additional PRs.
2. Revert the performance PR.
3. Redeploy through the approved GitHub Actions workflow.
4. Clear WordPress/server/cache-plugin cache.
5. Re-run live QA and the technical audit.
6. Capture affected URL, screenshot, first console error, and the changed asset group before investigating further.

## Current Recommended Order

1. Optimize oversized images in WP admin/media tooling.
2. Fix or disable unused ESSB modules in plugin settings.
3. Review RevSlider usage and global loading settings.
4. Decide WooCommerce product/indexation strategy using Google Search Console.
5. Review Chaty, GTranslate, Yandex, and consent plugin settings with business owner approval.
6. Re-run live QA and the technical audit.
7. Only then consider a small child-theme performance PR for one clearly unnecessary asset group.
