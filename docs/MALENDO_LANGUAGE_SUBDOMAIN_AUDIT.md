# Malendo Language Subdomain SEO Audit

## Purpose

`scripts/audit-malendo-language-subdomains.mjs` is a read-only advisory audit for public language subdomains of `malendo-property.com`. It discovers the current public language surface instead of relying on a hard-coded language list, then records technical SEO and content-hygiene evidence for each discovered host.

The script sends HTTP `GET` requests only with credentials omitted. It does not log in, submit forms, change WordPress, update GTranslate, alter DNS or Cloudflare, edit redirects, or write robots, canonical, hreflang or sitemap settings.

Reported, requested and cached public URLs have URL credentials, query strings and fragments removed. Credential-style and unknown CLI options are rejected rather than silently ignored.

## Run

Node.js 18 or newer is required. No packages or credentials are needed.

Console summary:

```bash
node scripts/audit-malendo-language-subdomains.mjs
```

Markdown report:

```bash
node scripts/audit-malendo-language-subdomains.mjs --markdown
```

JSON report:

```bash
node scripts/audit-malendo-language-subdomains.mjs --json
```

The audit uses a resumable cache in the operating system's temporary directory by default. Successful HTTP `200` responses and definitive `404`/`410` responses are compressed and cached for 12 hours. Rate limits, timeouts and other transient failures are never cached.

```bash
node scripts/audit-malendo-language-subdomains.mjs --refresh
node scripts/audit-malendo-language-subdomains.mjs --cache path/to/private-cache.json
node scripts/audit-malendo-language-subdomains.mjs --cache-ttl-hours 6
node scripts/audit-malendo-language-subdomains.mjs --no-cache
```

- `--refresh` ignores existing cached responses while rebuilding the cache.
- `--cache` selects a local cache file.
- `--cache-ttl-hours` changes the positive-response TTL.
- `--no-cache` disables persistent caching but retains in-process request deduplication.

The cache contains compressed copies of public HTML/XML only. It does not contain cookies, credentials or authorization data. Keep an explicit cache outside Git and never commit it.

Static validation:

```bash
node --check scripts/audit-malendo-language-subdomains.mjs
git diff --check
```

The audit exits `0` when collection and reporting complete, even when SEO findings exist. It exits `1` only for a script-level runtime failure.

## Discovery Model

The audit begins with the English homepage, Contact page and Properties archive. It collects language hosts and URLs from:

- `<link rel="alternate" hreflang="...">` tags;
- public links on the sampled pages;
- the base XML sitemap index;
- final destinations and redirect chains from discovered language hosts.

For each host, it always checks the homepage and selects one additional representative URL deterministically from the discovered Contact/Properties paths. The same host receives the same sample on every run. The audit also checks `sitemap_index.xml`, falls back to `wp-sitemap.xml`, and inspects one page sitemap when exposed.

Discovery is bounded and intentionally does not crawl every URL in every language sitemap. This keeps the audit practical and avoids an aggressive crawl across tens of thousands of translated product and estate URLs.

## Transport Hardening

The request layer is deliberately conservative:

- at most two language hosts are processed concurrently;
- at most three network requests can be active globally;
- each language host has a maximum budget of eight network attempts;
- transient statuses (`408`, `425`, `429`, `502`, `503`, `504`) and network timeouts receive up to three attempts;
- retry delays use exponential backoff;
- `Retry-After` seconds or HTTP dates are honored, capped at 30 seconds;
- redirect chains are followed manually and capped at six hops;
- successful cached responses avoid repeat network traffic;
- cache checkpoints are written every ten successful entries for resumability.

Transport failures and SEO findings are separate in console, Markdown and JSON output. A timeout, rate limit, network error or exhausted request budget cannot create fake missing-title, missing-meta, missing-H1, canonical or hreflang findings.

## Checks

For every requested language URL, the report records:

- HTTP status, final URL and every redirect hop;
- title, meta description and H1 values;
- robots directives and indexability;
- canonical URL, including cross-language canonical conflicts;
- all hreflang values, reciprocal English/base hreflang and `x-default`;
- page-sitemap inclusion when a suitable language page sitemap is available;
- comparison with the matching English page;
- exact cross-host title, meta-description and body-content duplicate groups;
- likely untranslated English markers and malformed encoding;
- legacy `malendo.property` website/email references, excluding the known Facebook and Instagram handles;
- malformed email, telephone, WhatsApp and internal contact links;
- copyright years older than the current year;
- indexable `coming soon`, `under construction`, `lorem ipsum` and test-page markers.

Contact-link checks validate the rendered href syntax and domain only. They do not prove that a mailbox, telephone number or WhatsApp account is operational.

## Classification Rules

Every discovered language host receives exactly one classification.

| Classification | Meaning | Required action |
| --- | --- | --- |
| `keep indexed` | Sampled pages are technically coherent, translated and indexable. | Monitor Search Console and translation quality. |
| `keep but correct` | The host works, but metadata, hreflang, sitemap or translation defects need correction. | Correct in GTranslate/WP admin, then re-run the audit. |
| `noindex pending GSC review` | A working host has a material canonical, duplication, legacy-data, placeholder or translation-quality conflict. | Review Search Console traffic and leads before temporarily noindexing. |
| `disable only after GSC confirmation` | Every sampled URL is definitively gone (`404`/`410`) or redirects off the language host. | Confirm traffic, backlinks and indexed URLs; prepare redirects before disabling anything. |
| `manual review` | Evidence is incomplete or transport-limited, including timeouts and rate limiting. | Re-run more slowly or inspect manually. Do not change indexation from this result alone. |

HTTP `429`, `403`, timeouts, exhausted request budgets and other transport uncertainty never produce a recommendation to disable a host.

## Hardened Validation Run

The fresh hardened public run discovered 103 language subdomains from the GTranslate hreflang/link surface and deterministically audited 206 language pages. The English sitemap index returned HTTP `200` with 22 child sitemap entries.

All 206 sampled language pages returned HTTP `200`; the run recorded zero transport failures. The report classified 102 hosts as `keep but correct` and one host as `noindex pending GSC review`. The Latin host was the noindex-review candidate because its homepage retained multiple English markers. This remains a GSC/manual-review recommendation, not an instruction to change production.

Missing `x-default` occurred on every sampled page. Fifty-two sampled pages had multiple H1 elements. One exact duplicate-title group joined the Malay and Sundanese Contact pages. These are audit signals requiring manual confirmation in GTranslate/WP admin.

The fresh run took about seven minutes because low concurrency and backoff are intentional. The subsequent Markdown and JSON validations reused 519 successful cache entries, made zero network attempts, and completed in seconds.

Run the tool at a different time before making decisions, then compare JSON outputs. A host should not move toward noindexing or retirement based on one audit.

## JSON Structure

The JSON report contains:

- `discovery`: seed paths, response evidence, base sitemap and host count;
- `classifications`: host totals by decision category;
- `statusDistribution`: HTTP status totals for deterministic page samples;
- `transport`: failures by type, retry/budget statistics and per-host network-attempt counts;
- `cache`: hit/miss/write statistics and TTL, without exposing a local path;
- `hosts`: languages, discovery evidence, deterministic sampling, requested pages, metadata, redirects, hreflang, sitemap checks, `seoFindings`, `transportFailures` and classification;
- `duplicateGroups`: exact title, description and body duplicates spanning multiple hosts;
- `warnings` and `safety`: collection limitations and mandatory safeguards.

## Recommended Human Review

1. Export Google Search Console performance and indexation data for each active language property or URL pattern.
2. Identify which languages receive clicks, impressions, leads or backlinks.
3. Manually review a representative commercial landing page and estate page in every language being considered for indexation.
4. Correct missing reciprocal hreflang and `x-default` in GTranslate or its supported configuration layer.
5. Confirm translated title, description, H1, contact details and legal text with a fluent reviewer for commercially important languages.
6. Re-run this audit and compare status, canonical, duplicate and sitemap evidence.
7. Only then decide whether a low-value host should stay indexed, be noindexed temporarily, or be retired with approved redirects.

## Do Not Do This

- Do not disable a language subdomain because one audit timed out.
- Do not noindex or remove a host before checking Google Search Console.
- Do not alter DNS, Cloudflare, GTranslate, redirects, robots, canonicals or sitemaps from this report alone.
- Do not run a blind database replacement for language URLs.
- Do not treat automated translation heuristics as a substitute for a fluent editorial review.
- Do not assume a syntactically valid contact link proves delivery.
- Do not edit WordPress core, plugins or the MyHome parent theme.

## Rollback

This PR adds only a local read-only script and this document. Revert the PR to remove them. There is no production, WordPress, DNS or GTranslate rollback because the audit does not change those systems.
