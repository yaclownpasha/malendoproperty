# Malendo Indexation Inventory

## Purpose

`scripts/audit-malendo-indexation-inventory.mjs` builds a read-only inventory of URLs exposed through the public Malendo sitemap system. It is designed to support careful Google Search Console review before any noindex, redirect, deletion, or sitemap decision.

The tool does not log in, accept credentials, submit forms, upload GSC data, or change WordPress. It uses Node.js built-in APIs only.

## What It Collects

The audit fetches the main sitemap index and every child or nested sitemap it lists. It records the complete unique URL inventory, including:

- sitemap and URL counts by type
- WooCommerce product URLs
- product category URLs
- author/user URLs
- posts and blog-like URLs
- location/local pages
- project and developer pages
- translated subdomains discovered through sitemap URLs, homepage links, hreflang, and sampled redirects
- sitemap source and `lastmod` value

For a deterministic page sample, it also records:

- HTTP status and final URL
- redirect chain length
- robots directives
- canonical URL
- title and meta description
- legacy `info@malendo.property`, old-domain, and old-brand markers
- WooCommerce Add to cart markers
- exact duplicate-title groups
- normalized body-content signatures and exact duplicate-signature groups

The sample includes URL types in round-robin order so large product sitemaps do not crowd out smaller commercial, author, taxonomy, project, developer, or local groups.

## How To Run

From the repository root, using Node.js 18 or newer:

```bash
node scripts/audit-malendo-indexation-inventory.mjs
node scripts/audit-malendo-indexation-inventory.mjs --markdown
node scripts/audit-malendo-indexation-inventory.mjs --json
node scripts/audit-malendo-indexation-inventory.mjs --csv
```

The default HTML inspection sample is 120 URLs. Adjust it when needed:

```bash
node scripts/audit-malendo-indexation-inventory.mjs --max-urls 300 --markdown
node scripts/audit-malendo-indexation-inventory.mjs --max-urls 300 --csv
```

Use `--all` only for an approved, carefully timed full crawl:

```bash
node scripts/audit-malendo-indexation-inventory.mjs --all --csv
```

The site currently exposes tens of thousands of URLs. A full HTML inspection can take a long time and place unnecessary load on production. Complete sitemap enumeration does not require `--all`; only the per-page HTML inspection does.

Concurrency defaults to 3 and is capped at 6:

```bash
node scripts/audit-malendo-indexation-inventory.mjs --max-urls 300 --concurrency 2 --json
```

By default, every discovered translated-host root is requested. For a quick output-format test, the operator may limit those HTTP inspections while retaining all discovered hosts as honest `not-sampled` inventory rows:

```bash
node scripts/audit-malendo-indexation-inventory.mjs --max-urls 20 --max-language-hosts 3 --json
```

## Outputs

### Console

The default output provides concise totals for sitemaps, URL types, inspection status, classifications, legacy markers, Add to cart markers, and duplicate groups.

### Markdown

`--markdown` produces an operator-friendly report with:

- executive summary
- sitemap inventory
- URL counts by type
- review classification counts
- inspected HTTP status distribution
- translated host summary
- sampled legacy/broken, product, author, and taxonomy findings
- duplicate title and content-signature groups
- transport limitations
- a safe decision workflow

### JSON

`--json` includes the complete sitemap URL inventory and structured inspection evidence. Large product inventories can make this output substantial.

### CSV

`--csv` starts with `url`, making it suitable for joining to the `Page` column in a private Google Search Console Pages export. It contains every unique sitemap URL plus each separately discovered translated-host root. It includes:

- sitemap source and type
- inferred URL type
- host and `lastmod`
- inspection status
- HTTP, robots, canonical, and title evidence when sampled
- old contact/domain markers
- Add to cart marker
- content signature
- duplicate counts
- review classification
- notes

Redirect stdout to a local file outside the repository when working with inventory or private GSC data:

```bash
node scripts/audit-malendo-indexation-inventory.mjs --csv > ../private-malendo-indexation-inventory.csv
```

Do not commit private GSC exports or joined business data.

## Review Classifications

The classifications are triage buckets, not automatic SEO instructions:

- `commercial canonical`: core commercial pages, rent/sell landing pages, and native estate surfaces that normally deserve careful protection.
- `supporting local content`: local, editorial, project, developer, and supporting content that may strengthen Phuket topical coverage.
- `duplicate/language review`: translated hosts or sampled duplicate title/content groups requiring hreflang, canonical, and GSC review.
- `product review`: WooCommerce products and product categories requiring business-value and GSC review.
- `author/taxonomy review`: author, available, category, tag, and other taxonomy/archive surfaces.
- `legacy/broken`: sampled HTTP errors, off-domain redirects, legacy contact/domain markers, or known demo-style paths.
- `manual GSC decision`: ambiguous pages or URLs without enough evidence for a narrower review bucket.

An unsampled URL is never treated as proven healthy or unhealthy. Its CSV notes explicitly require manual/GSC review.

## Joining With Google Search Console

1. Export the GSC Performance Pages table for the last 3 or 6 months.
2. Keep that CSV private and outside Git.
3. Export this inventory with `--csv`.
4. Join inventory `url` to GSC `Page` using exact URLs.
5. Protect URLs with clicks, leads, or clear commercial intent.
6. Review zero-click product, author/taxonomy, duplicate/language, and legacy groups manually.
7. Use the existing `analyze-malendo-gsc-export.mjs` tool for performance-based decision support.

Do not assume that absence from a GSC Performance export proves zero indexation or zero value. Cross-check Search Console indexing reports, leads, internal use, and business strategy.

## Safety Rules

- Do not automatically noindex, delete, redirect, or unpublish any URL.
- Do not bulk noindex products before reviewing GSC and lead value.
- Do not remove translated hosts based only on duplicate-content signatures.
- Do not treat transport failures as SEO findings.
- Do not treat `not-sampled` as a pass.
- Do not edit WordPress core, MyHome parent theme, plugins, DNS, redirects, or Yoast settings from this tool.
- Do not upload GSC exports or add credentials to the script.
- Apply approved indexation changes through the responsible WordPress/Yoast/MyHome setting, then re-run live QA.

## Validation

Before merging changes to this audit tool:

```bash
node --check scripts/audit-malendo-indexation-inventory.mjs
node scripts/audit-malendo-indexation-inventory.mjs --max-urls 40
node scripts/audit-malendo-indexation-inventory.mjs --max-urls 40 --markdown
node scripts/audit-malendo-indexation-inventory.mjs --max-urls 40 --json
node scripts/audit-malendo-indexation-inventory.mjs --max-urls 40 --csv
git diff --check
```

Confirm that:

- the sitemap index and every listed child sitemap were requested
- JSON parses
- CSV has one header plus one row per unique inventoried URL
- no forms were submitted
- no credentials or private GSC data were used
- only the script and this document changed
- production content was not modified

## Limitations

- Regex-based HTML/XML extraction is intentionally dependency-free and is not a full browser DOM implementation.
- The default run inspects a representative sample, so page-level HTTP, canonical, title, marker, and duplicate findings do not cover every URL.
- Exact content signatures identify exact normalized matches, not semantic similarity.
- JavaScript-rendered content is not executed.
- Public responses may vary because of caching, rate limits, geolocation, translation services, or security controls.
- Sitemap presence does not prove Google indexation; GSC remains the decision source.

## Rollback

This tool has no production effect. Revert the PR that adds:

- `scripts/audit-malendo-indexation-inventory.mjs`
- `docs/MALENDO_INDEXATION_INVENTORY.md`
