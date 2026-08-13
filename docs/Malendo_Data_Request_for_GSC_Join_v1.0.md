# Malendo Data Request for GSC Join v1.0

No required GSC, backlink, URL inventory, or non-PII CRM export was available in the workspace. Phase CDX-NOW-03 remains blocked by data; missing values must not be inferred.

## Required files

1. `Malendo_URL_Inventory_v1.0.xlsx`
   - URL, host, source, object type, current role, current status if known.
2. GSC Performance Pages CSV
   - `Page`, `Clicks`, `Impressions`, `CTR`, `Position`.
3. GSC Performance Queries CSV
   - `Query`, `Clicks`, `Impressions`, `CTR`, `Position`.
4. GSC Device CSV and Country CSV
   - dimension plus clicks, impressions, CTR, position.
5. GSC Page indexing export
   - indexing reason/state and every available example URL.
6. GSC Links exports
   - top internally linked Pages, top externally linked Pages, top linking sites, and available link counts.
7. Backlink export, if available
   - target URL, source domain/URL, link status, first/last seen, authority metric definition.
8. Non-PII CRM/lead aggregate
   - normalized landing URL, lead count, qualified-lead count, approved value band, period. No names, emails, phones, messages, unit numbers, document names, or form payloads.

## Required export settings

- Use one Search Console property and clearly state whether it is Domain or URL-prefix.
- Use the same date range for all Performance exports, preferably the latest complete six months ending no later than the export date.
- Include the exact property, timezone, export date, and date range in a small README.
- Export CSV as UTF-8; XLSX is acceptable for the URL inventory.
- Do not edit raw exports before delivery. Put any notes in a separate file.
- Do not commit exports to Git. Store them in an approved private local folder.

## Normalization rules to be applied locally

- lowercase scheme and host;
- preserve case-sensitive paths while recording a lowercase comparison key;
- normalize default ports and trailing slash consistently;
- decode only unambiguous URL encoding;
- strip fragments;
- retain raw query data privately but exclude query strings from reports;
- map translated hosts separately;
- preserve raw source filename and row number for every joined row;
- report ambiguous collisions instead of merging them.

## Required output cohorts

Pages, Posts, Categories, Estates/Listings, taxonomies, system/Woo, test/template, language hosts, First Wave, Management, Rent/Buy, and other.

Each cohort will report URL count, tested count, clicks, impressions, backlinks, indexing state, known aggregate lead/value, current role, evidence readiness, and a non-destructive preliminary status: `KEEP CANDIDATE`, `IMPROVE CANDIDATE`, `NEEDS EVIDENCE`, `CLEANUP PILOT CANDIDATE`, or `HOLD`.

No redirect, noindex, delete, 410, or removal request will be assigned automatically.
