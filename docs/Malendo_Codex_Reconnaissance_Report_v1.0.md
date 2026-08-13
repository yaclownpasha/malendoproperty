# Malendo Codex Reconnaissance Report v1.0

Scope authority: `Malendo_Approved_Codex_Scope_v1.0`
Scope evidence cut-off: 12 August 2026
Runtime evidence collected: 13 August 2026, 20:56-21:03 Asia/Bangkok
Repository state: `main` at `3906aff3f38971e30b5815b27f3830cee622b20d`

This package is diagnosis only. It does not change WordPress, redirects, robots, sitemaps, canonicals, analytics, consent, forms, plugins, server configuration, DNS, content, publication state, or production deployment.

## Executive findings

1. Git is not the complete application source. It contains `AGENTS.md`, one production deployment workflow, the `malendo-child` child theme, documentation, and read-only audit scripts. WordPress Core, the MyHome parent theme, plugins, uploads, database content/settings, server configuration, CDN/WAF rules, GTM container, and external integrations are not versioned here.
2. `/projects/` returns one `301` to `/thailand/phuket/projects/` with `X-Redirect-By: WordPress`. The repository contains no matching redirect or rewrite. The exact WordPress database/plugin/core-canonical cause cannot be proven without authenticated read access or exports.
3. `/projects-thailand-phuket/` returns one `301` to the same legacy hub with `X-Redirect-By: Yoast SEO Premium`. This redirect belongs to the WordPress/Yoast configuration layer, not child-theme Git.
4. The Request, Methodology, and three First-Wave public routes return direct `404` responses and do not fall through to the legacy hub. Public REST reads for Pages `27678283`, `27678285`, and `27678290-27678293` return `401`, so Draft status, parent assignments, and authenticated Preview behavior remain unverified.
5. `robots.txt` is a live Yoast-generated block. It declares `/sitemap_index.xml` (`200`) and stale `/rent-sitemap.xml` (`404`).
6. The sitemap index exposes 22 child sitemaps and 1,861 URL entries. Five child sitemaps are valid XML with zero URLs: neighborhood, street, beach, developer, and place-of-property.
7. `/cart/` and `/my-account/` are `200`, self-canonical, `noindex, follow`, but both appear in `page-sitemap.xml`.
8. The conservative internal-link sample checked 50 of 96 deduplicated targets discovered on priority pages. It found no `4xx`, `5xx`, loops, long chains, or transport failures in the checked sample. Forty-six targets were not tested and are not treated as passing.
9. The child theme installs GA4 `G-D99Y7TY0LC` directly and globally loads `lead-events.js`. Static code records form submission attempts as both `form_submit_attempt` and `generate_lead`; it does not contain a CF7 successful-delivery callback. A validation error can therefore be counted as a lead attempt/lead.
10. Click tracking does not send full `href` values or query strings, but `link_text` can contain a displayed phone number or email address. This is a PII risk requiring owner/privacy review before any tracking expansion.
11. Live HTML exposes Complianz, Yandex Metrika, Chaty, Contact Form 7, WPCF7 Redirect, WooCommerce, WPBakery, RevSlider, MyHome IDX, TablePress, and other plugin asset fingerprints. Their settings and ownership are database/plugin configuration and are not available in Git.
12. No GSC, backlink, URL inventory workbook, or non-PII CRM export was found. The evidence join was not fabricated; an exact data request is included instead.
13. Existing live QA completed with `PASS 100 / WARNING 1 / FAIL 0`; the remaining warning is author/user sitemap exposure. This is a read-only baseline, not acceptance for a future change.

## Phase status

| Phase | Status | Result |
|---|---|---|
| CDX-NOW-01 | PARTIAL COMPLETE | Repository and public runtime mapped; DB, server, CDN, GTM, plugin settings, backups, and staging need access. |
| CDX-NOW-02 | UNRESOLVED - NEEDS ACCESS | Redirect chains and ownership layers identified; exact `/projects/` rule/state not proven. |
| CDX-NOW-04 | PARTIAL COMPLETE | Static child-theme inventory complete; GTM/GA4 admin, consent settings, CF7 configuration, and CRM fields unavailable. |
| CDX-NOW-05 | SAMPLE COMPLETE | Priority routes, every sitemap child, and 50 internal targets checked with concurrency 1. Not a full-site crawl. |
| CDX-NOW-03 | BLOCKED BY DATA | Required GSC/backlink/CRM exports were not present. |

## Available sources

- Current Git history and files for `malendo-child`, audit scripts, docs, and deploy workflow.
- Public HTTP responses, redirect chains, response headers, rendered HTML, robots, sitemap index, and every child sitemap.
- Public plugin/theme asset fingerprints.
- Existing repository audits and implementation documentation.
- No root `README` is tracked; deployment guidance is split between `AGENTS.md`, `.github/workflows/deploy.yml`, and files under `docs/`.

## Missing sources and minimum access

| Missing source | Blocked verification | Can continue partially? | Minimum read-only access |
|---|---|---:|---|
| WordPress authenticated Page metadata | Page parent, Draft status, preview URL, old-slug metadata, exact `/projects/` canonical behavior | Yes | WP admin read role or sanitized Pages export for IDs `27678283`, `27678285`, `27678290-27678293` |
| Yoast Premium redirects export | Exact redirect record(s), owner, match type, creation history | Yes | Redacted Yoast redirect CSV/export or screenshots including source, target, type, and enabled state |
| Server config | nginx/Apache redirects and location rules | Yes | Read-only effective nginx vhost and `.htaccess` export with secrets removed |
| CDN/WAF config | Edge redirects, cache/WAF ownership | Yes | Read-only rules/export; no API write token |
| WordPress plugin/mu-plugin inventory | Custom redirect, canonical, robots, sitemap, form, booking, and analytics hooks | Yes | Read-only plugin list plus sanitized `wp-content/mu-plugins` and custom-plugin export |
| Yoast settings | Sitemap exclusions, robots source, canonical/noindex defaults | Yes | Read-only Yoast configuration export/screenshots |
| GTM/GA4 configuration | Tags, triggers, consent checks, duplicates, custom definitions | Yes | Read-only GTM container export and GA4 event/custom-definition export |
| Complianz configuration | Consent categories and whether tags respect state | Yes | Read-only CMP settings/export |
| CF7/WPCF7 Redirect configuration | Real success callback, redirects, mail routing, form ownership | Yes | Sanitized form/config export without submissions or recipient secrets |
| CRM/lead-sheet schema | Landing/source/medium and qualified-lead reconciliation | Yes | Field-name/data-dictionary export and aggregate non-PII counts |
| OTA/Hotel Sync/booking configuration | Operational dependencies and regression surface | Yes | Read-only integration inventory and data-flow diagram; no credentials |
| Backup and staging evidence | Any CDX-AFTER implementation | Yes for diagnosis only | Timestamped backup record and tested staging restore evidence |

## Architecture summary

- **Repository:** child-theme code, diagnostic scripts/docs, and a GitHub Actions workflow.
- **Deployment:** a push to `main` affecting the child theme or deploy workflow validates PHP, uses SSH/SCP to copy only `malendo-child`, and attempts a WP cache flush. Production environment approval policy and secret values are not visible.
- **WordPress/database:** Pages, page hierarchy, menus, MyHome/WPBakery content, Yoast redirects/canonicals/robots/sitemaps, CF7 forms, Woo settings, and plugin configuration.
- **Theme:** active public stack fingerprints `malendo-child` over MyHome. Only the child theme is in Git.
- **Plugins:** public assets identify the plugins listed above; versions and settings are unknown.
- **Server:** public responses report nginx. Effective rules are unavailable.
- **Analytics:** GA4 base tag and child-theme events are in Git; Yandex is plugin-owned; no `GTM-*` container marker was detected on sampled pages, but absence in HTML is not proof that no container/config exists elsewhere.
- **Consent:** Complianz assets and inline markers are visible; enforcement behavior is not proven.
- **External systems:** OTA Sync, Hotel Sync, booking engine, SMTP, CRM, and lead-sheet ownership remain unknown.

## Confirmed findings

- No repository permalink, rewrite, or redirect rule targets `/projects/`.
- `/projects/` -> `301` (`X-Redirect-By: WordPress`) -> legacy hub `200`.
- `/projects-thailand-phuket/` -> `301` (`X-Redirect-By: Yoast SEO Premium`) -> legacy hub `200`.
- The three First-Wave project routes, Methodology route, and Request route are public `404` with no redirect.
- Public REST access for the six known Draft Page IDs is denied with `401`.
- No loop or multi-hop chain longer than one redirect was found in the priority routes or checked internal sample.
- No `429`, `5xx`, WAF block, timeout, or transport error occurred during the final conservative run.
- Live robots declares a broken sitemap endpoint.
- Five child sitemaps are empty; Cart and My Account are noindex but sitemap-listed.
- Static tracking has click and submit-attempt events, but no verified successful-form event.
- Repository searches found no OTA Sync or Hotel Sync implementation. This does not prove those integrations are absent from plugins/database/server/external systems.
- The 96 discovered internal targets include links rendered in common WordPress shells, including 404 shells. The CSV preserves their source pages; it does not imply that every source is an intentional editorial link.

## Unresolved findings

- Exact origin inside the WordPress layer for `/projects/`.
- Authenticated preview behavior and current parent/permalink state for Page `27678290` and child Pages.
- Exact Management Audit route; no authoritative URL was present in repository or supplied materials.
- Whether Complianz gates every GA4/Yandex/plugin event correctly.
- Whether GTM or plugins duplicate child-theme events.
- CF7 successful-delivery, redirect, validation, and mail behavior.
- UTM persistence and CRM/lead attribution fields.
- OTA, Hotel Sync, booking, payment, and SMTP dependencies.
- GSC traffic/indexing/backlink/value evidence.

## Integration risks

1. Removing or overriding `/projects/` before identifying the WordPress source could affect legacy navigation, old-slug behavior, Yoast redirects, and planned child routing.
2. A child-theme `redirect_canonical` override would mask a database/plugin problem and is not justified yet.
3. Changing Yoast sitemap settings can affect broad taxonomies; exact exclusions must be measured against the 1,861-entry baseline.
4. Current `generate_lead` semantics overcount form attempts as successful leads.
5. `link_text` may send displayed contact data to analytics.
6. Analytics changes can duplicate Yandex/GTM/plugin events or bypass consent if ownership is not settled first.
7. Woo/Cart/My Account changes can affect integrations not represented in Git.

## What Codex can propose next

- Review the exact Yoast/server/WP exports and convert the `/projects/` diagnosis into one source-owned diff.
- Prepare an exact one-line stale sitemap declaration removal after the source and rollback are confirmed.
- Prepare exact Yoast sitemap exclusions for the five empty children and two noindex system Pages after staging/backup gates.
- Refine the event dictionary after owner approval and only then design a CF7 success-hook patch.
- Join GSC/backlink/CRM evidence after the requested exports arrive.

## What must not be done

- No publication/unpublication, redirect, canonical, noindex, robots, sitemap, GTM, consent, form, plugin, theme, Core, DNS, hosting, OTA, booking, payment, SMTP, or production changes.
- No wildcard redirect, mass noindex, language shutdown, Woo removal, bulk cleanup, or automatic URL disposition.
- No form submission or test lead.
- No claim that sampled or sitemap-discovered URLs are indexed, valuable, or fully tested.

## Stop conditions encountered

No runtime stop condition was triggered. The crawl stayed at concurrency `1`, used `650 ms` pauses, submitted no forms, made no authenticated requests, and saw no three consecutive transient failures. Access limitations were recorded and the cycle continued partially as authorized.

## Final classification

### READY FOR EXACT-DIFF REVIEW

- None before backup/staging and source ownership are confirmed.

### BLOCKED BY ACCESS

- Exact `/projects/` source and authenticated child Preview behavior.
- Yoast redirect/robots/sitemap configuration.
- Server/CDN redirect rules.
- GTM/GA4/Complianz/CF7/CRM configuration.
- OTA/Hotel Sync/booking dependency map.

### BLOCKED BY BACKUP/STAGING

- Stale sitemap declaration correction.
- Empty/noindex sitemap consistency correction.
- Any redirect or analytics implementation.
- Any Page/CF7 content support.

### BLOCKED BY OWNER DECISION

- Qualified-lead definition, event names, consent rules, and permitted analytics parameters.
- Legacy `/projects/` temporary behavior and future publication sequence.
- Whether system/Woo surfaces and language hosts have business value.

### HOLD

- First-Wave publication/indexation, Management Audit publication, Guides, Homepage redesign, global navigation, language migration, Woo cleanup, broad performance/security work, developer profiles, `/projects/` hub publication, Cherngtalay, Origin, deployment, and plugin/theme/Core updates.

## First recommended exact diff after the gate

After confirming the owning setting, taking a timestamped backup, and proving a staging restore, review **CDX-AFTER-01: remove only the stale `Sitemap: https://malendo-property.com/rent-sitemap.xml` declaration**. It is the narrowest confirmed defect: the declared endpoint returns `404`, while the valid Yoast sitemap index remains `200`. No change is authorized by this report.
