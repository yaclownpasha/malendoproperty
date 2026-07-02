# Malendo Live QA Script

## Purpose

`scripts/check-malendo-live.mjs` is a local/manual validation script for checking important live-site health signals on `https://malendo-property.com`.

It is intended for developers, Codex, or a technical operator to run after deploys or WordPress admin cleanup. The script is read-only: it fetches public URLs and checks rendered HTML, status codes, REST endpoint behavior, known bad links, tracking markers, content contamination markers, and known estate canonical issues.

## How To Run

From the repository root:

```bash
node scripts/check-malendo-live.mjs
node scripts/check-malendo-live.mjs --markdown
node scripts/check-malendo-live.mjs --json
```

Use Node.js 18 or newer so built-in `fetch` is available. The script does not require npm packages.

## Output Formats

- Default console output is grouped for a human operator.
- `--markdown` prints a clean Markdown report that can be sent to a WordPress admin employee.
- `--json` prints machine-readable JSON for automation or saving run history.

All modes keep the same exit-code behavior:

- exit `0` if there are no `FAIL` items
- exit `1` if any `FAIL` item exists
- warnings do not cause exit `1`

## What PASS / WARNING / FAIL Means

- `PASS`: the check matched the expected safe/live behavior.
- `WARNING`: something known or non-blocking still needs cleanup, but it should not fail the run yet.
- `FAIL`: a high-risk or regression check failed. The script exits with code `1` if any FAIL item exists.

Warnings do not cause exit code `1`.

## Report Sections

The script groups output into:

- Critical FAIL items
- WP-admin cleanup failures
- SEO/canonical failures
- Content hygiene failures
- SEO indexation warnings
- Warnings
- Passed safety checks
- Known WP-admin tasks
- Temporary Submit URL safety patch status
- Recommended next human actions
- Recommended next Codex action

## When To Run It

Run the script:

- after deploy
- after WordPress admin cleanup
- after clearing cache
- before removing the temporary Submit URL safety patch
- after fixing the 21 known estate canonical URLs
- after cleaning chrome-extension snippets from estate content
- after changing Yoast/WooCommerce indexation settings

## What It Checks

The script checks:

- key commercial pages return HTTP `200`
- bad Submit/Application URLs are not present
- `drunkentiki.com` is not present
- the corrected Submit/Application URL is present where expected
- GA4 ID `G-D99Y7TY0LC` is present
- `lead-events.js` is loaded
- logged-out REST user endpoints do not expose public user JSON
- old broken Sell Property links do not appear in sampled HTML or return `404`
- replacement Sell Property links return HTTP `200`
- known estate pages do not contain `chrome-extension://` or `hiro-wallet-provider`
- known affected sell estate pages do not canonicalize to `?post_type=estate&p=...`
- known affected sell estate pages do not canonicalize to `malendo.property`
- sitemap index entries are counted by type where detectable
- product sitemap count is reported as a warning if it is still very high
- product category, available, and author/user sitemaps are reported as warnings if still present
- demo/test pages are reported as warnings if they still return HTTP `200` without `noindex`
- legacy `Malendo.property`, `info@malendo.property`, and `http://malendo.property` strings are reported as warnings only

## SEO Indexation Checks

The script fetches `https://malendo-property.com/sitemap_index.xml` and looks for:

- product sitemaps
- estate sitemaps
- page sitemaps
- category sitemaps
- product category sitemaps
- available sitemaps
- author/user sitemaps

It also checks these known demo/test pages:

- `/about-me-2/`
- `/advanced-search-form/`
- `/video-fullscreen-buttons/`
- `/test/`
- `/test-2/`
- `/test-3/`

These checks are warning-only because they are WordPress admin / Yoast cleanup tasks, not code failures.

## Important Notes

- The script is read-only.
- The script does not submit forms.
- The script does not change WordPress.
- The script does not change MyHome, Yoast, WooCommerce, Chaty, or CookieYes settings.
- The script does not deploy anything.
- The script does not require secrets.
- Warnings for `info@malendo.property` and `Malendo.property` remain expected until WP-admin cleanup is complete.
- A FAIL item should be investigated before merging more production changes.

## Rollback

This script does not affect production. To roll back the script itself, revert the commit or remove:

- `scripts/check-malendo-live.mjs`
- `docs/MALENDO_LIVE_QA_SCRIPT.md`
