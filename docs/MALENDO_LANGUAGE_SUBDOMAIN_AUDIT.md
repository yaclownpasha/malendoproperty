# Malendo Language Subdomain SEO Audit

## Purpose

`scripts/audit-malendo-language-subdomains.mjs` is a read-only advisory audit for public language subdomains of `malendo-property.com`. It discovers the current public language surface instead of relying on a hard-coded language list, then records technical SEO and content-hygiene evidence for each discovered host.

The script sends HTTP `GET` requests only. It does not log in, submit forms, change WordPress, update GTranslate, alter DNS or Cloudflare, edit redirects, or write robots, canonical, hreflang or sitemap settings.

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

It requests every unique language URL found for those three discovery paths. For each language host, it also checks `sitemap_index.xml`, falls back to `wp-sitemap.xml`, and inspects a page sitemap when one is exposed.

Discovery is bounded and intentionally does not crawl every URL in every language sitemap. This keeps the audit practical and avoids an aggressive crawl across tens of thousands of translated product and estate URLs.

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

HTTP `429`, `403`, timeouts and other transport uncertainty never produce a recommendation to disable a host.

## First Validation Run

The first public run discovered 103 language subdomains from the GTranslate hreflang/link surface and 309 corresponding homepage, Contact and Properties URLs. The English sitemap index returned HTTP `200` with 22 child sitemap entries.

The run also demonstrated a material operational limitation: after sustained requests across the very large language surface, the translation layer returned HTTP `429` responses and timeouts for many hosts. Those hosts must remain `manual review`; their response failures are not evidence that the language versions should be disabled.

In the final JSON validation run, 29 of 309 language URL requests returned HTTP `200`, 16 returned HTTP `429`, and 264 timed out after earlier validation runs had already exercised the translation layer. Seven hosts were classified `keep but correct` from usable evidence and 96 were classified `manual review`. These counts describe that rate-limited run, not a permanent SEO decision.

Responsive sampled hosts showed translated titles, while missing `x-default` was a recurring hreflang issue. The validation run found no exact cross-host duplicate group, but that result is limited to pages that returned usable HTML during the run.

Run the tool again at a different time before making decisions, then compare the JSON outputs. A host should not move toward noindexing or retirement based on one rate-limited audit.

## JSON Structure

The JSON report contains:

- `discovery`: seed paths, response evidence, base sitemap and host count;
- `classifications`: host totals by decision category;
- `hosts`: languages, discovery evidence, requested pages, metadata, redirects, hreflang, sitemap checks, content checks, findings and classification;
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
