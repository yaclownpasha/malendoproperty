# Malendo Asset Handle Discovery

## Purpose

This document prepares for a future performance optimization PR by recording which CSS and JavaScript assets appear on important live Malendo pages, which plugin or theme likely owns them, and whether they are candidates for later optimization.

This is discovery only. It does not implement any dequeues, plugin changes, content edits, or production changes.

## Method

The discovery checked live HTML from:

- `/`
- `/contact/`
- `/submit-your-application/`
- `/properties/`
- `/rent-property/rent-villas/`
- `/rent-property/rent-apartment/`
- `/sell-property/sell-apartment/`
- `/thailand/phuket/services/property-management/`

It also checked the child theme enqueue code in `wp-content/themes/malendo-child/functions.php`.

Asset handles are listed as "likely" only when they are visible in the HTML `id` attribute or in child-theme code. If the live HTML does not expose a reliable handle, the handle is marked uncertain.

## Page Asset Counts

| Page | HTTP status | CSS files | JS files |
| --- | ---: | ---: | ---: |
| `/` | 200 | 26 | 33 |
| `/contact/` | 200 | 27 | 33 |
| `/submit-your-application/` | 200 | 26 | 33 |
| `/properties/` | 200 | 24 | 30 |
| `/rent-property/rent-villas/` | 200 | 25 | 31 |
| `/rent-property/rent-apartment/` | 200 | 25 | 31 |
| `/sell-property/sell-apartment/` | 200 | 25 | 31 |
| `/thailand/phuket/services/property-management/` | 200 | 25 | 31 |

The site is carrying a heavy global frontend bundle. Any optimization should be incremental and validated page by page because MyHome, WPBakery, WooCommerce, forms, translation, chat, consent, analytics, and listing UI can depend on these assets.

## Child Theme Handles Found In Code

| Handle or script | Source | Asset | Future action |
| --- | --- | --- | --- |
| `malendo-child-style` | `functions.php` | Child theme `style.css` | Keep. Do not dequeue unless replacing with equivalent styling. |
| `malendo-lead-events` | `functions.php` | `assets/js/lead-events.js` | Keep. This powers GA4 lead event tracking. |
| `G-D99Y7TY0LC` Google tag | `functions.php` `wp_head` hook | `googletagmanager.com/gtag/js` | Keep unless owner intentionally changes analytics. |

## Asset Owner Summary

| Owner | CSS assets | JS assets | Appears globally | Likely optimization path | Risk |
| --- | ---: | ---: | ---: | --- | --- |
| WooCommerce | 4 | 6 | 10 | Later child-theme conditional dequeue only after product strategy is decided | Risky |
| Contact Form 7 | 3 | 6 | 6 | Later child-theme conditional dequeue only after form usage is mapped | Risky |
| WordPress core | 1 | 5 | 6 | No action | Unsafe to dequeue blindly |
| MyHome theme | 3 | 2 | 5 | No action | Unsafe to dequeue globally |
| RevSlider | 2 | 3 | 5 | Prefer WP-admin/plugin settings first | Risky |
| Other plugin/theme assets | 5 | 1 | 6 | Manual review | Risky |
| Yandex analytics | 0 | 3 | 3 | WP-admin/plugin settings after owner confirms need | Risky |
| Chaty | 1 | 1 | 2 | WP-admin/plugin settings after owner confirms lead channel behavior | Risky |
| Cookie/consent | 1 | 1 | 2 | WP-admin/plugin settings | Risky |
| Font Awesome/icon libraries | 2 | 0 | 2 | Plugin/theme settings or manual review | Risky |
| Malendo child theme | 1 | 1 | 2 | No action | Unsafe to remove |
| Third-party CDN/service | 1 | 1 | 2 | Manual review | Risky |
| WPBakery / Visual Composer | 1 | 1 | 0 | Do not dequeue globally; page-builder dependency | Unsafe globally |
| Google Analytics / gtag | 0 | 1 | 1 | No action | Unsafe to remove without owner approval |
| GTranslate | 0 | 1 | 1 | WP-admin/plugin settings after owner confirms language strategy | Risky |

## Important Asset Groups

### MyHome Theme

| Field | Finding |
| --- | --- |
| Example asset URLs | `/wp-content/themes/myhome/...`, MyHome minified script/style, MyHome Font Awesome, lazy sizes, IDX broker assets |
| Likely handles | `myhome-style`, `myhome-idx-broker`, `myhome-font-awesome`, `lazy-sizes`, `myhome-min` |
| Pages where seen | All sampled pages |
| Appears globally | Yes |
| Dequeue risk | Unsafe globally |
| Future optimization method | No action unless a very specific unused MyHome module is identified |
| Validation before/after | Check header, menus, property cards, listing archive, filters, galleries, search, mobile layout, and console errors |

MyHome is the parent theme and likely owns core layout and estate/listing behavior. Do not remove MyHome assets globally.

### WPBakery / Visual Composer

| Field | Finding |
| --- | --- |
| Example asset URLs | `/wp-content/plugins/js_composer/...` |
| Likely handles | `js_composer_front`, `wpb_composer_front_js` |
| Pages where seen | Homepage, contact, submit application, rent villas, rent apartment, sell apartment, property management |
| Appears globally | No, not on the sampled `/properties/` archive |
| Dequeue risk | Unsafe globally |
| Future optimization method | Prefer WP-admin/page-builder settings or leave alone |
| Validation before/after | Check each WPBakery-built landing page visually on desktop and mobile |

WPBakery assets should not be globally dequeued because landing pages appear to depend on builder-rendered content.

### WooCommerce

| Field | Finding |
| --- | --- |
| Example asset URLs | `/wp-content/plugins/woocommerce/assets/css/woocommerce.css`, `/wp-content/plugins/woocommerce/assets/js/frontend/woocommerce.min.js`, WooCommerce block/style and order attribution assets |
| Likely handles | `wc-blocks-style`, `woocommerce-layout`, `woocommerce-smallscreen`, `woocommerce-general`, `wc-jquery-blockui`, `wc-js-cookie`, `woocommerce`, `sourcebuster-js`, `wc-order-attribution` |
| Pages where seen | All sampled pages |
| Appears globally | Yes |
| Dequeue risk | Risky |
| Future optimization method | Later child-theme conditional dequeue, only after WooCommerce product/indexation strategy is decided |
| Validation before/after | Check product pages, product categories, add-to-cart behavior, sorting, search/filter forms, checkout/cart if used, and sourcebuster/order attribution behavior |

WooCommerce appears globally on non-product landing pages. It may be a performance candidate, but it is not a first PR until the business decides whether WooCommerce products are strategic.

### Contact Form 7

| Field | Finding |
| --- | --- |
| Example asset URLs | `/wp-content/plugins/contact-form-7/...`, redirect and recaptcha integrations, intl-tel-input assets |
| Likely handles | `contact-form-7`, `swv`, `wpcf7-redirect-script-frontend`, `wpcf7-redirect-script`, `wpcf7-recaptcha`, `wpcf7-intl-tel-css`, `wpcf7-intl-tel-lib-js`, `wpcf7-intl-tel-js` |
| Pages where seen | Core Contact Form 7 assets are global; phone-input assets were seen on form-heavy pages |
| Appears globally | Partly yes |
| Dequeue risk | Risky |
| Future optimization method | Later child-theme conditional dequeue only after form locations are confirmed |
| Validation before/after | Test contact form, submit/application form, recaptcha, redirect behavior, phone country input, and GA4 form lead events |

Contact Form 7 assets are possible candidates on pages with no forms, but the site depends on leads. Prefer undercounting optimization benefit over breaking forms.

### RevSlider / Slider Revolution

| Field | Finding |
| --- | --- |
| Example asset URLs | `/wp-content/plugins/revslider/...`, `sr7` assets |
| Likely handles | `d5-revslider-module-builder-bundle-style`, `sr7css`, `revbuilder-backend`, `tp-tools`, `sr7` |
| Pages where seen | All sampled pages |
| Appears globally | Yes |
| Dequeue risk | Risky |
| Future optimization method | WP-admin/plugin setting first |
| Validation before/after | Check homepage hero, landing page hero blocks, sliders, animations, mobile layout, and console errors |

If sliders are not used on all sampled pages, disabling global RevSlider loading in plugin settings may be safer than custom dequeue code.

### Easy Social Share Buttons

| Field | Finding |
| --- | --- |
| Example asset URLs | Prior audits found Easy Social Share Buttons/Pinterest behavior; the 8-page sample should be rechecked before code changes |
| Likely handles | Uncertain until visible in live HTML or plugin settings |
| Pages where seen | Prior audits found related behavior on live pages; not a primary global group in this sample output |
| Appears globally | Unconfirmed in this sample |
| Dequeue risk | Likely safe only for clearly unused modules |
| Future optimization method | WP-admin/plugin settings first |
| Validation before/after | Confirm share buttons, Pinterest image sharing, console errors, layout, and social links |

Disable unused social share modules in plugin settings before considering code. This may also address the historical `essbPinImages is not defined` console error.

### Chaty

| Field | Finding |
| --- | --- |
| Example asset URLs | `/wp-content/plugins/chaty/...` |
| Likely handles | `chaty-front-css`, `chaty-front-end` |
| Pages where seen | All sampled pages |
| Appears globally | Yes |
| Dequeue risk | Risky |
| Future optimization method | WP-admin/plugin setting |
| Validation before/after | Confirm floating contact widget, WhatsApp/call links, mobile behavior, and lead tracking |

Chaty may be a lead channel, so do not remove or delay it without confirming its business value.

### Cookie / Consent

| Field | Finding |
| --- | --- |
| Example asset URLs | Complianz/CookieYes-style frontend assets |
| Likely handles | `cmplz-general`, `cmplz-cookiebanner` |
| Pages where seen | All sampled pages |
| Appears globally | Yes |
| Dequeue risk | Risky |
| Future optimization method | WP-admin/plugin settings |
| Validation before/after | Confirm consent banner, tracking consent behavior, GA4 behavior, and no console errors |

Consent tooling should be fixed through plugin configuration, not removed through code.

### GTranslate

| Field | Finding |
| --- | --- |
| Example asset URLs | `https://cdn.gtranslate.net/widgets/latest/dwf.js` |
| Likely handles | Uncertain; live script id may be numeric and unstable |
| Pages where seen | All sampled pages |
| Appears globally | Yes |
| Dequeue risk | Risky |
| Future optimization method | WP-admin/plugin setting |
| Validation before/after | Confirm language switcher, translated pages, language SEO expectations, and layout |

Keep if multilingual traffic is important. Review plugin settings if translation does not produce leads.

### Font Awesome / Icon Libraries

| Field | Finding |
| --- | --- |
| Example asset URLs | WPZOOM icon fonts plus external Font Awesome CDN |
| Likely handles | `wpzoom-social-icons-font-awesome-3`, external Font Awesome handle uncertain |
| Pages where seen | All sampled pages |
| Appears globally | Yes |
| Dequeue risk | Risky |
| Future optimization method | Plugin/theme settings or manual review |
| Validation before/after | Check social icons, menu icons, property icons, contact icons, and footer icons |

There may be multiple icon font sources. Consolidation is possible later, but only after visual QA confirms which icons each library powers.

### Google Analytics / gtag

| Field | Finding |
| --- | --- |
| Example asset URLs | `https://www.googletagmanager.com/gtag/js?id=G-D99Y7TY0LC` |
| Likely handles | Output directly by child theme; not a normal enqueue handle |
| Pages where seen | All sampled pages |
| Appears globally | Yes |
| Dequeue risk | Unsafe to remove |
| Future optimization method | No action unless owner changes analytics strategy |
| Validation before/after | GA4 DebugView, lead events, `generate_lead`, and no console errors |

This is measurement-critical and should stay.

### Yandex Analytics

| Field | Finding |
| --- | --- |
| Example asset URLs | Yandex metrika plugin assets |
| Likely handles | `wp-yandex-metrika_YmEc`, `wp-yandex-metrika_frontend`, `wp-yandex-metrika_contact-form-7`, `wp-yandex-metrika_woocommerce` |
| Pages where seen | All sampled pages |
| Appears globally | Yes |
| Dequeue risk | Risky |
| Future optimization method | WP-admin/plugin setting after owner confirms need |
| Validation before/after | Confirm owner still wants Yandex tracking, then verify analytics and no console errors |

This may be removable only if the owner does not use Yandex reporting.

### Other Plugin / Theme Assets

| Field | Finding |
| --- | --- |
| Example asset URLs | WPZOOM social icons, TablePress default CSS, other plugin frontend assets |
| Likely handles | `wpzoom-social-icons-socicon`, `wpzoom-social-icons-genericons`, `wpzoom-social-icons-academicons`, `wpzoom-social-icons-styles`, `tablepress-default`, `zoom-social-icons-widget-frontend` |
| Pages where seen | Many sampled pages |
| Appears globally | Often yes |
| Dequeue risk | Risky until use is confirmed |
| Future optimization method | Manual review or WP-admin/plugin setting |
| Validation before/after | Check social widgets, tables, footer/header blocks, icons, and layout |

These are secondary candidates after safer plugin-setting work.

## Safe Future Candidates

| Candidate | Expected benefit | Risk | Preferred fix location | Do now? |
| --- | --- | --- | --- | --- |
| Optimize large homepage and landing-page images | Better LCP and bandwidth | Low if quality is preserved | WP media/image optimization | Yes, before code dequeues |
| Disable unused Easy Social Share Buttons modules | Fewer scripts and possible console cleanup | Low to medium | WP-admin/plugin settings | Yes, if sharing modules are unused |
| Review RevSlider global loading | Fewer global slider assets | Medium | WP-admin/plugin settings | Yes, if sliders are not used globally |
| Review Yandex tracking | Fewer analytics scripts | Medium | WP-admin/plugin settings | Yes, if owner does not use Yandex |
| Review GTranslate global widget | Fewer third-party assets | Medium | WP-admin/plugin settings | Only after multilingual value is confirmed |
| Conditional Contact Form 7 assets on no-form pages | Fewer global form assets | Medium/high because leads depend on forms | Future child-theme PR | Later |
| Conditional WooCommerce assets on non-shop pages | Fewer global shop assets | Medium/high because products/indexation are unsettled | Future child-theme PR | Later |
| Icon/font consolidation | Fewer CSS/font requests | Medium | Plugin/theme settings or targeted PR | Later |

## Risky Items To Avoid For Now

- Do not dequeue MyHome assets globally.
- Do not dequeue WPBakery assets globally.
- Do not dequeue WordPress core assets such as jQuery, hooks, i18n, polyfills, or dashicons without exact dependency analysis.
- Do not remove `malendo-lead-events` or the GA4 tag.
- Do not remove Chaty until the owner confirms it is not an important lead source.
- Do not remove WooCommerce assets before deciding the WooCommerce product/indexation strategy.
- Do not remove Contact Form 7 assets before mapping all lead forms.
- Do not edit plugin files.
- Do not edit the MyHome parent theme.
- Do not blindly combine or minify all CSS/JS without visual and console QA.

## Future PR Sequence

1. Use WP-admin/plugin settings for low-risk changes first: image optimization, unused social share modules, RevSlider global loading, Yandex/GTranslate settings if not needed.
2. Re-run live QA and this asset discovery after each admin change.
3. Only after product/indexation strategy is confirmed, consider a small WooCommerce conditional dequeue PR.
4. Only after form locations are confirmed, consider a small Contact Form 7 conditional dequeue PR.
5. Keep each code PR isolated to one asset family with clear rollback.

## Validation Checklist For Any Future Asset PR

- Run `node scripts/check-malendo-live.mjs --markdown`.
- Run `node scripts/audit-malendo-site.mjs --markdown`.
- Run `node scripts/discover-malendo-assets.mjs --markdown`.
- Check homepage, contact, submit application, properties archive, rent villas, rent apartment, sell apartment, property management, one estate page, one product page, and one product category page.
- Confirm phone, email, WhatsApp, Telegram, submit/application, contact forms, and property cards still work.
- Confirm GA4 original click events and `generate_lead` still fire for lead actions.
- Confirm property card clicks do not fire `generate_lead`.
- Confirm no new JavaScript console errors.
- Confirm no PHP warnings/fatals in HTML.
- Compare CSS/JS counts before and after.
- Clear WordPress/server/cache plugin cache before final verification.

## Rollback For Future Asset PRs

1. Revert the asset optimization PR.
2. Redeploy through the approved GitHub Actions workflow.
3. Clear WordPress/server/cache plugin cache.
4. Re-run the live QA script.
5. Re-run key lead flow tests.
6. Re-run this asset discovery script if the script is present.
