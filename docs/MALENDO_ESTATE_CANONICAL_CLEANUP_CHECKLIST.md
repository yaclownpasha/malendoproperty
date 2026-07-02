# Malendo Estate Canonical Cleanup Checklist

## Problem Summary

The estate/listing canonical audits found a partial canonical URL issue on Malendo Property's MyHome estate pages.

Most estate pages have clean canonical URLs that match their pretty permalinks. Sampled rent estate pages were OK. However, some sell estate pages canonicalize to WordPress query URLs such as:

```text
https://malendo-property.com/?post_type=estate&p=4048
```

These affected pages are still indexable, so the canonical should be fixed in WordPress admin / Yoast per-estate settings. The preferred canonical for each active listing should be its clean pretty URL, for example:

```text
https://malendo-property.com/properties/thailand/phuket/sell/ozone-condo-kata/
```

## Scope

Audit findings:

- The estate sitemap had **214 estate URLs**.
- Mixed estate sample: **24/30** estate pages used pretty canonicals.
- Mixed estate sample: **6/30** estate pages used query canonicals.
- Full sell-page pass: **21/72** sell estate pages used query canonicals.
- Non-estate canonical audit found no similar issue in **59 sampled non-estate URLs**.

This appears to be a partial issue affecting specific sell estate pages, not the whole site.

## Affected Sell Estate URLs

These 21 sell estate URLs were found with query-style canonicals:

- `/properties/thailand/phuket/sell/ozone-condo-kata/`
- `/properties/thailand/phuket/sell/sea-and-sky-condo/`
- `/properties/thailand/phuket/sell/kata-sea-view-villas/`
- `/properties/thailand/phuket/sell/bluepoint-luxury-condominiums-5065/`
- `/properties/thailand/phuket/sell/bluepoint-luxury-condominiums-5069/`
- `/properties/thailand/phuket/sell/kamala-oceana-6/`
- `/properties/thailand/phuket/sell/kamala-oceana-5/`
- `/properties/thailand/phuket/sell/kamala-oceana-2/`
- `/properties/thailand/phuket/sell/kamala-oceana-19/`
- `/properties/thailand/phuket/sell/kamala-oceana-29/`
- `/properties/thailand/phuket/sell/privilege/`
- `/properties/thailand/phuket/sell/garden-properties-3/`
- `/properties/thailand/phuket/sell/garden-properties-6/`
- `/properties/thailand/phuket/sell/bright-condo-bangtao-10221/`
- `/properties/thailand/phuket/sell/bright-condo-bangtao-10219/`
- `/properties/thailand/phuket/sell/bright-condo-bangtao-10217/`
- `/properties/thailand/phuket/sell/bright-condo-bangtao-10207/`
- `/properties/thailand/phuket/sell/bright-condo-bangtao-10211/`
- `/properties/thailand/phuket/sell/bright-condo-bangtao-10214/`
- `/properties/thailand/phuket/sell/bright-condo-bangtao-10182/`
- `/properties/thailand/phuket/sell/bright-condo-bangtao/`

## Likely Root Cause

Most likely causes:

- per-estate Yoast canonical override
- old imported metadata
- MyHome estate settings
- legacy permalink metadata from imported or older listings

Less likely causes:

- child-theme code
- global Yoast canonical behavior
- global permalink settings

Reasoning:

- Many estate pages canonicalize correctly.
- Rent pages sampled were OK.
- Many sell pages canonicalize correctly.
- Non-estate canonical audit found no similar issue in 59 sampled non-estate URLs.

## WP Admin Cleanup Steps

Test on one affected estate first before changing all 21 pages.

1. Open WordPress admin.
2. Open the affected estate/listing editor.
3. Start with `/properties/thailand/phuket/sell/ozone-condo-kata/` as the first test page.
4. Open **Yoast SEO** settings for that estate.
5. Open **Advanced**.
6. Check the **Canonical URL** field.
7. If the canonical contains `?post_type=estate&p=...`, clear the field or replace it with the exact pretty URL.
8. If the Yoast canonical field is empty, check MyHome estate slug/permalink fields and any custom SEO/canonical fields.
9. Confirm the estate slug matches the intended pretty URL.
10. Update the estate.
11. Clear WordPress/server/cache plugin cache.
12. Open the public estate page in a logged-out browser.
13. View page source.
14. Confirm the canonical equals the pretty URL.
15. If the first test page is fixed safely, repeat the process for the remaining 20 affected URLs.

Preferred result example:

```html
<link rel="canonical" href="https://malendo-property.com/properties/thailand/phuket/sell/ozone-condo-kata/" />
```

Problem result to remove:

```html
<link rel="canonical" href="https://malendo-property.com/?post_type=estate&p=4048" />
```

## Verification Checklist

For each affected page, verify:

- HTTP status is `200`.
- Meta robots is `index, follow` if the page should stay indexed.
- Canonical equals the pretty URL.
- Canonical does not contain `?post_type=estate&p=`.
- Canonical does not point to `malendo.property`.
- Canonical does not point to any other old or external domain.
- Page remains in `estate-sitemap.xml` if it should be indexed.
- No PHP warnings or fatal errors appear in HTML.
- Page layout still works.
- Header, footer, contact links, and Submit/Application link still work.

Suggested source check:

1. Open the public URL.
2. View page source.
3. Search for `canonical`.
4. Confirm the canonical value is the pretty URL.
5. Search for `?post_type=estate&p=`.
6. Confirm there are zero matches in the canonical tag.

## SEO Risk

Risk level if ignored: **Medium**.

Why it matters:

- Query canonicals can split or redirect ranking signals away from the clean listing URL.
- Google may choose ugly query URLs for reporting or indexing signals.
- Sitemap URLs and canonical URLs send inconsistent signals.
- Search Console reporting becomes harder to interpret.
- Clean listing URLs are more trustworthy and easier to share.

This is not a full-site emergency because most sampled estate and non-estate canonicals are correct, but the 21 affected sell pages should be cleaned up.

## What Not To Do

- Do not run a blind database replace.
- Do not bulk edit database records without a backup and a tested rollback plan.
- Do not change permalink settings globally just to fix these 21 pages.
- Do not add a child-theme canonical override until WP admin / Yoast cleanup is tested.
- Do not noindex active sale pages just to hide the canonical issue.
- Do not bulk overwrite MyHome/WPBakery serialized estate content.
- Do not edit WordPress core or the MyHome parent theme.

## Codex Follow-Up

After human cleanup:

1. Ask Codex to re-run a read-only canonical audit on the 21 affected URLs.
2. If all affected pages pass, no code is needed.
3. If WP admin / Yoast / MyHome settings cannot fix the issue, consider a very targeted Codex/Git PR using canonical filters.
4. Any future code fix should apply only to affected estate canonical generation and should not rewrite broad site canonicals.
5. A future PR must include validation showing:
   - affected URLs canonicalize to pretty URLs
   - unaffected rent/sell estate pages remain unchanged
   - non-estate page canonicals remain unchanged
   - no PHP syntax errors

Do not use Git to mask a per-post Yoast setting if the issue can be fixed safely in WordPress admin.