# Malendo Production Content Cleanup Checklist

Use this checklist when live pages show demo, placeholder, old-brand, old-domain, or old-contact content on `https://malendo-property.com`.

This is a WordPress admin / MyHome / Yoast / content cleanup checklist. Do not bulk-edit WPBakery/MyHome serialized content, estate records, WooCommerce products, database rows, uploads, parent theme files, WordPress core, deploy workflows, server config, or production config from Git.

## Official Production Details

Use these values when replacing old visible contact or brand text:

- Brand: `Malendo Property`
- Description: `Real estate and property management in Phuket`
- Location: `Patong, Phuket, Thailand`
- WhatsApp: `+66 63 508 0136`
- Email: `acrabash@gmail.com`
- Copyright: `© 2026 Malendo Property. All rights reserved.`

Do not invent properties, prices, ratings, awards, licenses, reviews, guarantees, or claims.

## Audit Findings

Repo search was run for:

- `Wayback Machine Downloader`
- `Footer Example`
- `free demo result`
- `demo`
- `placeholder`
- `lorem`
- `Malendo.property`
- `info@malendo.property`
- `http://malendo.property`
- `2024 copyright`

### Repo-Controlled Findings

- `wp-content/themes/malendo-child/functions.php` contains `https://malendo.property/submit-your-application/` and `http://malendo.property/submit-your-application/` only inside the temporary output-buffer safety patch. This is intentional and should stay until the real WP admin / MyHome / menu source is fixed and verified.
- `scripts/check-malendo-live.mjs` contains old-brand and old-domain strings as QA needles. These are monitoring references, not production-visible copy.
- Existing docs contain old-brand and old-domain strings as cleanup instructions. These are documentation references, not production-visible copy.

No repo-controlled production template copy was found for `Wayback Machine Downloader`, `Footer Example`, `free demo result`, `lorem`, or `2024 copyright`.

### Live/Admin-Controlled Findings To Review

Live public HTML has shown items that should be reviewed in WordPress admin, MyHome, Yoast, Contact Form 7, Chaty/CookieYes, or page-builder content:

- Social/profile URLs with `Malendo.property`, such as Instagram/Facebook profile URLs. Confirm whether these are still official accounts. If the handles remain official, keep them. If they are old-brand accounts, update the profile URLs through the correct admin setting.
- Old media URLs on the property management page, such as `https://malendo.property/wp-content/uploads/2024/01/...`. These appear to come from WordPress page content or page-builder image fields, not repo files.
- Contact form placeholder text such as `Jonh`, numeric examples, or generic placeholders. These are controlled by form/page-builder settings.
- Parent theme / plugin technical strings containing `demo` or `placeholder`, such as MyHome font asset URLs, CSS class names, JavaScript config keys, cookie placeholders, and chat input placeholders. These are not guest-facing copy in the child theme.
- Yoast/site identity/user profile references to old brand/domain/email are expected to be admin cleanup items until corrected.

## WordPress Admin Cleanup Steps

1. Open WordPress admin.
2. Check **Settings -> General**:
   - Site Title: `Malendo Property`
   - Tagline: use only current brand copy, or leave blank if unsure.
3. Check Yoast / SEO plugin settings:
   - Organization/site name should be `Malendo Property`.
   - Website URL should be `https://malendo-property.com/`.
   - Remove `Malendo.property`, `info@malendo.property`, and `http://malendo.property` if present.
4. Check MyHome theme options and menus:
   - Footer brand/copyright uses `© 2026 Malendo Property. All rights reserved.`
   - Contact/footer copy uses `Patong, Phuket, Thailand`.
   - WhatsApp is `+66 63 508 0136`.
   - Email is `acrabash@gmail.com`.
   - Submit/Application links use `https://malendo-property.com/submit-your-application/`.
5. Check social links:
   - Confirm whether current Facebook, Instagram, Telegram, or other handles are official.
   - Update old-brand links only after confirming the replacement official profile exists.
6. Check Contact Form 7 or the active form builder:
   - Replace typo placeholders such as `Jonh` with neutral labels such as `Name`.
   - Keep phone and WhatsApp contact details consistent.
7. Check the property management page and other service pages:
   - Replace old `https://malendo.property/wp-content/uploads/...` image URLs with current `https://malendo-property.com/wp-content/uploads/...` URLs through the page builder/media field.
   - Do not run a blind database replace.
8. Clear WordPress cache, hosting cache, and CDN/cache-plugin cache if available.
9. Retest in a fresh incognito/private browser window.

## Demo / Placeholder Review Rules

Do not treat every technical `demo` or `placeholder` substring as a visible content bug.

Classify each hit before changing anything:

- Production-visible page copy: fix in WordPress admin/content or repo template, depending on source.
- Form placeholder visible to users: fix in the form builder/admin screen.
- Parent theme asset URL or CSS class: do not edit the MyHome parent theme from this repo.
- Plugin JavaScript/config key: leave unless it is visibly wrong for users.
- Documentation/script QA needle: keep if it exists to detect regressions.

## Manual QA Checklist

After cleanup and cache purge:

1. Open these pages in incognito/private browsing:
   - `https://malendo-property.com/`
   - `https://malendo-property.com/contact/`
   - `https://malendo-property.com/submit-your-application/`
   - `https://malendo-property.com/properties/`
   - `https://malendo-property.com/thailand/phuket/services/property-management/`
2. Confirm visible footer/contact/homepage copy uses:
   - `Malendo Property`
   - `Real estate and property management in Phuket`
   - `Patong, Phuket, Thailand`
   - `WhatsApp: +66 63 508 0136`
   - `Email: acrabash@gmail.com`
   - `© 2026 Malendo Property. All rights reserved.`
3. Confirm there is no visible guest-facing copy for:
   - `Wayback Machine Downloader`
   - `Footer Example`
   - `free demo result`
   - `lorem`
   - `info@malendo.property`
   - `http://malendo.property`
4. Confirm visible `demo` or `placeholder` hits are not user-facing bad copy.
5. Confirm Submit/Application links still go to `https://malendo-property.com/submit-your-application/`.
6. Run the live QA script:

   ```bash
   node scripts/check-malendo-live.mjs --markdown
   ```

7. Review any `FAIL` or `WARNING` sections before merging more production changes.

## Recommended Next Steps

- Fix admin/content-owned old-brand, old-domain, email, and media URL issues in WordPress admin or the relevant plugin/theme settings.
- Keep the temporary child-theme Submit/Application URL safety patch until the source menu/MyHome/admin URL is corrected and verified.
- After admin cleanup, rerun `node scripts/check-malendo-live.mjs --markdown`.
- Remove the temporary safety patch only in a separate PR after the rendered site stays clean without relying on the patch.

## Rollback Notes

This checklist is documentation only. It does not change production behavior.

If an admin cleanup change causes a visible problem:

1. Revert the specific admin setting manually.
2. Clear WordPress, hosting, and CDN cache.
3. Retest the affected page in incognito/private browsing.
4. Run the live QA script again.

Do not use a blind database restore or global search/replace unless a human explicitly approves that recovery path.
