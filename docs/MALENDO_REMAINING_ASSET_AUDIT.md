# Malendo Remaining Third-Party Asset Audit

## Executive Summary

Recent production PRs already reduced asset load by conditionally removing WooCommerce and Contact Form 7 assets from pages where they were not needed. The next performance work should be more cautious: the remaining global assets are mostly lead, translation, analytics, consent, page-builder, theme, and icon assets. Several are business-critical or theme-critical, so they should not be dequeued blindly.

Live checks sampled these pages:

- `/`
- `/properties/`
- `/contact/`
- `/submit-your-application/`
- `/rent-property/rent-villas/`
- `/rent-property/rent-apartment/`
- `/sell-property/sell-apartment/`
- `/thailand/phuket/services/property-management/`
- `/properties/thailand/phuket/rent/carla-villa/`
- `/properties/thailand/phuket/rent/the-kris/`
- `/properties/thailand/phuket/sell/kata-sea-view-villas/`

Main findings:

- Chaty, GTranslate, Yandex/Metrika, RevSlider, multiple icon/font libraries, MyHome, cookie/consent assets, GA4, and Malendo child-theme assets appear across all sampled pages.
- WPBakery appears on most sampled content/detail pages, but not on `/properties/`.
- Easy Social Share Buttons assets were not detected in this sample, so no code action is justified from current evidence.
- The largest low-risk opportunities are WP-admin/plugin-setting reviews, not code dequeues.
- Do not globally touch MyHome, WPBakery, GA4, Chaty, GTranslate, or consent tooling without owner approval and careful QA.

## Asset Group Table

| Asset group | Where it loads | Why it may be needed | Global? | Fix location | Risk | Recommended next step | Manual QA if changed |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Chaty | All sampled pages, including estate pages. Assets: `chaty-front.min.css`, `cht-front-script.min.js`. | Floating contact/chat channel; may drive calls, WhatsApp, or other leads. | Yes | WP-admin/plugin settings first | Medium | Review plugin settings. Keep unless owner confirms it is not used or can be targeted/delayed. | Check floating widget, mobile behavior, lead clicks, GA4 lead events, phone/WhatsApp/email paths. |
| GTranslate | All sampled pages. Asset: `https://cdn.gtranslate.net/widgets/latest/dwf.js`. | Language UX for international Phuket property visitors. | Yes | WP-admin/plugin settings first | Medium | Keep unless owner confirms language widget is not useful. Consider settings for widget placement/loading before code. | Check language switcher, translated pages, navigation, forms, mobile header/footer. |
| Yandex / Metrika | All sampled pages. Assets: `YmEc.min.js`, `frontend.min.js`, `contactFormSeven.min.js`, `woocommerce.min.js`. | Analytics/ecommerce/form tracking, possibly historical reporting. | Yes | WP-admin/plugin settings first | Medium | Confirm whether Yandex/Metrika is still required. If not, disable in plugin/settings. If required, review whether WooCommerce and CF7 modules need global loading. | Check analytics owner requirements, GA4 still works, forms still work, no console errors. |
| Yandex WooCommerce residual | All sampled pages via `wp-yandex-metrika/assets/woocommerce.min.js`. | WooCommerce-specific Metrika tracking, even after WooCommerce frontend assets were narrowed. | Yes | WP-admin/plugin settings first; possible future narrow PR only after plugin review | Medium | Audit whether Yandex WooCommerce module can be disabled in plugin settings, especially if WooCommerce products are not strategic. | Check product page, product category, cart/account if used, analytics reporting. |
| RevSlider / Slider Revolution | All sampled pages. Assets include `bundle.css`, `sr7.css`, `tools.js`, `tptools.js`, `sr7.js`. | Sliders or RevSlider-generated hero/section content. Some assets look like global/plugin builder assets. | Yes | WP-admin/plugin settings first | Medium | Review Slider Revolution global loading settings and confirm which pages actually use sliders. Prefer plugin settings over child-theme dequeues. | Check homepage hero, landing sections, mobile layout, console, animations. |
| Easy Social Share Buttons | Not detected in the sampled live pages. | Social sharing modules if enabled on posts/listings. Prior console issues referenced Pinterest module historically. | No evidence in current sample | WP-admin/plugin settings | Low | No code change. Keep an eye on console audits. Disable unused Pinterest/image modules in plugin settings if still enabled elsewhere. | Check pages where share buttons appear, social sharing, console. |
| Font Awesome / icon libraries | All sampled pages. Assets include MyHome Font Awesome 5.15.2, Font Awesome 6.0.0-beta3, WPZOOM Font Awesome 3, Socicon, Genericons, Academicons, and related font files. | Icons in theme, menus, social widgets, buttons, property UI, contact links. | Yes | WP-admin/plugin settings first; possible future narrow PR only after visual inventory | Medium | Audit duplicate icon libraries. Start with WPZOOM/social-icons widget settings if social icons are simple. Do not remove MyHome icon CSS globally. | Check header, footer, social icons, property cards, search controls, mobile menu, CTA icons. |
| WPBakery | Homepage, contact, submit, rent/sell landing pages, property-management page, and sampled estate pages. Not detected on `/properties/`. | Page-builder layout and content rendering. | Broad but not universal | WP-admin/plugin settings only unless page-specific proof exists | High | Do not globally dequeue. Only consider settings or future page-specific work after confirming no WPBakery content on a target page. | Check every page layout, columns, forms, spacing, mobile rendering. |
| MyHome | All sampled pages; estate detail pages load extra `myhome-map.min.js` and gallery assets. | Parent theme behavior: search, filters, maps, cards, galleries, lazy loading, estate UI. | Yes | Do not touch code; parent theme/settings only | High | Do not dequeue globally. Treat as theme-critical. | Check property search, filters, map, listing cards, detail galleries, contact/reply forms, mobile layout. |
| Cookie / consent | All sampled pages. Live assets are from Complianz (`cookieblocker.min.css`, `complianz.min.js`) even though earlier audits referenced CookieYes-style consent issues. | Consent/legal banner and script blocking. | Yes | WP-admin/plugin settings | High | Keep. Fix configuration in plugin settings rather than removing. | Check consent banner, blocked scripts, GA/Yandex behavior, legal/compliance expectations. |
| GA4 / gtag | All sampled pages. Asset: `https://www.googletagmanager.com/gtag/js`; ID `G-D99Y7TY0LC`. | Core analytics and lead conversion tracking. | Yes | Keep | High | Do not remove or delay without explicit analytics plan. | Check GA4 DebugView, lead-events.js, `generate_lead`, CTA clicks, forms. |
| Malendo child theme | All sampled pages. Assets: `style.css`, `lead-events.js`. | Site-specific styling, GA4 lead click/form tracking, safety patches. | Yes | Keep | High | Do not remove. | Check layout, CTA tracking, Submit URL safety, live QA. |
| WordPress core | All sampled pages. Includes jQuery, jQuery Migrate, Dashicons; form pages also include WP hooks/i18n/polyfill. | Core dependencies for theme/plugins. | Yes/broad | Do not touch without dependency map | High | No action. | Broad regression QA across all pages. |
| Google Fonts / third-party CSS | All sampled key pages in asset discovery. | Typography and visual consistency. | Yes | WP-admin/theme settings if available | Low/Medium | Audit font usage later. Not a first-priority code target. | Check typography and layout on mobile/desktop. |

## Safe WP-Admin / Plugin-Setting Candidates

Start here before considering code:

1. **RevSlider global loading**
   - Check Slider Revolution settings for global asset loading.
   - Confirm whether sliders are actually used on each audited page.
   - If sliders are only used on the homepage, prefer plugin settings to restrict assets.

2. **Yandex / Metrika**
   - Confirm whether the business still uses Yandex reports.
   - If not used, disable the plugin or modules in WP-admin.
   - If used, check whether WooCommerce and Contact Form 7 module scripts can be loaded only where relevant.

3. **WPZOOM/social icon libraries**
   - Review whether the Social Icons Widget plugin is still needed.
   - Multiple icon packs load globally: Font Awesome 3, Font Awesome 5, Font Awesome 6 beta, Socicon, Genericons, and Academicons.
   - If social icons are simple, a plugin-setting or widget simplification may reduce several CSS/font requests.

4. **Chaty**
   - Keep if it drives leads.
   - Review whether it can be delayed, limited, or configured lighter in plugin settings.

5. **GTranslate**
   - Keep if multilingual users convert.
   - Review placement/loading settings only after owner confirms language UX priorities.

6. **Cookie/consent plugin**
   - Keep for legal/compliance.
   - Fix configuration problems in the plugin dashboard rather than removing it.

## Risky Code Candidates To Avoid

Do not make these changes as a casual performance PR:

- Do not globally dequeue MyHome assets.
- Do not globally dequeue WPBakery assets.
- Do not remove GA4/gtag.
- Do not remove or delay consent tooling blindly.
- Do not remove Chaty without owner approval, because it may affect leads.
- Do not remove GTranslate without owner approval, because it may affect international visitors.
- Do not remove MyHome Font Awesome or theme icon libraries until every header, footer, search, card, and listing UI is visually checked.
- Do not remove Yandex scripts until the owner confirms whether Yandex reporting is needed.

## Possible Future Codex Tasks

Only consider code after WP-admin/plugin-setting review:

| Possible task | Why it might help | Risk | Scope required |
| --- | --- | --- | --- |
| Narrow RevSlider dequeue on pages proven to have no slider output | RevSlider is heavy and appears global. | Medium/High | Only after confirming exact pages without sliders and validating homepage/landing layouts. |
| Narrow Yandex WooCommerce module cleanup | `wp-yandex-metrika/assets/woocommerce.min.js` still appears globally. | Medium | Prefer plugin setting first. Code only if settings cannot solve it and product/cart pages remain protected. |
| Icon library consolidation plan | Multiple Font Awesome/icon packs are loaded globally. | Medium | Start with documentation/visual inventory. Code only after identifying exact unused handles. |
| Extend asset discovery script to include estate pages | Current asset discovery script samples key pages; estate details were checked manually here. | Low | Script-only PR, read-only. |

No immediate child-theme dequeue PR is recommended from this audit alone.

## Do-Not-Do List

- Do not edit WordPress core.
- Do not edit the MyHome parent theme.
- Do not edit plugin files.
- Do not deploy asset changes without human approval.
- Do not change WordPress content.
- Do not remove analytics blindly.
- Do not remove lead channels blindly.
- Do not remove consent/legal tooling blindly.
- Do not chase one or two fewer requests if it risks broken forms, maps, filters, galleries, translation, or lead tracking.
- Do not combine/minify everything blindly; this can break plugin load order.

## Validation Plan For Any Future Asset Change

Before merging any future asset PR:

1. Confirm the PR touches only allowed files.
2. Run PHP syntax checks if PHP changed.
3. Run:

```bash
node scripts/check-malendo-live.mjs --markdown
node scripts/discover-malendo-assets.mjs --markdown
node scripts/audit-malendo-site.mjs --markdown
```

4. Compare asset counts before/after.
5. Check these pages visually on desktop and mobile:
   - `/`
   - `/properties/`
   - `/contact/`
   - `/submit-your-application/`
   - `/rent-property/rent-villas/`
   - `/rent-property/rent-apartment/`
   - `/sell-property/sell-apartment/`
   - `/thailand/phuket/services/property-management/`
   - at least three estate detail pages
6. Confirm:
   - MyHome search/filter/map/listing behavior still works.
   - Estate galleries still work.
   - Contact and Submit forms still work.
   - Chat/lead widgets still work if kept.
   - GTranslate still works if kept.
   - GA4 and `lead-events.js` still load.
   - No new console errors.
   - No `Fatal error`, `PHP Warning`, or `Uncaught` markers appear.
7. After deploy, rerun live QA and asset discovery before deciding whether to keep or revert.

## Current Recommendation

Do not open another dequeue PR yet. The safest next steps are:

1. Ask the owner whether Yandex/Metrika, Chaty, and GTranslate are business-critical.
2. Review RevSlider global-loading settings.
3. Review WPZOOM/social icon widget usage and duplicated icon packs.
4. Keep MyHome, WPBakery, GA4, consent, and Malendo child-theme assets untouched unless a narrowly scoped future audit proves a safe change.
