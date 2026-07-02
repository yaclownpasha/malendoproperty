# Malendo Task Status

## Purpose

This document is the owner/operator status tracker for Malendo Property. It shows what has already been completed, what still needs human WordPress admin / MyHome / Yoast cleanup, and what Codex/Git should do later.

Latest reference QA command:

```bash
node scripts/check-malendo-live.mjs --markdown
```

## Current Overall Status

Latest live QA summary:

| Status | Count |
| --- | ---: |
| PASS | 81 |
| WARNING | 4 |
| FAIL | 19 |

Current interpretation:

- Core safety checks are passing.
- The bad Submit/Application URL no longer reaches visitors in rendered HTML.
- `drunkentiki.com` is no longer found.
- `chrome-extension://` contamination currently reports `0` failures.
- Legacy `Malendo.property` / `http://malendo.property` warnings currently report `0` in the latest QA run.
- Remaining `FAIL` items are the 19 sell estate canonical URLs listed below.
- Remaining `WARNING` items are sitemap/indexation cleanup signals.

## Completed Codex/Git Work

- GA4 tag deployed: confirms Google Analytics measurement ID is present on sampled live pages.
- `lead-events.js` deployed: provides click and form-attempt lead event tracking.
- `generate_lead` tracking deployed: sends GA4 recommended lead events for high-intent lead actions.
- Form tracking refined: avoids counting WooCommerce add-to-cart, sorting, search, and filter forms as false leads.
- REST users endpoint hardened: logged-out `/wp-json/wp/v2/users` checks pass.
- Author/user archive noindex added: reduces risk from public author/user archive indexation.
- Production deploy workflow hardened: reduces accidental deploy risk.
- Temporary bad Submit URL safety patch deployed: rewrites the exact bad Submit/Application URL in rendered frontend HTML.
- Bad Submit URL no longer reaches visitors in rendered HTML.
- `drunkentiki.com` no longer found by the live QA script.
- Broken Sell Property replacement URLs are working.
- `chrome-extension://` contamination currently reports `0` failures in the latest QA run.
- Legacy `Malendo.property` / `http://malendo.property` warnings currently report `0` in the latest QA run.
- Live QA script now includes grouped Markdown/JSON output and sitemap/indexation warning checks.

## Remaining Human WP-admin Tasks

- Fix the 19 sell estate canonicals listed below.
- Review/noindex WooCommerce products if Google Search Console shows low value or no useful product traffic.
- Review/noindex product categories.
- Review/noindex available sitemap content.
- Review/remove/noindex author/user sitemap content.
- Confirm the real Submit/Application URL source is fixed in WP admin, MyHome, menu, or database options before removing the temporary patch.
- Confirm CookieYes, Easy Social Share Buttons, contacts, phone, WhatsApp, and social settings remain clean if already fixed.

## 19 Canonical URLs To Fix

These sell estate pages still canonicalize to query URLs like `?post_type=estate&p=...` and should be fixed in WordPress admin / Yoast per-estate settings.

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

Recommended fix for each page:

1. Open the estate in WordPress admin.
2. Open Yoast SEO advanced settings for that estate.
3. Clear the Canonical URL field if it contains `?post_type=estate&p=...`, or replace it with the clean pretty URL.
4. Update the estate.
5. Clear cache.
6. View page source and confirm the canonical equals the clean pretty URL.
7. Rerun the live QA script.

## Remaining SEO Warnings

Latest sitemap/indexation warnings:

- 26 product sitemaps still present.
- Product category sitemap still present.
- Available sitemap still present.
- Author/user sitemap still present.

Recommended human review:

- Check Google Search Console for `/product/` traffic before bulk noindexing products.
- Decide whether WooCommerce product inventory is useful for SEO or only operational browsing.
- If products are low-value, configure Yoast/WooCommerce settings so weak product URLs leave the indexable sitemap.
- Review product category sitemap and noindex low-value product categories if they are not strategic landing pages.
- Review available sitemap content and noindex/remove it if it is thin or duplicate.
- Review author/user sitemap and remove/noindex it if it is not needed for SEO.

## Temporary Patch Status

The temporary Submit URL safety patch must stay.

Do not remove it until:

- the real WP admin / MyHome / menu source of the bad Submit/Application URL is verified fixed;
- cache is cleared;
- `node scripts/check-malendo-live.mjs --markdown` confirms the bad Submit/Application URL is absent;
- the site is checked with the temporary patch still present;
- then Codex prepares a small PR to remove only the temporary patch.

## How To Verify Progress

Run:

```bash
node scripts/check-malendo-live.mjs --markdown
```

Expected progress markers:

- `FAIL` should drop from `19` to `0` after canonical cleanup.
- `WARNING` should drop after sitemap/indexation cleanup.
- `Content Hygiene Failures` should remain `None`.
- `Warnings` should remain `None` for legacy `Malendo.property` / `http://malendo.property` strings.
- Bad Submit/Application URL safety should continue to pass.
- Do not remove the temporary Submit URL patch until QA confirms the real source is fixed.

## Next Codex Actions After Human Cleanup

After the human WP-admin / Yoast cleanup is complete:

- Re-run live QA.
- If no bad Submit URL source remains, create a small PR to remove the temporary Submit URL safety patch.
- Re-audit schema after brand/contact/indexation cleanup.
- Consider a future schema PR only after official brand, email, phone, address, service area, and social URLs are confirmed.
- Do not add schema until official business data is confirmed.

## Do Not Do

- Do not edit WordPress core.
- Do not edit the MyHome parent theme.
- Do not run a blind database replace.
- Do not bulk noindex products before checking Google Search Console if product traffic matters.
- Do not remove the temporary Submit URL patch too early.
- Do not use Git to mask problems that can be fixed cleanly in WordPress admin, MyHome, Yoast, or plugin settings.
