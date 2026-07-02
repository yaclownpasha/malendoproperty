# Malendo Technical Audit

## Purpose

`scripts/audit-malendo-site.mjs` is a read-only technical SEO, performance, and conversion audit for `https://malendo-property.com`.

It is designed to help decide the next high-ROI WordPress admin, Yoast, MyHome, plugin-setting, content, and Codex/Git tasks. The script fetches public pages and public metadata only. It does not log in, submit forms, edit WordPress, deploy code, or require secrets.

## How To Run

From the repository root:

```bash
node scripts/audit-malendo-site.mjs
node scripts/audit-malendo-site.mjs --markdown
node scripts/audit-malendo-site.mjs --json
```

Use Node.js 18 or newer so built-in `fetch` is available. No npm install is required.

## Pages Checked

The script audits these key commercial pages:

- `/`
- `/contact/`
- `/submit-your-application/`
- `/properties/`
- `/rent-property/rent-villas/`
- `/rent-property/rent-apartment/`
- `/sell-property/sell-apartment/`
- `/sell-property/sell-bungalow/`
- `/sell-property/sell-warehouse-factory/`
- `/thailand/phuket/services/property-management/`

## What The Audit Checks

For each page, the script collects:

- HTTP status and final URL after redirects
- canonical URL
- robots meta
- title tag
- meta description
- H1 count and H1 text
- approximate word count and thin-content signal
- date/admin/category blog-style metadata cues
- old brand/contact strings such as `Malendo.property`, `malendo.property`, `info@malendo.property`, and `2025 by Malendo`
- local SEO keyword coverage for Phuket real estate/rent/sale/property-management terms
- visible lead links: phone, email, WhatsApp, Telegram, Contact, and Submit/Application
- approximate early-page CTA presence
- HTML byte size
- CSS, JS, and image URL counts
- largest image URLs where `Content-Length` is available from a safe `HEAD` request
- third-party domains
- plugin/theme asset fingerprints including MyHome, WPBakery, WooCommerce, Contact Form 7, RevSlider, Easy Social Share Buttons, Chaty, CookieYes, GTranslate, Font Awesome, Google Analytics, and Yandex
- possible render-blocking CSS and JS candidates
- important internal links
- suspicious external links

It also fetches:

- `/robots.txt`
- `/sitemap_index.xml`

The sitemap check summarizes page, estate, product, product category, available, author/user, category, and other sitemap entries.

## Output Formats

Default console output is a readable summary for a technical operator.

`--markdown` prints a report with:

- executive summary
- priority matrix
- per-page findings table
- plugin/asset bloat table
- thin-content landing pages
- Contact/CTA issues
- sitemap/indexation issues
- recommended Codex/Git tasks
- recommended WP-admin tasks
- do-not-do safety notes

`--json` prints structured data with:

- `pages`
- `assets`
- `plugins`
- `seoFindings`
- `conversionFindings`
- `performanceFindings`
- `safetyFindings`
- `sitemapFindings`
- `recommendedCodexTasks`
- `recommendedWpAdminTasks`

## How To Interpret Priorities

- `P0`: critical safety or trust issue, such as suspicious external links or broken core pages.
- `P1`: high-impact SEO/indexation or lead-loss issue.
- `P2`: conversion, content, canonical, or local SEO improvement likely worth doing soon.
- `P3`: performance/plugin cleanup or UX polish that should be handled carefully.
- `P4`: lower-priority content improvements.

The script exits `0` when the audit itself runs successfully. It exits `1` only for script/runtime failure. SEO warnings do not fail the run because this is an advisory audit, not a production gate.

## Codex/Git Fixes

Use Codex/Git for:

- read-only validation script improvements
- documentation and runbooks
- small child-theme fixes only when the source is clearly in Git
- removal of the temporary Submit URL safety patch after the real WP/MyHome/menu source is fixed and verified
- targeted future schema or performance PRs only after business details and plugin settings are confirmed

Do not use Git to mask issues that belong in WordPress admin, Yoast, MyHome options, menus, widgets, or plugin dashboards.

## WP-admin / Yoast / Plugin Fixes

Use WordPress admin for:

- page titles, meta descriptions, and H1/content improvements
- Yoast canonical overrides
- Yoast indexation and sitemap settings
- WooCommerce product and product-category indexation decisions
- old brand/contact/copyright text
- lead CTA links in menus, widgets, MyHome settings, page builders, Chaty, or page content
- plugin settings for CookieYes, ESSB, Chaty, GTranslate, WooCommerce, WPBakery, and RevSlider

Use Google Search Console before broad noindex decisions, especially for WooCommerce products.

## What Not To Change Blindly

- Do not edit WordPress core.
- Do not edit the MyHome parent theme.
- Do not bulk replace database or WPBakery/MyHome serialized content.
- Do not noindex all products before checking Google Search Console if product traffic matters.
- Do not remove plugins without understanding business impact.
- Do not dequeue MyHome, WooCommerce, WPBakery, or form assets globally without page-level validation.
- Do not add schema until official brand name, email, phone, address/service area, and social profiles are confirmed.
- Do not remove the temporary Submit URL safety patch until the real WP/MyHome/menu source is fixed and verified.

## Validation

Before merging changes to this audit script:

```bash
node --check scripts/audit-malendo-site.mjs
node scripts/audit-malendo-site.mjs
node scripts/audit-malendo-site.mjs --markdown
node scripts/audit-malendo-site.mjs --json
```

Confirm:

- no forms are submitted
- no production content is changed
- no dependencies are added
- no theme, plugin, workflow, server config, or booking files are changed
- only `scripts/audit-malendo-site.mjs` and docs are touched

## Rollback

This audit does not affect production. To roll it back, revert the PR that added:

- `scripts/audit-malendo-site.mjs`
- `docs/MALENDO_TECHNICAL_AUDIT.md`
