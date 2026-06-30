# Malendo Property WordPress project

## Project

Production domain: malendo-property.com
Stack: WordPress, MyHome parent theme, custom child theme `malendo-child`

## Allowed paths

Codex may modify only:

- `wp-content/themes/malendo-child/`
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
```

Definition of done:

- no PHP syntax errors
- no WordPress core or MyHome parent changes
- no credentials in the diff
- rollback instructions included

## Deploy

After merge to `main`, GitHub Actions deploys `wp-content/themes/malendo-child/` to the server via SSH/scp.

Manual run: GitHub → Actions → Deploy child theme → Run workflow.
