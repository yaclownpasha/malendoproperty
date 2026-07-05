# Malendo Image Optimization Audit

## Purpose

This document explains how to run the read-only Malendo image optimization audit and how to interpret the results.

The audit helps the owner/operator find large images that may slow the WordPress site after the WooCommerce and Contact Form 7 asset cleanup work. It does not change WordPress, does not submit forms, does not edit media, and does not require secrets.

## Script

```bash
node scripts/audit-malendo-images.mjs
node scripts/audit-malendo-images.mjs --markdown
node scripts/audit-malendo-images.mjs --json
```

The script audits:

- Homepage
- Properties archive
- Contact page
- Submit Application page
- Rent Villas page
- Rent Apartment page
- Sell Apartment page
- Property Management page
- At least five estate detail pages discovered from live internal links or known fallback estate URLs

## What The Script Checks

For each audited page, the script collects:

- Image count
- Image URLs
- File extension/type, such as JPG, PNG, WebP, AVIF, GIF, or SVG
- File size from `HEAD` or range metadata when available
- Largest images
- Lazy-load attributes where detectable
- Possible hero or above-the-fold image candidates
- Images over 250 KB, 500 KB, and 1 MB
- Repeated large images across multiple audited pages

## How To Interpret Results

Use the severity levels as practical triage:

- `warning`: image is over 250 KB.
- `high`: image is over 500 KB.
- `critical`: image is over 1 MB.

These are not hard rules. A large hero image may be acceptable if it is visually important and well-compressed, but repeated large images or full camera-size uploads should usually be optimized first.

## Recommended Target Sizes

Use these as owner/operator targets:

- Homepage or landing-page hero image: usually under 250-350 KB if possible.
- Content images: usually under 150-250 KB.
- Listing thumbnails: much smaller, often under 100-150 KB.
- Full property gallery photos: optimize carefully; quality matters because visitors inspect rooms, views, furniture, and finishes.

## Safe WP-Admin / Media Steps

Start with WP-admin and media-library work before code:

1. Review the biggest image offenders in the Markdown report.
2. Replace oversized homepage or landing-page images with properly cropped and compressed versions.
3. Use WebP or AVIF where the current media optimization plugin supports it.
4. Keep JPG fallback behavior if the plugin handles it automatically.
5. Keep lazy loading enabled for below-the-fold listing and gallery images.
6. Clear the site cache after media changes.
7. Re-run:

```bash
node scripts/audit-malendo-images.mjs --markdown
node scripts/check-malendo-live.mjs --markdown
```

## What Not To Do

- Do not edit WordPress core.
- Do not edit the MyHome parent theme.
- Do not edit plugin files.
- Do not bulk delete uploads.
- Do not regenerate every thumbnail without backup and rollback planning.
- Do not overcompress high-value property photos into blurry images.
- Do not lazy-load the first visible hero image blindly.
- Do not replace official property photos without owner approval.

## When Codex / Git Might Help Later

This audit is mostly for WP-admin/media cleanup. A future Codex PR may be useful only if a clear code-level issue is found, such as:

- Missing image dimensions causing layout shift.
- A safe, page-specific preload opportunity for one confirmed hero image.
- Broken lazy-loading markup in child-theme output.
- A reusable script improvement for ongoing image QA.

Do not use Git to mask media-library problems that are better fixed by compressing or replacing the uploaded images.

## Validation After Image Cleanup

After a human updates media in WordPress:

1. Clear WordPress/server/cache plugin cache.
2. Re-run the image audit in Markdown mode.
3. Confirm the largest offender list improved.
4. Confirm homepage, properties archive, contact, submit, rent/sell landing pages, and estate detail pages still look good.
5. Run the live QA script.
6. Check forms, CTAs, property cards, and map/search behavior.

## Rollback

If an optimized image looks bad or breaks layout:

1. Restore the previous media item or previous image version in WordPress.
2. Clear cache.
3. Re-check the affected page visually.
4. Re-run the image audit if needed.
