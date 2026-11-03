# Malendo Property WordPress project

## Project

Production domain: malendo-property.com
Current production (verified 2026-11-04): WordPress with standalone theme `malendo-recovery`,
on `malendo-web-prod-01` (`152.42.198.33`), under `/srv/malendo-recovery/site/`.
The MyHome parent / `malendo-child` combination is a legacy source reference; preserve it.
See `docs/MALENDO_RECOVERY_BASELINE.md` for provenance, checks and the review gate.

## Allowed paths

Codex may modify only:

- `wp-content/themes/malendo-child/`
- `wp-content/themes/malendo-recovery/` (verified baseline; subsequent changes require their own task)
- `scripts/`
- documentation files
- GitHub workflow files (`.github/workflows/`)

## Forbidden paths and actions

Never:

- edit WordPress core
- edit the MyHome parent theme
- edit `wp-config.php`
- add passwords, API keys or SSH keys to Git
- modify `wp-content/uploads`
- commit database dumps or backups
- deploy directly to production without human approval
- publish WordPress content without explicit approval
- install plugins without explaining why
- delete production data
- bulk overwrite WPBakery/MyHome serialized page content via REST API

## WordPress content

Page and post text: WordPress REST API (user `codex-bot`), not Git.

That REST account description belongs to the legacy environment; do not assume it grants
access to the recovery site. Keep private enquiries (including #52 and #56), page content,
SQL, backups, credentials and `rendered/` out of Git. Baseline work must not change the
enquiry saving mechanism, GA4, live pages, database or server configuration.

Native estates (`estate` post type) and WooCommerce products: do not bulk-edit without explicit approval.

## Workflow

For every task:

1. Explain the proposed change
2. Work in branch `codex/<task>`
3. Make the smallest necessary change
4. Run PHP syntax checks on changed `.php` files
5. Summarize modified files
6. Create a pull request
7. Do not merge or deploy to production automatically

## Validation

```bash
find wp-content/themes/malendo-child -type f -name '*.php' -print0 | xargs -0 -n1 php -l
find wp-content/themes/malendo-recovery -type f -name '*.php' -print0 | xargs -0 -n1 php -n -l
```

Definition of done:

- no PHP syntax errors
- no WordPress core or MyHome parent changes
- no credentials in the diff
- rollback instructions included

## Deploy

The legacy `Deploy child theme` workflow deploys only `malendo-child` via SSH/scp.
Its push trigger requires `main` plus changes to that theme or `.github/workflows/deploy.yml`;
it also allows manual dispatch. Its secret target has not been verified for the recovery VPS.
Do not run, dispatch or change it for the recovery baseline or notifications task.
There is no approved recovery deployment workflow. A Draft PR is not a release:
independent Work acceptance and separate explicit merge/deploy authorization are required.
