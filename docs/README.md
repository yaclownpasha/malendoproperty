# Malendo Operational Docs Index

This folder contains Malendo Property checklists and cleanup plans for the owner/operator, WordPress admin, and technical helpers.

Production site: `https://malendo-property.com`

## Start Here

Use these documents when reviewing changes, cleaning up WordPress admin settings, or checking the live site.

| Document | What it is for |
|---|---|
| [MALENDO_DEPLOY_QA_CHECKLIST.md](MALENDO_DEPLOY_QA_CHECKLIST.md) | Deploy, approval, rollback, smoke test, and GA4 checks after Git changes. |
| [MALENDO_WP_ADMIN_CLEANUP_CHECKLIST.md](MALENDO_WP_ADMIN_CLEANUP_CHECKLIST.md) | WP admin, MyHome, Yoast, plugin, contact, menu, and content cleanup tasks. |
| [MALENDO_SEO_INDEXATION_CLEANUP_PLAN.md](MALENDO_SEO_INDEXATION_CLEANUP_PLAN.md) | Sitemap bloat, WooCommerce products, demo pages, and noindex strategy. |
| [MALENDO_LANDING_PAGE_SEO_PLAN.md](MALENDO_LANDING_PAGE_SEO_PLAN.md) | Exact title, meta description, and H1 recommendations for priority commercial pages. |
| [MALENDO_ESTATE_CANONICAL_CLEANUP_CHECKLIST.md](MALENDO_ESTATE_CANONICAL_CLEANUP_CHECKLIST.md) | Cleanup checklist for 21 sell estate pages with query canonical issues. |
| [MALENDO_LIVE_QA_SCRIPT.md](MALENDO_LIVE_QA_SCRIPT.md) | How to run the live QA script and interpret PASS / WARNING / FAIL output. |

## Live QA Script

Script path:

```text
scripts/check-malendo-live.mjs
```

Run it from the repository root:

```bash
node scripts/check-malendo-live.mjs
```

The script is read-only. It checks live pages, bad Submit/Application URLs, GA4/lead tracking markers, REST user exposure, known broken links, chrome-extension contamination, and known estate canonical issues.

## Recommended Order Of Use

1. Read [MALENDO_WP_ADMIN_CLEANUP_CHECKLIST.md](MALENDO_WP_ADMIN_CLEANUP_CHECKLIST.md).
2. Fix P0/P1 WP-admin issues.
3. Run the live QA script: `node scripts/check-malendo-live.mjs`.
4. Use [MALENDO_SEO_INDEXATION_CLEANUP_PLAN.md](MALENDO_SEO_INDEXATION_CLEANUP_PLAN.md).
5. Apply [MALENDO_LANDING_PAGE_SEO_PLAN.md](MALENDO_LANDING_PAGE_SEO_PLAN.md) in Yoast / WP admin.
6. Use [MALENDO_ESTATE_CANONICAL_CLEANUP_CHECKLIST.md](MALENDO_ESTATE_CANONICAL_CLEANUP_CHECKLIST.md).
7. Use [MALENDO_DEPLOY_QA_CHECKLIST.md](MALENDO_DEPLOY_QA_CHECKLIST.md) after every Git change.

## Do Not Do This

- Do not edit WordPress core.
- Do not edit the MyHome parent theme.
- Do not run a blind database replace.
- Do not remove the temporary Submit URL patch until the real source is fixed and verified.
- Do not add schema until official brand, email, phone, address/service area, and social profile URLs are confirmed.
- Do not noindex products before checking Google Search Console if product traffic matters.
- Do not bulk overwrite WPBakery/MyHome serialized content.
- Do not add secrets, passwords, API keys, SSH keys, database dumps, or backups to Git.

## Notes

Most cleanup tasks in these docs are WordPress admin / Yoast / MyHome / plugin settings tasks, not Git changes. Codex/Git should be used for child-theme code, scripts, documentation, and workflow changes only when admin settings cannot safely solve the issue.