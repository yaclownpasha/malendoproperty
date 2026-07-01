# Malendo SEO Indexation Cleanup Plan

## Purpose

This document turns the latest read-only SEO and WooCommerce indexation audits into a practical cleanup plan for Malendo Property.

The live site currently exposes about **27,676 sitemap URLs**, including **25,736 WooCommerce product URLs**. That is a very large indexable surface for a Phuket real estate business, and it may dilute topical focus around Phuket real estate, Phuket rentals, Phuket villas, Phuket condos, and property management in Phuket.

This plan is for WordPress admin, Yoast, WooCommerce, and content cleanup decisions. It does not implement changes by itself.

## Current Indexation Problem

Current audit findings:

- The Yoast sitemap index exposes **26 product sitemaps**.
- Those product sitemaps contain **25,736 product URLs**.
- Product categories are publicly indexable:
  - `/product-category/bam/`
  - `/product-category/krungthai/`
  - `/product-category/kasikornbank/`
  - `/product-category/krungsriproperty/`
  - `/product-category/bangkokbank/`
- Public product category counts found during the audit:
  - `bam`: 11,478 products
  - `krungthai`: 6,683 products
  - `kasikornbank`: 4,436 products
  - `krungsriproperty`: 2,651 products
  - `bangkokbank`: 487 products
- Many products appear to be bank/import inventory rather than curated Malendo Phuket listings.
- Many sampled products are outside Phuket, including Bangkok, Kanchanaburi, Phichit, Nakhon Pathom, Chiang Rai, Lampang, Udon Thani, and other provinces.
- Many products use generic or duplicate titles such as:
  - `Single house`
  - `Residential apartment`
  - `Townhouse`
  - `land in Kanchanaburi`
- Product category pages have weak SEO signals:
  - generic titles such as `Архивы Bam - Malendo Property`
  - no detected H1 on sampled category pages
  - no detected meta description on sampled category pages
- Product schema exists, but product prices may show a likely wrong currency such as `USD`. This needs confirmation because Thai property inventory may need `THB` or a clearly intentional converted currency.

## Business Decision Required Before Noindexing Products

Do not noindex all WooCommerce products until the business owner/operator answers these questions:

- Check Google Search Console for `/product/` traffic.
- Check whether product pages generate real leads.
- Check whether bank-import inventory is strategic for Malendo.
- Decide whether WooCommerce products are intended for SEO or only operational/internal browsing.
- Confirm whether prices should be `THB` or `USD`.
- Confirm whether native MyHome estate/listing pages should be the main SEO surface.

Suggested decision rule:

- If `/product/` pages have little organic traffic and weak lead value, noindex WooCommerce products and focus SEO on MyHome estate/listing pages plus curated commercial landing pages.
- If some `/product/` pages produce real leads, keep only the strong Phuket-relevant pages indexed after improving them.

## Recommended Default Strategy

The recommended default strategy is conservative and ROI-focused:

- Native MyHome estate/listing pages should likely be the main Phuket SEO surface.
- WooCommerce product categories should likely be noindexed unless bank inventory is confirmed as strategic.
- Low-quality, duplicate, generic, or non-Phuket imported product pages should likely be noindexed.
- Selected Phuket-relevant product pages may stay indexed only after improving:
  - title
  - H1
  - body copy
  - location clarity
  - lead CTA clarity
  - price/currency accuracy
  - images
  - Product schema
- Do not bulk delete WooCommerce products unless the owner confirms they are not needed for operations, internal browsing, or bank/import workflows.

## Step-By-Step WP Admin / Yoast Cleanup Plan

### 1. Review Search Console Before Changing Product Indexation

In Google Search Console:

- Filter pages containing `/product/`.
- Check impressions, clicks, click-through rate, average position, and queries.
- Identify any product URLs that produce real organic traffic or lead conversions.
- Export a list of product URLs that should be manually reviewed before noindex.

### 2. Noindex Product Categories

In WordPress admin:

1. Go to **Yoast SEO**.
2. Open **Search Appearance**.
3. Open **Taxonomies**.
4. Find **Product categories**.
5. Set product category archives to **noindex** unless bank inventory is confirmed as strategic.
6. Save changes.
7. Clear caches.

Expected outcome:

- `/product-category/bam/`
- `/product-category/krungthai/`
- `/product-category/kasikornbank/`
- `/product-category/krungsriproperty/`
- `/product-category/bangkokbank/`

should no longer be indexable or should disappear from indexable sitemap output.

### 3. Decide Product Indexation

In WordPress admin:

1. Go to **Yoast SEO**.
2. Open **Search Appearance**.
3. Open **Content Types**.
4. Find **Products**.
5. Decide index/noindex after the Google Search Console review.

Recommended default:

- Noindex WooCommerce products if they are mostly low-quality, non-Phuket, bank/import inventory.
- Keep selected Phuket-relevant products indexed only if they are improved and lead-worthy.

### 4. Noindex Demo/Test Pages

Noindex, unpublish, or delete pages that are not real business pages:

- `/about-me-2/`
- `/advanced-search-form/`
- `/video-fullscreen-buttons/`
- `/test/`
- `/test-2/`
- `/test-3/`

Prefer unpublishing or deleting true demo/test pages. Use noindex only if the page must stay public for a reason.

### 5. Noindex `/available/*`

The audit found `/available/*` in sitemap output while robots.txt also disallows `/available/*`. That is a mixed signal.

Recommended action:

- Noindex availability/date archives in Yoast or the relevant taxonomy settings.
- Remove them from sitemap output if possible.
- Avoid relying only on robots.txt disallow, because disallowed URLs can still appear as known URLs without useful page content.

### 6. Noindex Thin Utility Taxonomies

Noindex thin utility taxonomy archives unless they have been manually improved and are intentionally targeted:

- floor
- view
- filter
- pets
- property features
- availability/date-style archives
- other utility filters with no unique search demand or content

### 7. Keep Search Pages Noindex

Search pages should remain noindex.

Examples:

- `/?s=phuket`
- `/search/`
- filter/search result URLs with query parameters

### 8. Review Robots.txt

The audit found a broad robots rule:

```text
Disallow: /wp-
```

This may block `/wp-content/` assets such as CSS, JavaScript, images, and plugin files. If Google cannot fetch render assets, it may not understand pages correctly.

Recommended action:

- Review robots.txt in Yoast or the SEO/plugin setting that manages it.
- Fix broad blocking if it prevents Google from rendering `/wp-content/` assets.
- Keep sensitive/admin endpoints blocked where appropriate.

### 9. Re-Submit Sitemap After Cleanup

After indexation settings are changed:

1. Clear site/server/cache plugin cache.
2. Open `https://malendo-property.com/sitemap_index.xml`.
3. Confirm sitemap output changed as expected.
4. Re-submit sitemap in Google Search Console.
5. Monitor indexing changes over the following weeks.

## Pages To Remove Or Noindex

High confidence candidates:

- `/about-me-2/`
- `/advanced-search-form/`
- `/video-fullscreen-buttons/`
- `/test/`
- `/test-2/`
- `/test-3/`
- `/available/*`
- author/user archives if still in sitemap output
- low-value taxonomies such as floor/view/filter/pets unless intentionally targeted and improved

Product indexation candidates:

- Noindex low-quality non-Phuket WooCommerce products.
- Noindex duplicate/generic WooCommerce products.
- Noindex bank/import products unless confirmed as strategic.
- Do not bulk delete products without owner approval.

## Important Pages To Keep And Improve

Keep indexed and improve these pages:

- `/`
- `/contact/`
- `/submit-your-application/`
- `/properties/`
- `/rent-property/rent-villas/`
- `/sell-property/sell-apartment/`
- `/sell-property/sell-bungalow/`
- `/sell-property/sell-warehouse-factory/`
- active high-quality Phuket estate/listing pages

Recommended improvement themes:

- Stronger Phuket-focused titles and meta descriptions.
- Clear H1s that match search intent.
- Local trust signals.
- Clear phone, WhatsApp, email, and Submit/Application CTAs.
- Internal links between commercial landing pages and high-quality listings.
- Schema cleanup after official business details are confirmed.

## Risks

### Risk: Noindexing Products Too Fast

- May reduce long-tail organic traffic.
- May hide product pages that currently generate leads.
- Google Search Console data should be reviewed first.
- Selected high-value Phuket product pages may need to remain indexed.

### Risk: Keeping 25k Weak Products Indexed

- Can dilute topical focus away from Phuket real estate.
- Can waste crawl budget on low-value pages.
- Can expose duplicate or thin content patterns.
- Can compete with stronger MyHome estate/listing pages.
- Can weaken perceived site quality.

### Risk: Wrong Product Schema Currency

- Product schema using likely wrong currency such as `USD` can mislead search engines and users.
- Rich-result eligibility or trust may suffer.
- Currency rules should be confirmed before schema improvements.

### Risk: Duplicate/Thin Pages

- Generic titles like `Single house` and `Residential apartment` create duplicate intent.
- Non-Phuket products may attract irrelevant traffic.
- Thin pages can reduce search quality signals.

### Risk: Crawl Budget Waste

- 25,736 product URLs plus many taxonomy archives can consume crawl attention that should go to better commercial pages.

### Risk: Loss Of Long-Tail Traffic

- Some bank/import products may attract very specific searches.
- This is why Google Search Console review is required before bulk product noindex.

## Verification After WP Admin Changes

After each cleanup group, verify the public site and sitemap output.

### Sitemap Count Checks

- Recheck `https://malendo-property.com/sitemap_index.xml`.
- Count product sitemap URLs again.
- Count product category sitemap URLs again.
- Record before/after counts.

### Product Category Checks

Product categories should disappear from indexable sitemap output if noindexed:

- `/product-category/bam/`
- `/product-category/krungthai/`
- `/product-category/kasikornbank/`
- `/product-category/krungsriproperty/`
- `/product-category/bangkokbank/`

If they still load publicly, they should at least show `noindex, follow`.

### Product Checks

If products are noindexed:

- Product URLs should disappear from product sitemaps.
- Sample product pages should show `noindex, follow`.
- Important internal browsing should still work if products remain published.

### Demo/Test Page Checks

- Demo/test pages should be unpublished, removed, redirected, or `noindex`.
- They should not appear in the page sitemap as indexable URLs.

### Availability Archive Checks

- `/available/*` should not be indexed.
- `/available/*` should not appear in sitemap output.
- Robots and sitemap should not send conflicting signals.

### Important Commercial Page Checks

Confirm these remain indexed:

- `/`
- `/contact/`
- `/submit-your-application/`
- `/properties/`
- `/rent-property/rent-villas/`
- `/sell-property/sell-apartment/`
- `/sell-property/sell-bungalow/`
- `/sell-property/sell-warehouse-factory/`

### Google Search Console Checks

- Re-submit the sitemap after cleanup.
- Monitor Coverage/Indexing reports.
- Monitor clicks and impressions for Phuket commercial queries.
- Monitor excluded/noindexed URLs to confirm Google processed the change.

## What Codex Should Do Later

Codex should not use Git to mask Yoast/WooCommerce indexation settings unless admin settings cannot solve the issue.

Good Codex follow-ups after WP admin cleanup:

- Re-run a read-only sitemap audit after WP admin cleanup.
- Create a small validation script only if it would help the owner/operator repeat sitemap checks safely.
- Re-audit Product schema after currency and product strategy are confirmed.
- Re-audit local business schema after brand/email/phone/address/socials are confirmed.

Do not ask Codex to add a schema PR until these details are confirmed:

- official brand name
- official email
- official phone
- official address or service area
- official social profile URLs
- product currency rules
- whether WooCommerce products should be public SEO landing pages or operational/internal inventory

Do not use Git or child-theme code to hide broad SEO indexation problems if Yoast, WooCommerce, or WP admin settings can handle them directly.