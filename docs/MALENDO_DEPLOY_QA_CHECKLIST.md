# Malendo Deploy and QA Checklist

Use this checklist before and after every Malendo Property code change. It is written for an owner/operator and assumes production is `https://malendo-property.com`.

## 1. Before Merging a PR

Before merging, confirm all of the following:

- The PR changes only allowed paths:
  - `wp-content/themes/malendo-child/`
  - `scripts/`
  - documentation files
  - `.github/workflows/`
- The PR does not change WordPress core.
- The PR does not change the MyHome parent theme.
- The PR does not change `wp-content/uploads/`.
- The PR does not include backups, database dumps, exported site files, or ZIP archives.
- The PR does not include passwords, API keys, SSH keys, tokens, or other secrets.
- The PR description explains:
  - what changed
  - which files changed
  - how it was validated
  - how to roll back
- If PHP changed, confirm the PHP syntax check passed:

  ```bash
  find wp-content/themes/malendo-child -type f -name '*.php' -print0 | xargs -0 -n1 php -l
  ```

- If JavaScript changed, confirm:
  - no browser console errors were added
  - clicks still navigate normally
  - forms still submit normally
  - lead tracking still fires only once per action
- Confirm the PR will not automatically deploy unless that is intended.
- If anything looks unclear, do not merge yet. Ask for clarification first.

## 2. Merge and Deploy Process

When the PR is approved and ready:

1. Merge the PR on GitHub.
2. Open the repository on GitHub.
3. Go to **Actions**.
4. Open **Deploy child theme**.
5. If production environment approval appears, approve only after reviewing the merged change.
6. Wait for the workflow to finish.
7. Confirm the workflow conclusion is **success**.
8. Ignore Node.js deprecation warnings unless the job fails.
9. If the job fails, read the first red error line. Do not treat warnings as the root cause unless the job failed because of them.
10. Do not start another deploy while a deploy is already running.

## 3. Live Smoke Test After Deploy

Check these pages after every deploy:

- Homepage: `https://malendo-property.com/`
- Contact page: `https://malendo-property.com/contact/`
- Submit application page: `https://malendo-property.com/submit-your-application/`
- One estate/listing page
- One product page

For each page, confirm:

- The page returns HTTP `200`.
- There is no visible PHP warning text.
- There is no visible PHP fatal error text.
- The layout looks normal.
- The header is visible.
- The footer is visible.
- The Submit/Application link points to `https://malendo-property.com/submit-your-application/`.
- The rendered page does not contain `drunkentiki.com`.
- The rendered page does not contain the exact bad submit URL `https://malendo.property/submit-your-application/`.

If any check fails, stop and roll back before making more changes.

## 4. Lead Tracking Test

Use GA4 DebugView or an approved browser testing method.

Confirm:

- GA4 ID `G-D99Y7TY0LC` is present on the page.
- `lead-events.js` is loaded.
- Phone click sends the original phone click event and `generate_lead`.
- Email click sends the original email click event and `generate_lead`.
- WhatsApp click sends the original WhatsApp click event and `generate_lead`.
- Submit/Application click sends the original submit/application click event and `generate_lead`.
- Property card click sends the property card click event.
- Property card click does not send `generate_lead`.
- Each lead action sends `generate_lead` only once.
- Navigation is not blocked or delayed.
- Forms are not broken.

## 5. Security and SEO Checks

After deploy, confirm:

- `https://malendo-property.com/wp-json/wp/v2/users` does not expose users to logged-out visitors.
- Author/user archive pages are `noindex, follow` if accessible.
- There are no bad `malendo.property` submit links.
- `info@malendo.property` is reported separately as a WP-admin/content issue until fixed.
- `Malendo.property` site identity is reported separately as a WP-admin/Yoast issue until fixed.
- Do not fix WP-admin/content issues in Git unless explicitly approved.

## 6. Known Temporary Patches

There is a temporary child-theme output-buffer safety patch for the old bad Submit/Application link.

It rewrites only these exact bad URLs:

- `https://malendo.property/submit-your-application/`
- `http://malendo.property/submit-your-application/`

It rewrites them to:

- `https://malendo-property.com/submit-your-application/`

Important rules:

- This patch is temporary.
- It exists because the real source is likely in WordPress admin, MyHome settings, a menu, or database content.
- Remove it only after the real WP admin/MyHome/menu source is fixed and verified.
- Do not remove it just because the rendered link looks fixed.
- After removing it, re-run the full live smoke test.

## 7. Rollback Process

If a deploy causes a problem:

1. Stop merging new PRs.
2. Identify the bad PR or bad commit.
3. Revert the bad PR or restore the previous known-good commit.
4. Redeploy through the approved GitHub Actions workflow.
5. Clear WordPress, server, and cache plugin cache.
6. Re-run the live smoke test.
7. Re-run the lead tracking test.
8. Record what broke, which URL was affected, and which rollback fixed it.

Do not keep testing new fixes on production while the broken deploy is still live. Roll back first, investigate second.

## 8. WP Admin Cleanup Checklist

These are known non-Git tasks. Fix them in WordPress admin, MyHome, Yoast, plugin settings, or database options as appropriate.

- Fix `info@malendo.property` after confirming the correct mailbox exists and works.
- Fix these broken sale links:
  - `/sell-property/sell-apartments`
  - `/sell-property/sell-bungalows`
  - `/sell-property/sell-warehouses-factories`
- Confirm WhatsApp number `66635080136`.
- Confirm phone number `+66888357304`.
- Standardize the official Facebook URL.
- Change `Malendo.property` to `Malendo Property` in WordPress and Yoast settings.
- Fix user profile URLs that output `http://malendo.property`.

Do not bulk-edit WPBakery, MyHome, estate, product, or serialized page content without explicit approval.

## 9. Emergency Notes

If a deploy breaks the site:

- Stop merging new PRs.
- Do not deploy another unrelated PR.
- Capture the first red error from GitHub Actions.
- Capture the affected URL.
- Capture a screenshot of the visible problem.
- Roll back first.
- Investigate second.
- After rollback, re-run smoke tests and lead tracking tests.
