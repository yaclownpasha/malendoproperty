# Malendo GSC Indexation Analysis

## Purpose

`scripts/analyze-malendo-gsc-export.mjs` analyzes manually exported Google Search Console CSV files so Malendo can make safer SEO indexation decisions.

The tool exists because live audits found indexation bloat:

- 26 product sitemaps still present.
- Product category sitemap still present.
- Available sitemap still present.
- Author/user sitemap still present.
- WooCommerce products, product categories, available archives, author/user pages, demo/test pages, and thin duplicate pages need review before noindex decisions.

Do not bulk noindex or delete content just because a sitemap looks large. Use Google Search Console data first.

## What The Script Does

The script reads local CSV files only. It does not connect to Google APIs, does not require authentication, does not use secrets, and does not change the website.

It supports:

- Pages export CSV from Google Search Console Performance report.
- Optional Queries export CSV from Google Search Console Performance report.

It classifies URLs into groups such as:

- homepage
- property listing / estate
- rent landing page
- sell landing page
- property management page
- contact page
- submit application page
- WooCommerce product page
- product category page
- available archive/page
- author/user page
- demo/test page
- blog/post-like page
- unknown

It then summarizes clicks, impressions, CTR, average position, high-impression weak-CTR URLs, zero-click URLs, possible index-bloat groups, and conservative recommendations.

## Export Data From Google Search Console

1. Open Google Search Console.
2. Select the `malendo-property.com` property.
3. Go to Performance -> Search results.
4. Set a useful date range, ideally last 3 months or last 6 months.
5. Click Export.
6. Export the Pages table as CSV.
7. Optional: switch to Queries and export the Queries table as CSV.
8. Store the files locally outside the repository if they contain private business data.

Do not commit real GSC exports to Git.

## How To Run

From the repository root:

```bash
node scripts/analyze-malendo-gsc-export.mjs --pages path/to/pages.csv
node scripts/analyze-malendo-gsc-export.mjs --pages path/to/pages.csv --queries path/to/queries.csv
node scripts/analyze-malendo-gsc-export.mjs --pages path/to/pages.csv --markdown
node scripts/analyze-malendo-gsc-export.mjs --pages path/to/pages.csv --json
```

Optional thresholds:

```bash
node scripts/analyze-malendo-gsc-export.mjs --pages path/to/pages.csv --meaningful-clicks 3 --meaningful-impressions 100 --low-ctr 1 --poor-position 20
```

Default thresholds:

- `meaningfulClicks`: `3+`
- `meaningfulImpressions`: `100+`
- `lowCtr`: below `1%`
- `poorPosition`: worse than `20`

These thresholds are intentionally conservative. They are decision support, not automatic commands.

## How To Interpret Output

The default console output gives a quick summary.

`--markdown` creates an owner/operator-friendly report with:

- executive summary
- data source summary
- URL type performance table
- top clicked pages
- high-impression low-CTR pages
- product/product-category/available/author performance
- keep indexed recommendations
- improve content/meta recommendations
- consider noindex/remove-from-sitemap candidates
- human review list
- exact WP-admin/Yoast next steps
- do-not-do safety notes

`--json` creates structured output for future automation:

- `inputs`
- `thresholds`
- `totals`
- `groupsByUrlType`
- `topPages`
- `recommendations`
- `warnings`

## Indexation Decision Guidance

### Products

Keep product URLs indexed if they have meaningful clicks, strong impressions with commercial intent, or proven lead value.

Consider noindexing products only when they have zero clicks, weak impressions, duplicate/thin content, non-Phuket inventory, or no clear business value. Use Google Search Console and lead data before deciding.

### Product Categories

Product categories such as bank/import categories should usually be reviewed carefully. If they have zero clicks and no strategic value, consider noindexing through Yoast/WooCommerce taxonomy settings.

Do not noindex a product category with clicks until a human confirms the traffic is not valuable.

### Available Sitemap

If `available` URLs have zero clicks and no clear search intent, consider removing them from the indexable sitemap or setting noindex through the responsible WP/Yoast/MyHome setting.

### Author/User Sitemap

Author/user pages should generally not be an SEO surface for Malendo real estate. If they have zero clicks, noindex/remove them from sitemaps through Yoast or WordPress settings.

If an author/user URL has clicks, review the query and landing page before changing it.

### Demo/Test Pages

Demo and test pages such as `/about-me-2/`, `/advanced-search-form/`, `/video-fullscreen-buttons/`, `/test/`, `/test-2/`, and `/test-3/` should usually be noindexed, redirected, or unpublished if they have no business value.

### Commercial Landing Pages

Do not noindex important commercial pages just because CTR or position is weak. Improve title, meta description, headings, intro copy, internal links, and CTA clarity first.

Important pages include:

- `/`
- `/properties/`
- `/contact/`
- `/submit-your-application/`
- `/rent-property/rent-villas/`
- `/rent-property/rent-apartment/`
- `/sell-property/sell-apartment/`
- `/sell-property/sell-bungalow/`
- `/sell-property/sell-warehouse-factory/`
- `/thailand/phuket/services/property-management/`

## Safety Notes

- Do not bulk noindex URLs with clicks.
- Do not delete WooCommerce products blindly.
- Do not remove indexed pages that bring leads.
- Do not noindex commercial landing pages just because ranking is weak.
- Do not use Git to mask Yoast/WP-admin indexation settings.
- Use Yoast/WP-admin settings for indexation cleanup.
- Re-run live QA after WP-admin changes.
- Re-submit sitemaps in Google Search Console after major cleanup.
- Re-run this script after Google has time to recrawl and collect new data.

## Recommended Workflow

1. Export Pages CSV from GSC for the last 3 or 6 months.
2. Optionally export Queries CSV for the same date range.
3. Run:

```bash
node scripts/analyze-malendo-gsc-export.mjs --pages path/to/pages.csv --queries path/to/queries.csv --markdown
```

4. Review `Keep indexed` first.
5. Review `Human review list` before any noindex decision.
6. Improve commercial pages with impressions and weak CTR.
7. Consider noindex/remove-from-sitemap only for zero-click low-value groups.
8. Apply changes in WP-admin/Yoast.
9. Clear cache.
10. Run:

```bash
node scripts/check-malendo-live.mjs --markdown
```

11. Re-submit sitemap in GSC if sitemap/indexation settings changed.

## Validation For Script Changes

Before merging script changes:

```bash
node --check scripts/analyze-malendo-gsc-export.mjs
node scripts/analyze-malendo-gsc-export.mjs --pages path/to/sample-pages.csv
node scripts/analyze-malendo-gsc-export.mjs --pages path/to/sample-pages.csv --markdown
node scripts/analyze-malendo-gsc-export.mjs --pages path/to/sample-pages.csv --json
```

Use a tiny temporary sample CSV for validation. Do not commit private GSC exports or sample business data.

## Rollback

This tool does not affect production. To remove it, revert the PR that added:

- `scripts/analyze-malendo-gsc-export.mjs`
- `docs/MALENDO_GSC_INDEXATION_ANALYSIS.md`
