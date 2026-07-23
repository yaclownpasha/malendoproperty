# Malendo Indexation And Content Inventory

## Purpose

`scripts/audit-malendo-indexation-inventory.mjs` creates a read-only inventory of public Malendo URLs and sampled content/indexation evidence. It supports careful Google Search Console review before any noindex, redirect, deletion, or sitemap decision.

The tool:

- uses Node.js built-in APIs only
- performs public `GET` requests only
- does not log in or accept credentials
- does not retain cookies
- does not submit forms
- does not change WordPress, DNS, GTranslate, Cloudflare, plugins, themes, or deployment settings
- does not automatically recommend destructive action

## Discovery Sources

The audit discovers URLs from:

- `https://malendo-property.com/sitemap_index.xml`
- every child or nested sitemap listed by the sitemap system
- public homepage links
- links inside rendered header and navigation regions
- homepage hreflang links
- publicly available WordPress REST content-type collections
- translated subdomain roots
- internal links found in inspected HTML
- final destinations and redirect targets encountered during read-only requests

The REST collector excludes media attachments, revisions, blocks, templates, navigation objects, and other non-editorial internal types. It does not request the WordPress users endpoint.

## Evidence Per URL

Every inventory row has a stable schema. HTML-dependent fields are populated when the URL is inspected and remain explicitly `not-sampled` otherwise:

- source sitemap or sitemaps
- discovery source or sources
- URL with query strings removed
- final URL
- redirect chain
- HTTP status
- host
- response content type
- inferred WordPress object type
- public REST object type and ID when available
- title
- meta description
- H1 count and first H1
- robots directives
- canonical URL
- document language and hreflang values
- old `malendo.property` domain/brand markers
- old `info@malendo.property` marker
- current `info@malendo-property.com` marker
- Add to cart / WooCommerce product marker
- author/archive/taxonomy marker
- normalized duplicate-title signature
- normalized duplicate-content signature
- internal inlinks and outlinks observed during the run
- conservative orphan-candidate status
- optional URL-level GSC metrics

Query strings, URL credentials, and fragments are removed from report URLs. This protects accidental tokens and keeps the CSV suitable for joining to canonical GSC Page URLs.

## Classifications

Each URL is assigned one conservative review bucket:

- `commercial-rent-buy`
- `project-verification`
- `property-management`
- `location-supporting`
- `tourism-general`
- `WooCommerce-product-review`
- `taxonomy-author-review`
- `language-subdomain-review`
- `legacy-broken`
- `manual-GSC-decision`

These are labels for human review. They are not instructions to delete, redirect, noindex, unpublish, or disable anything.

Transport failures are recorded separately. A timeout, `429`, DNS failure, or other transport problem does not become an SEO classification.

## Run The Audit

Use Node.js 18 or newer from the repository root:

```bash
node scripts/audit-malendo-indexation-inventory.mjs
node scripts/audit-malendo-indexation-inventory.mjs --markdown
node scripts/audit-malendo-indexation-inventory.mjs --json
node scripts/audit-malendo-indexation-inventory.mjs --csv
```

The default run inventories all discovered URLs but fetches HTML for a deterministic 160-URL sample. The round-robin sample prevents large archive groups from crowding out commercial, project, product, author, local, and language types.

Control the sample and concurrency:

```bash
node scripts/audit-malendo-indexation-inventory.mjs --max-urls 300 --concurrency 2 --markdown
node scripts/audit-malendo-indexation-inventory.mjs --max-urls 20 --max-language-hosts 3 --max-rest-pages 1 --json
```

`--max-language-hosts` limits language-root HTTP requests for quick validation, while all discovered hosts remain in the inventory as `not-sampled`.

`--max-rest-pages` limits pagination per public WordPress REST content type. Use it only for output-format smoke tests. Omit it for a complete public REST inventory.

Use `--all` only for an approved full crawl:

```bash
node scripts/audit-malendo-indexation-inventory.mjs --all --csv
```

A full crawl can involve thousands of URLs and should be run carefully. Complete sitemap enumeration does not require `--all`; the option controls HTML inspection.

## Optional Local GSC Join

Export the Google Search Console Performance Pages table for the last three or six months, keep it outside the repository, then run:

```bash
node scripts/audit-malendo-indexation-inventory.mjs \
  --gsc-pages /private/path/gsc-pages.csv \
  --csv
```

The script recognizes common headings:

- `Page`, `Top pages`, or `URL`
- `Clicks`
- `Impressions`
- `CTR`
- `Position` or `Average position`

It joins only URL-level:

- clicks
- impressions
- CTR
- position

The local path is not printed. Query or user exports are not accepted, Google APIs are not called, and the file is never uploaded. Do not commit the original GSC file, the joined output, or other private business data.

## Output Formats

### Console

The default console output gives:

- sitemap and URL totals
- inspected and unsampled counts
- classification totals
- HTTP status distribution
- duplicate group counts
- partial-crawl orphan count
- GSC match count
- transport failure count

### Markdown

`--markdown` provides an owner/operator report with:

- executive summary
- discovery evidence
- classification and status tables
- sitemap inventory
- duplicate-title candidates
- duplicate-content candidates
- legacy/broken findings
- orphan-candidate review
- transport limitations
- local GSC join status
- safety notes

### JSON

`--json` includes:

- configuration and read-only request policy
- sitemap documents
- public REST diagnostics
- discovery counts
- complete URL records
- redirect chains
- inlink/outlink arrays
- duplicate groups
- transport failures
- GSC metrics when supplied

### CSV

`--csv` begins with `url`, so it can be joined to the GSC `Page` column. It includes source, status, metadata, signatures, link-graph counts, orphan status, classifications, and optional GSC metrics.

Store generated output outside Git:

```bash
node scripts/audit-malendo-indexation-inventory.mjs --csv > ../private-malendo-indexation-inventory.csv
```

## Orphan-Candidate Interpretation

The link graph covers only inspected HTML:

- `not-orphan-observed`: at least one internal inlink was observed.
- `orphan-candidate`: no inlink was found during a complete `--all` run.
- `possible-orphan-partial-crawl`: no inlink was found, but inspection was partial.
- `unknown-not-inspected`: the target page was inventoried but not fetched.
- `not-evaluated-language-host`: language-root orphan status is not inferred.
- `excluded-homepage`: the homepage is not evaluated as an orphan.

Never delete or noindex a page from partial-crawl orphan evidence. Check menus, page builders, XML sitemaps, GSC, leads, and business use first.

## Duplicate Interpretation

Title signatures normalize case and whitespace. Content signatures hash normalized rendered body text when enough text exists.

The tool finds exact normalized matches, not semantic similarity. Shared headers, footers, translated pages, templated listings, and short pages require human review. A duplicate signature is not an automatic canonical or noindex instruction.

## Safe Decision Workflow

1. Run the public inventory.
2. Export CSV outside the repository.
3. Optionally join a private GSC Pages export.
4. Protect URLs with clicks, leads, backlinks, or strategic commercial intent.
5. Review products, taxonomies/authors, translated hosts, duplicate candidates, and legacy findings manually.
6. Confirm the responsible WordPress/Yoast/MyHome setting before any change.
7. Apply only approved WP-admin changes.
8. Clear cache.
9. Re-run:

```bash
node scripts/check-malendo-live.mjs --markdown
node scripts/audit-malendo-indexation-inventory.mjs --markdown
```

10. Monitor Search Console after Google recrawls.

## Do Not Do

- Do not bulk noindex or delete from classification alone.
- Do not treat sitemap presence as proof of Google indexation.
- Do not treat absence from a Performance export as proof of zero value.
- Do not interpret `not-sampled` as healthy or unhealthy.
- Do not turn transport failures into SEO findings.
- Do not remove translated hosts without GSC and business confirmation.
- Do not expose or commit private GSC exports.
- Do not pass cookies, tokens, passwords, API keys, or credentials; those options are rejected.
- Do not edit WordPress core, MyHome parent theme, plugins, DNS, Cloudflare, or deployment settings through this audit.

## Validation

Before merging changes:

```bash
node --check scripts/audit-malendo-indexation-inventory.mjs
node scripts/audit-malendo-indexation-inventory.mjs --max-urls 40 --max-language-hosts 3 --max-rest-pages 1
node scripts/audit-malendo-indexation-inventory.mjs --max-urls 40 --max-language-hosts 3 --max-rest-pages 1 --markdown
node scripts/audit-malendo-indexation-inventory.mjs --max-urls 40 --max-language-hosts 3 --max-rest-pages 1 --json
node scripts/audit-malendo-indexation-inventory.mjs --max-urls 40 --max-language-hosts 3 --max-rest-pages 1 --csv
git diff --check
```

For local GSC validation, use a temporary synthetic CSV outside the repository. Do not commit real GSC data.

Confirm:

- the sitemap index and every listed child sitemap were attempted
- homepage/navigation and public REST discovery ran
- JSON parses
- CSV starts with `url` and has one row per inventoried URL
- query strings are absent from reported URL fields
- transport failures are separate from classifications
- no credentials, cookies, tokens, or forms were used
- only this script and documentation changed
- production was not modified

## Limitations

- HTML and XML extraction is dependency-free and regex-based, not a browser DOM.
- JavaScript-rendered links and content are not executed.
- Default link-graph and duplicate findings cover the deterministic inspected sample.
- Public REST types can be unavailable or restricted.
- Public responses can vary due to caching, rate limits, translation services, and security controls.
- Inlink counts are observations from this run, not a complete site graph unless `--all` finishes successfully.
- GSC remains the source for search-performance decisions.

## Rollback

This tool has no production runtime effect. Revert the PR that adds:

- `scripts/audit-malendo-indexation-inventory.mjs`
- `docs/MALENDO_INDEXATION_INVENTORY.md`
