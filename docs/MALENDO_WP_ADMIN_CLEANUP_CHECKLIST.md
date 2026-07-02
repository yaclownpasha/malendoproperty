# Malendo WP Admin Cleanup Checklist

## Purpose

This document tracks remaining cleanup tasks that should be handled by a human WordPress admin/operator, not by Git or Codex code changes.

These tasks live in WordPress admin, MyHome settings, Yoast settings, CookieYes, Easy Social Share Buttons, Chaty, menus, user profiles, and editable page/listing content. They should be fixed carefully through the relevant admin screen, then verified on the live site.

Production domain: `https://malendo-property.com`

## Critical P0 Tasks

### P0: Fix CookieYes Registered Site URL Mismatch

- Problem: the live site console reports that the CookieYes registered website URL has changed or does not match the current site.
- Where to fix: CookieYes dashboard -> Organizations & Sites / site settings.
- Old value: unknown or old registered domain.
- New value: `https://malendo-property.com`
- Confirmation needed before changing: no, unless there are multiple CookieYes sites in the account.
- How to verify:
  - Open `https://malendo-property.com/` in a logged-out browser.
  - Open the browser console.
  - Confirm the CookieYes registered URL/config error is gone.
  - Confirm the cookie banner still appears and works normally.
- Risk if ignored: consent banner behavior may be unreliable, which creates compliance and trust risk.
- Codex/Git later: no. This is a CookieYes account/plugin configuration task.

### P0: Fix the Real Bad Submit/Application URL Source

- Problem: the site previously rendered a bad global Submit/Application URL that pointed to `malendo.property`, which resolved away from the real Malendo site. A temporary child-theme safety patch currently rewrites the exact bad URL on rendered frontend HTML, but the real WP/MyHome/menu source still needs cleanup.
- Where to fix:
  - WordPress admin -> Appearance -> Menus
  - MyHome theme options
  - Header/footer CTA settings
  - Mega menu settings
  - Any Submit/Application button settings
- Old values:
  - `https://malendo.property/submit-your-application/`
  - `http://malendo.property/submit-your-application/`
- New value: `https://malendo-property.com/submit-your-application/`
- Confirmation needed before changing: no.
- How to verify:
  - Clear WordPress/server/cache plugin cache.
  - Open homepage, contact page, submit page, one estate page, one product page, and one product category page.
  - Confirm Submit/Application links point to `https://malendo-property.com/submit-your-application/`.
  - Confirm rendered HTML does not contain `https://malendo.property/submit-your-application/`.
  - Confirm rendered HTML does not contain `http://malendo.property/submit-your-application/`.
  - Confirm rendered HTML does not contain `drunkentiki.com`.
- Risk if ignored: critical trust loss and lost leads if the temporary patch is removed or bypassed.
- Codex/Git later: yes. After the real source is fixed and verified, ask Codex to remove the temporary child-theme safety patch in a small PR.

### P0: Fix Contact Page Legacy Email

- Problem: the contact page still shows the legacy email domain.
- Where to fix:
  - WordPress admin -> Pages -> Contact
  - WPBakery/Elementor content blocks if used
  - MyHome contact settings
  - Header/footer/contact widgets if duplicated there
- Old value: `info@malendo.property`
- New value: `info@malendo-property.com`, but only after the mailbox is confirmed working.
- Confirmation needed before changing: yes. Confirm `info@malendo-property.com` can receive and send mail first.
- How to verify:
  - Send a test email from an external account to `info@malendo-property.com`.
  - Confirm the mailbox receives it.
  - Reply from the mailbox.
  - Confirm the contact page visible email and any `mailto:` link use the confirmed address.
- Risk if ignored: leads may go to an old or unmonitored mailbox.
- Codex/Git later: no, unless the email is found hardcoded in child-theme files.

## P1 Tasks

### P1: Confirm `info@malendo-property.com` Mailbox Works

- Problem: the desired replacement email should not be published until it is confirmed operational.
- Where to fix: email hosting/admin panel, not WordPress.
- Old value: unknown mailbox status.
- New value: confirmed working mailbox `info@malendo-property.com`.
- Confirmation needed before changing: yes.
- How to verify:
  - Send a test inbound email.
  - Send a test outbound reply.
  - Confirm owner/operator can access the mailbox.
- Risk if ignored: updating the site before the mailbox works can lose leads.
- Codex/Git later: no.

### P1: Fix Three Broken Sell Property Links

- Problem: three internal Sell Property links return 404 and should point to the existing singular URLs.
- Where to fix:
  - WordPress admin -> Appearance -> Menus
  - MyHome mega menu/category menu
  - Product category content
  - Footer/header link blocks
- Exact replacements:
  - `/sell-property/sell-apartments` -> `/sell-property/sell-apartment/`
  - `/sell-property/sell-bungalows` -> `/sell-property/sell-bungalow/`
  - `/sell-property/sell-warehouses-factories` -> `/sell-property/sell-warehouse-factory/`
- Confirmation needed before changing: no, unless the target pages are intentionally being replaced.
- How to verify:
  - Click each Sell Property link from the page/menu where it appears.
  - Confirm each destination returns HTTP `200`.
  - Confirm there are no visible 404 pages for these links.
- Risk if ignored: visitors hit dead ends during seller-intent flows.
- Codex/Git later: no, unless the links are later found hardcoded in Git.

### P1: Remove Chrome Extension Snippets From Estate Descriptions

- Problem: several estate pages contain server-rendered `chrome-extension://ldinpeekobnhjjdofggfgjlcehhmanlj/inpage.js` snippets. This should not be present in WordPress content.
- Where to fix:
  - WordPress admin -> Estates/listings editor
  - MyHome estate custom fields
  - WPBakery raw HTML blocks if used inside listings
  - Imported listing content fields
- Old value: `chrome-extension://ldinpeekobnhjjdofggfgjlcehhmanlj/inpage.js`
- New value: remove the snippet entirely.
- Confirmation needed before changing: no.
- How to verify:
  - Open each affected estate URL listed below.
  - View rendered HTML or page source.
  - Search for `chrome-extension://`.
  - Confirm there are zero matches.
- Risk if ignored: content hygiene issue, possible trust/security signal, and avoidable page bloat.
- Codex/Git later: no. This is rendered WordPress listing content, not child-theme code.

### P1: Standardize Brand Name in WP Site Identity, Yoast, and Schema

- Problem: the site still contains the old brand style in some settings.
- Where to fix:
  - WordPress admin -> Settings -> General
  - Appearance -> Customize -> Site Identity
  - Yoast SEO -> Settings -> Site basics / schema / organization info
  - MyHome theme options
- Old value: `Malendo.property`
- New value: `Malendo Property`
- Confirmation needed before changing: yes, confirm official brand capitalization.
- How to verify:
  - Check homepage title/schema output.
  - Check contact page schema output.
  - Check visible header/footer branding if applicable.
  - Confirm JSON-LD does not identify the organization as `Malendo.property`.
- Risk if ignored: weaker trust, inconsistent brand signals, and local SEO/schema inconsistency.
- Codex/Git later: possibly. Re-audit schema after cleanup.

### P1: Fix WordPress User Profile URLs Using Old Domain

- Problem: WordPress user profile URL fields can output the old domain in author/schema/user contexts.
- Where to fix: WordPress admin -> Users -> Profile -> Website field and any social/profile URL fields.
- Old value: `http://malendo.property`
- New value: `https://malendo-property.com` or blank if the field is not needed.
- Confirmation needed before changing: yes, decide whether each profile should have a website URL or be blank.
- How to verify:
  - Check user profile fields after saving.
  - Check author archive output if accessible.
  - Check schema/user references for `http://malendo.property`.
- Risk if ignored: old-domain references may remain in metadata or schema.
- Codex/Git later: no.

## P2 Tasks

### P2: Fix or Disable Easy Social Share Buttons Pinterest Module

- Problem: the browser console shows `essbPinImages is not defined` from the Easy Social Share Buttons Pinterest module.
- Where to fix: WordPress admin -> Easy Social Share Buttons settings -> Pinterest / Pinterest Pro module / asset settings.
- Old value: Pinterest module enabled or misconfigured while required variable is missing.
- New value: fixed Pinterest configuration, plugin update, or disabled Pinterest module if it is not needed.
- Confirmation needed before changing: only confirm whether Pinterest sharing is business-critical.
- How to verify:
  - Open homepage and a listing page.
  - Browser console should no longer show `essbPinImages is not defined`.
  - Social sharing buttons should still display as intended.
- Risk if ignored: console noise, small reliability risk, and unnecessary JavaScript error on pages.
- Codex/Git later: no. This is plugin configuration unless a child-theme override is later discovered.

### P2: Confirm Official Phone Number

- Problem: phone number should be confirmed before standardizing all site locations.
- Where to fix:
  - WordPress pages/contact blocks
  - MyHome agent/contact settings
  - Header/footer widgets
  - Chaty settings if used
- Current value to confirm: `+66888357304`
- New value: keep `+66888357304` if confirmed official, otherwise replace with the official number.
- Confirmation needed before changing: yes.
- How to verify:
  - Click visible phone links.
  - Confirm `tel:` links open the confirmed number.
  - Confirm visible text matches the confirmed number.
- Risk if ignored: calls may go to the wrong number.
- Codex/Git later: no, unless hardcoded in child-theme files.

### P2: Confirm Official WhatsApp Number

- Problem: WhatsApp number should be confirmed before standardizing all site locations.
- Where to fix:
  - Chaty settings
  - MyHome contact settings
  - Contact page buttons
  - Header/footer widgets
- Current value to confirm: `66635080136`
- New value: keep `66635080136` if confirmed official, otherwise replace with the official WhatsApp number.
- Confirmation needed before changing: yes.
- How to verify:
  - Click WhatsApp links.
  - Confirm the correct chat opens.
  - Confirm GA4 lead tracking still records WhatsApp clicks.
- Risk if ignored: WhatsApp leads may go to the wrong account.
- Codex/Git later: no, unless hardcoded in child-theme files.

### P2: Confirm Official Facebook, Instagram, and Telegram URLs

- Problem: social URLs should be confirmed before schema/social profile cleanup.
- Where to fix:
  - Yoast SEO -> Social profiles
  - MyHome theme options
  - Header/footer social widgets
  - Contact page/social blocks
- Current known social handles may include:
  - `https://www.instagram.com/malendo.property/`
  - `https://www.facebook.com/Malendo.Property/`
- New value: confirmed official Facebook, Instagram, and Telegram URLs.
- Confirmation needed before changing: yes.
- How to verify:
  - Click each social icon/link.
  - Confirm each opens the official Malendo profile.
  - Confirm Yoast/schema `sameAs` values match confirmed URLs.
- Risk if ignored: inconsistent trust and schema/social signals.
- Codex/Git later: possibly, only if a future schema PR is approved.

## P3 Technical Debt

### P3: Remove Temporary Child-Theme Submit URL Safety Patch Later

- Problem: a child-theme output safety patch temporarily rewrites only the exact bad Submit/Application URL on public frontend HTML.
- Where to fix later: Git/Codex PR in `wp-content/themes/malendo-child/`, after admin cleanup is complete.
- Old behavior: temporary patch rewrites:
  - `https://malendo.property/submit-your-application/`
  - `http://malendo.property/submit-your-application/`
- Desired future behavior: no temporary patch needed because the real WP/MyHome/menu source is corrected.
- Confirmation needed before changing: yes. Do not remove until the real source is fixed and live verification proves the bad URL no longer renders.
- How to verify before removal:
  - Fix WP/MyHome/menu source.
  - Clear cache.
  - Confirm rendered HTML no longer includes the bad exact URL.
  - Only then ask Codex to remove the patch in a PR.
- Risk if ignored: low short-term risk. The patch is intentional safety debt, but should not remain forever.
- Codex/Git later: yes.

## Exact Affected Estate URLs for Chrome-Extension Cleanup

Check and clean these estate/listing pages:

- `/properties/thailand/phuket/rent/carla-villa/`
- `/properties/thailand/phuket/rent/batterfly/`
- `/properties/thailand/phuket/rent/the-kris/`
- `/properties/thailand/phuket/rent/deluxe-mountain-view/`
- `/properties/thailand/phuket/sell/ozone-condo-kata/`
- `/properties/thailand/phuket/sell/sea-and-sky-condo/`
- `/properties/thailand/phuket/rent/splendid-sea-view-resort/`
- `/properties/thailand/phuket/rent/splendid-sea-view-resort-2/`
- `/properties/thailand/phuket/rent/splendid-sea-view-resort-3/`
- `/properties/thailand/phuket/rent/brand-new-luxury-villa-8261/`
- `/properties/thailand/phuket/rent/tropical-castle/`
- `/properties/thailand/phuket/rent/chic-condo/`
- `/properties/thailand/phuket/rent/villa-chalong/`
- `/properties/thailand/phuket/rent/nunan-villa-select/`

For each page, remove any occurrence of:

```text
chrome-extension://ldinpeekobnhjjdofggfgjlcehhmanlj/inpage.js
```

## What Not To Touch

- Do not edit WordPress core.
- Do not edit the MyHome parent theme.
- Do not edit `wp-config.php`.
- Do not edit `wp-content/uploads/` by hand.
- Do not run a blind database search/replace.
- Do not bulk overwrite WPBakery/MyHome serialized page content.
- Do not remove the temporary Submit URL safety patch until the real WP/MyHome/menu source is fixed and verified.
- Do not change Instagram or Facebook handles only because they contain `malendo.property`; confirm they are not official before changing them.
- Do not publish a new email address until its mailbox is confirmed working.
- Do not change phone or WhatsApp numbers until the owner/operator confirms the official values.

## Verification Checklist

### After URL/Menu Fixes

- Homepage returns HTTP `200`.
- Contact page returns HTTP `200`.
- Submit application page returns HTTP `200`.
- One estate/listing page returns HTTP `200`.
- One product page returns HTTP `200`.
- One product category/archive page returns HTTP `200`.
- Header and footer still look normal.
- Submit/Application links point to `https://malendo-property.com/submit-your-application/`.
- Rendered HTML does not contain `https://malendo.property/submit-your-application/`.
- Rendered HTML does not contain `http://malendo.property/submit-your-application/`.
- Rendered HTML does not contain `drunkentiki.com`.

### After Contact/Email Fixes

- `info@malendo-property.com` receives external test email.
- `info@malendo-property.com` can send a reply.
- Contact page visible text uses the confirmed email.
- Contact page `mailto:` link uses the confirmed email.
- Header/footer/contact widgets do not show the old email unless intentionally retained.
- GA4 lead tracking still loads after the page update.

### After Content Cleanup

- Each affected estate URL loads normally.
- Page layout still looks normal.
- Rendered HTML contains zero `chrome-extension://` references.
- No visible content was accidentally removed.
- No WPBakery/MyHome layout blocks were broken.

### After Plugin/Settings Fixes

- CookieYes console error is gone.
- Cookie consent banner still appears and functions normally.
- Easy Social Share Buttons no longer logs `essbPinImages is not defined`, or the remaining warning is intentionally accepted.
- Social share buttons still work where needed.
- Chaty still opens the confirmed WhatsApp/contact channel.

### After Schema/Site Identity Fixes

- Site title/identity uses `Malendo Property`.
- Yoast organization/site name uses `Malendo Property`.
- JSON-LD schema does not identify the business as `Malendo.property`.
- Schema/social profile URLs match confirmed official profiles.
- No old profile URL `http://malendo.property` appears from WordPress user profiles.

## When To Involve Codex Again

Involve Codex after the human admin cleanup is complete for these follow-up tasks:

1. Remove the temporary Submit URL safety patch after the real WP/MyHome/menu source is fixed and verified.
2. Re-audit schema after brand, contact, user profile, and social cleanup.
3. Consider a future schema PR only after these official details are confirmed:
   - official brand name
   - official email
   - official phone
   - official address or service area
   - official Facebook, Instagram, Telegram, and other social profile URLs
   - whether the business should be represented as `Organization`, `LocalBusiness`, `RealEstateAgent`, or connected schema nodes

Do not ask Codex to edit WordPress content directly unless there is explicit approval and a backup/rollback plan.