# Malendo Image Work Queue

## Purpose

This is a practical WP-admin / Media Library work queue for reducing image weight on `malendo-property.com`.

It is based on the read-only image audit run on 2026-07-05:

```bash
node scripts/audit-malendo-images.mjs --markdown
node scripts/audit-malendo-images.mjs --json
```

Audit summary:

- Pages audited: 13
- Unique image URLs checked: 306
- Image references found: 498
- Images over 1 MB: 6
- Images between 500 KB and 1 MB: 75
- Images between 250 KB and 500 KB: 36
- WebP usage is low: 2 WebP references vs hundreds of JPG/JPEG references
- Lazy loading is low: 24 images with `loading="lazy"` and 474 without detectable loading attribute

Do not edit WordPress core, MyHome parent theme, plugin files, or uploaded files directly on the server. Use WP-admin / Media Library or the media optimization plugin.

## Top 20 Heaviest Image URLs

| Priority | Page where found | Image URL | Current size | Type | Target size | Recommended action |
| --- | --- | --- | ---: | --- | ---: | --- |
| P0 | `/properties/thailand/phuket/rent/the-kris/` | `/wp-content/uploads/2023/08/IMG_0912-scaled.jpeg` | 1.3 MB | JPEG | 400-650 KB | Compress and convert to WebP if supported. Keep quality high; property gallery photo. |
| P0 | `/` | `/wp-content/uploads/2025/01/beautiful-mountains-ratchaprapha-dam-khao-sok-national-park-surat-thani-province-thailand-1-scaled.jpg` | 1.3 MB | JPG | 250-350 KB | Replace through Media Library with cropped/compressed hero/background image. |
| P0 | `/properties/thailand/phuket/rent/the-kris/` | `/wp-content/uploads/2023/08/IMG_0906-scaled.jpeg` | 1.1 MB | JPEG | 400-650 KB | Compress and convert to WebP if supported. Keep quality high; property gallery photo. |
| P0 | `/properties/thailand/phuket/rent/the-kris/` | `/wp-content/uploads/2023/08/IMG_0911-scaled.jpeg` | 1.0 MB | JPEG | 400-650 KB | Compress and convert to WebP if supported. Keep quality high; property gallery photo. |
| P0 | `/properties/thailand/phuket/rent/the-kris/` | `/wp-content/uploads/2023/08/IMG_0907-scaled.jpeg` | 1.0 MB | JPEG | 400-650 KB | Compress and convert to WebP if supported. Keep quality high; property gallery photo. |
| P0 | `/properties/thailand/phuket/rent/the-kris/` | `/wp-content/uploads/2023/08/IMG_0894-scaled.jpeg` | 1.0 MB | JPEG | 400-650 KB | Compress and convert to WebP if supported. Keep quality high; property gallery photo. |
| P1 | `/properties/thailand/phuket/rent/the-kris/` | `/wp-content/uploads/2023/08/IMG_2829-scaled.jpeg` | 980.8 KB | JPEG | 250-500 KB | Compress and convert to WebP if supported. |
| P1 | `/properties/thailand/phuket/rent/the-kris/` | `/wp-content/uploads/2023/08/IMG_0896-scaled.jpeg` | 965.5 KB | JPEG | 250-500 KB | Compress and convert to WebP if supported. |
| P1 | `/properties/thailand/phuket/rent/the-kris/` | `/wp-content/uploads/2023/08/IMG_0895-scaled.jpeg` | 941.2 KB | JPEG | 250-500 KB | Compress and convert to WebP if supported. |
| P1 | `/properties/thailand/phuket/rent/carla-villa/` | `/wp-content/uploads/2023/08/IMG_4646-scaled.jpeg` | 823.0 KB | JPEG | 250-500 KB | Compress and convert to WebP if supported. Keep quality high. |
| P1 | `/properties/thailand/phuket/rent/the-kris/` | `/wp-content/uploads/2023/08/IMG_0909-scaled.jpeg` | 810.5 KB | JPEG | 250-500 KB | Compress and convert to WebP if supported. |
| P1 | `/properties/thailand/phuket/rent/the-kris/` | `/wp-content/uploads/2023/08/IMG_0893-scaled.jpeg` | 799.9 KB | JPEG | 250-500 KB | Compress and convert to WebP if supported. |
| P1 | `/properties/thailand/phuket/rent/carla-villa/` | `/wp-content/uploads/2023/08/IMG_4618-scaled.jpeg` | 799.9 KB | JPEG | 250-500 KB | Compress and convert to WebP if supported. Keep quality high. |
| P1 | `/properties/thailand/phuket/rent/the-kris/` | `/wp-content/uploads/2023/08/IMG_0910-scaled.jpeg` | 778.6 KB | JPEG | 250-500 KB | Compress and convert to WebP if supported. |
| P1 | `/properties/thailand/phuket/rent/the-kris/` | `/wp-content/uploads/2023/08/IMG_0913-scaled.jpeg` | 755.8 KB | JPEG | 250-500 KB | Compress and convert to WebP if supported. |
| P1 | `/properties/thailand/phuket/rent/carla-villa/` | `/wp-content/uploads/2023/08/IMG_4617-scaled.jpeg` | 754.3 KB | JPEG | 250-500 KB | Compress and convert to WebP if supported. Keep quality high. |
| P1 | `/properties/thailand/phuket/rent/carla-villa/` | `/wp-content/uploads/2023/08/IMG_4635-scaled.jpeg` | 742.9 KB | JPEG | 250-500 KB | Compress and convert to WebP if supported. Keep quality high. |
| P1 | `/properties/thailand/phuket/rent/carla-villa/` | `/wp-content/uploads/2023/08/IMG_4643-scaled.jpeg` | 738.7 KB | JPEG | 250-500 KB | Compress and convert to WebP if supported. Keep quality high. |
| P1 | `/properties/thailand/phuket/rent/the-kris/` | `/wp-content/uploads/2023/08/IMG_0915-scaled.jpeg` | 728.3 KB | JPEG | 250-500 KB | Compress and convert to WebP if supported. |
| P1 | `/properties/thailand/phuket/rent/the-kris/` | `/wp-content/uploads/2023/08/IMG_0914-scaled.jpeg` | 724.5 KB | JPEG | 250-500 KB | Compress and convert to WebP if supported. |

Priority meaning:

- P0: fix first. Images over 1 MB or homepage-critical image.
- P1: fix next. Images over 500 KB that are likely slowing estate/gallery pages.
- P2: fix later. Images over 250 KB after the large images are handled.

## Homepage Images

Highest priority homepage item:

- `/wp-content/uploads/2025/01/beautiful-mountains-ratchaprapha-dam-khao-sok-national-park-surat-thani-province-thailand-1-scaled.jpg`
- Current size: 1.3 MB
- Target: 250-350 KB
- Action: replace through Media Library or the page builder with a cropped/compressed version. Use WebP/AVIF if the plugin supports it.
- Needs QA: yes. Check desktop and mobile homepage hero/background after replacement.

Other homepage image to review:

- `/wp-content/uploads/2023/08/IMG_4657-scaled.jpeg`
- Current size: 707.0 KB
- Also appears on Carla Villa.
- Action: optimize after the P0 homepage background image.

## The Kris Images

The Kris is the largest current gallery problem.

Current audit:

- 85 image references on `/properties/thailand/phuket/rent/the-kris/`
- 5 images over 1 MB
- 33 images over 500 KB
- 35 images over 250 KB
- Most large images are JPEG files from `/wp-content/uploads/2023/08/`

Employee action:

1. Start with the five P0 The Kris images over 1 MB.
2. Continue with The Kris images between 700 KB and 1 MB.
3. Compress carefully; do not make room, view, furniture, or finish details blurry.
4. Prefer WebP copies if the optimization plugin supports automatic fallback.
5. Recheck the estate page visually after each batch.

Do not remove gallery images without owner approval.

## Carla Villa Images

Carla Villa has many heavy gallery images and one repeated image appears on the homepage.

Current audit:

- 104 image references on `/properties/thailand/phuket/rent/carla-villa/`
- 45 images over 500 KB
- 48 images over 250 KB
- Largest detected images in the top 20 include `IMG_4646`, `IMG_4618`, `IMG_4617`, `IMG_4635`, and `IMG_4643`

Employee action:

1. Optimize the top Carla Villa images over 700 KB first.
2. Keep quality high because these are listing/gallery photos.
3. Check whether `/wp-content/uploads/2023/08/IMG_4657-scaled.jpeg` is intentionally reused on the homepage.
4. If reused as a homepage/listing teaser, create an appropriately sized version instead of using a full gallery-size image.

Do not replace official listing photos without owner approval.

## Other Estate Gallery Images

After homepage, The Kris, and Carla Villa:

1. Review other estate images over 500 KB.
2. Then review estate images over 250 KB.
3. Keep original photo quality for high-value sales/rental listings.
4. Use the media optimization plugin instead of direct file edits.
5. Avoid deleting old uploads unless the owner approves and there is a backup.

Known sampled pages with lower urgency:

- `/properties/thailand/phuket/rent/batterfly/`: only warning-level images in the sample.
- `/properties/thailand/phuket/sell/kata-sea-view-villas/`: many 250-500 KB images, but none over 500 KB in the sampled top list.
- `/properties/thailand/phuket/sell/bright-condo-bangtao/`: no large-image warning in the sampled audit.

## Plugin / Media Settings To Check

Safe employee checks:

1. Confirm WebP/AVIF generation is enabled in the image optimization plugin.
2. Confirm JPG/PNG fallback is still enabled if the plugin handles fallback.
3. Confirm lazy loading is enabled for below-the-fold gallery/listing images.
4. Confirm optimized images are being served on the frontend after cache clear.
5. Confirm the plugin is not overcompressing property photos.

Needs owner approval:

1. Replacing official listing gallery images.
2. Bulk optimizing all uploads.
3. Regenerating all thumbnails.
4. Removing old original uploads.
5. Changing homepage hero/background creative.

Do not do without fresh QA:

1. Bulk image replacement.
2. Global lazy-loading changes.
3. Any change to above-the-fold homepage hero loading.
4. Regenerating thumbnails site-wide.
5. Any plugin setting that rewrites many image URLs at once.

## Exact Priority Order

1. Replace/compress homepage 1.3 MB background image.
2. Optimize The Kris five images over 1 MB.
3. Optimize remaining The Kris images over 700 KB.
4. Optimize Carla Villa images over 700 KB.
5. Check the repeated Carla Villa image used on homepage.
6. Enable/verify WebP or AVIF generation.
7. Verify lazy loading for below-the-fold estate gallery/listing images.
8. Optimize remaining images over 500 KB.
9. Optimize 250-500 KB images only after the heavy items are fixed.
10. Clear cache and rerun QA after every batch.

## Validation

After each batch:

```bash
node scripts/audit-malendo-images.mjs --markdown
node scripts/check-malendo-live.mjs --markdown
```

Manual visual QA:

- Homepage desktop
- Homepage mobile
- The Kris estate page
- Carla Villa estate page
- Properties archive
- Contact page
- Submit application page
- Lead buttons and forms

Success target:

- No images over 1 MB.
- Homepage hero/background closer to 250-350 KB.
- The Kris and Carla Villa gallery images mostly below 500 KB.
- WebP/AVIF usage improves.
- No blurry high-value property photos.
- No broken layout, forms, galleries, or CTAs.

## Telegram-Ready Summary In Russian

Задача для WP-admin / Media Library:

1. Сначала заменить/сжать большую картинку на главной: `beautiful-mountains...scaled.jpg`, сейчас около 1.3 MB, цель 250-350 KB.
2. Потом The Kris: там 5 фото больше 1 MB и много фото 700-980 KB. Сжимать аккуратно, качество комнат/вида не портить.
3. Потом Carla Villa: начать с `IMG_4646`, `IMG_4618`, `IMG_4617`, `IMG_4635`, `IMG_4643`, все около 740-823 KB.
4. Для gallery-фото цель обычно 250-500 KB, но не делать мыльное качество.
5. Включить/проверить WebP или AVIF в image optimization plugin.
6. Проверить lazy loading для фото ниже первого экрана.
7. Не удалять uploads и не менять официальные фото объектов без подтверждения владельца.
8. Не делать массовую оптимизацию всех файлов сразу.
9. После каждого блока: очистить cache, проверить страницы визуально, запустить QA.
10. Если фото стало плохого качества, откатить конкретную картинку, не продолжать массово.

Порядок:

1. Главная 1.3 MB.
2. The Kris >1 MB.
3. The Kris 700 KB-1 MB.
4. Carla Villa >700 KB.
5. Остальные фото >500 KB.
6. Потом только 250-500 KB.

Нужно согласование владельца:

- менять hero/background creative на главной;
- заменять официальные фото объектов;
- массово оптимизировать всю Media Library;
- удалять старые original uploads;
- регенерировать все thumbnails.

Не трогать:

- WordPress core;
- MyHome parent theme;
- plugin files;
- uploads напрямую на сервере;
- Chaty/GTranslate/Yandex/RevSlider настройки без отдельного решения.

## Rollback

If an optimized image looks bad or breaks layout:

1. Restore the previous media item/version in WordPress.
2. Clear cache.
3. Recheck the affected page visually.
4. Re-run image audit and live QA if needed.
