# Malendo Landing Page SEO Plan

## Purpose

This document gives a human WordPress/Yoast admin exact page-level SEO changes to apply manually for Malendo Property's most important commercial landing pages.

This is a **WP-admin / Yoast content checklist**, not a Git/Codex implementation plan. Do not use this document as approval to edit WordPress content through Git. Page titles, meta descriptions, H1s, internal links, and body copy should be updated carefully in WordPress admin, Yoast, MyHome/WPBakery/Elementor content areas, or the relevant page editor.

Production domain: `https://malendo-property.com`

## Priority Pages To Keep Indexed

These pages should stay indexed and should be improved rather than noindexed:

- `/`
- `/properties/`
- `/rent-property/rent-villas/`
- `/rent-property/rent-apartment/`
- `/sell-property/sell-apartment/`
- `/sell-property/sell-bungalow/`
- `/sell-property/sell-warehouse-factory/`
- `/thailand/phuket/services/property-management/`
- `/contact/`
- `/submit-your-application/`
- strong active estate/listing pages

## Exact Recommended Metadata Table

| URL | Suggested title tag | Suggested meta description | Suggested H1 | Notes for WP admin / Yoast |
|---|---|---|---|---|
| `/` | `Phuket Real Estate, Villas & Condos for Rent or Sale | Malendo Property` | `Find villas, condos, apartments and property management services in Phuket. Contact Malendo Property for rentals, sales and owner support.` | `Phuket Real Estate for Rent and Sale` | Update Yoast title/meta and homepage H1. Remove legacy `MALENDO.property` wording from snippet/schema/site identity. |
| `/properties/` | `Phuket Property Listings | Villas, Condos & Apartments | Malendo Property` | `Browse Phuket property listings including villas, condos, apartments and homes for rent or sale. Contact Malendo Property for local support.` | `Phuket Property Listings` | Replace generic archive title `Properties Archive`. Keep indexed as the main property search/listing hub. |
| `/rent-property/rent-villas/` | `Villas for Rent in Phuket | Short & Long Term Rentals` | `Find Phuket villas for rent, including private pool villas, monthly rentals and long-term stays in popular Phuket areas.` | `Villas for Rent in Phuket` | Improve grammar, add Phuket area copy, and link to active villa listings plus contact/property management. |
| `/rent-property/rent-apartment/` | `Apartments & Condos for Rent in Phuket | Malendo Property` | `Browse apartments and condos for rent in Phuket, from monthly rentals to long-term stays near beaches and key Phuket areas.` | `Apartments and Condos for Rent in Phuket` | Use as the broad apartment/condo rental page. Link to active condo/apartment listings and `/properties/`. |
| `/sell-property/sell-apartment/` | `Apartments for Sale in Phuket | Buy Phuket Property` | `Explore apartments for sale in Phuket with local property support from Malendo Property. Contact us for available units and viewings.` | `Apartments for Sale in Phuket` | Replace awkward wording like `Apartments buy in Phuket Thailand`. Link to sale listings, Submit/Application, and contact. |
| `/sell-property/sell-bungalow/` | `Bungalows for Sale in Phuket | Malendo Property` | `Find bungalows for sale in Phuket and get local help with property viewings, purchase questions and available listings.` | `Bungalows for Sale in Phuket` | Improve buyer intent copy and link to relevant sale listings and contact paths. |
| `/sell-property/sell-warehouse-factory/` | `Warehouses & Commercial Property for Sale in Phuket` | `Browse warehouses, factories and commercial property for sale in Phuket. Contact Malendo Property for details and viewings.` | `Commercial Property for Sale in Phuket` | Keep only if commercial property is an active service. Improve content around warehouse/factory/commercial buyer intent. |
| `/thailand/phuket/services/property-management/` | `Property Management in Phuket | Rentals, Villas & Owner Services` | `Property management in Phuket for villa, condo and apartment owners. Get help with listings, rentals, guest support and maintenance.` | `Property Management in Phuket` | High-value owner page. Add owner FAQs, benefits, listing process, and links to Submit/Application and contact. |
| `/contact/` | `Contact Malendo Property | Phuket Real Estate Help` | `Contact Malendo Property for Phuket rentals, sales, property management, viewings and owner support by phone, WhatsApp or email.` | `Contact Malendo Property` | Add missing meta description. Confirm visible email/phone/WhatsApp are official and working. |
| `/submit-your-application/` | `List Your Phuket Property | Submit to Malendo Property` | `Submit your Phuket property for rental, sale or management review. Malendo Property helps owners reach qualified tenants and buyers.` | `Submit Your Phuket Property` | Clarify owner/listing intent. Keep indexed if it is a lead capture page for property owners. |

## Internal Linking Plan

Add or improve these internal links manually in WordPress content areas:

- Homepage -> rent villas, rent apartments, properties archive, property management.
- Rent villas -> active villa listings, property management, contact.
- Rent apartments -> active condo/apartment listings, properties archive, contact.
- Sell apartment/bungalow -> relevant sale listings, submit application, contact.
- Property management -> submit application, contact, owner FAQs.
- Estate listings -> related landing page, properties archive, contact/WhatsApp.

Suggested anchor text examples:

- `Villas for rent in Phuket`
- `Apartments and condos for rent in Phuket`
- `Browse Phuket property listings`
- `Property management in Phuket`
- `List your Phuket property`
- `Contact Malendo Property`

## Local Content Improvements

Add useful local content to priority pages. Keep the copy practical and specific; avoid generic filler.

Recommended additions:

- Phuket service areas, such as Bang Tao, Patong, Kata, Karon, Nai Harn, Rawai, Chalong, Kamala, Surin, Laguna, Thalang, and Phuket Town where relevant.
- Main property types: villas, pool villas, condos, apartments, bungalows, houses, land, warehouses, factories, and commercial property.
- Short-term vs long-term rental notes, including monthly, six-month, annual, and holiday rental intent where appropriate.
- Buyer/owner FAQs, such as viewing process, availability, rental terms, management scope, listing requirements, and contact process.
- Trust signals, such as local Phuket expertise, direct contact options, curated listings, owner support, and property management experience.
- Viewing/contact process: call, WhatsApp, email, contact form, and Submit/Application flow.
- Property management benefits: listing support, guest communication, maintenance coordination, rental readiness, owner reporting, and platform listing support.

## Technical SEO Notes

Handle these in WP admin, Yoast, MyHome settings, or a future confirmed Codex/Git task only if admin settings cannot solve them:

- Fix `Malendo.property` references in WP site identity, Yoast, schema, and editable content.
- Add missing meta descriptions to priority pages.
- Review estate canonical issue found for `ozone-condo-kata`, where the canonical pointed to `https://malendo-property.com/?post_type=estate&p=4048` instead of the pretty permalink.
- Do not add schema until official business details are confirmed:
  - official brand name
  - official email
  - official phone
  - official address or service area
  - official social profile URLs
  - whether schema should use `Organization`, `LocalBusiness`, `RealEstateAgent`, or connected nodes
- Keep WooCommerce product indexation cleanup separate from landing page metadata cleanup.
- Keep priority commercial landing pages indexable while reducing low-quality product/demo/taxonomy bloat separately.

## Verification After WP Admin Changes

After changing a page in WP admin / Yoast:

1. Open the live page in a logged-out browser.
2. View page source and confirm the `<title>` matches the planned title.
3. View page source and confirm the meta description matches the planned description.
4. Check the H1 visually on the page.
5. Check the Yoast snippet preview in WP admin.
6. Confirm the page still has `index, follow` robots unless there is a deliberate exception.
7. Confirm the canonical URL points to the live pretty permalink.
8. Confirm the page still loads normally on mobile and desktop.
9. Confirm phone, WhatsApp, email, contact, and Submit/Application CTAs still work.
10. Check Google Rich Results / schema only after site identity and official business details are cleaned up.
11. Re-run a landing page audit after the first batch of changes.

## What Not To Do

- Do not noindex these priority pages.
- Do not bulk rewrite all pages.
- Do not bulk overwrite WPBakery/MyHome serialized content.
- Do not remove the temporary Submit URL safety patch until the real WP/MyHome/menu source is fixed and verified.
- Do not change social handles without confirmation, especially Facebook/Instagram handles that may intentionally contain `malendo.property`.
- Do not add duplicate schema blocks.
- Do not use Git/child-theme code to mask content and Yoast settings that should be fixed in WordPress admin.
- Do not change phone, WhatsApp, or email values until the owner/operator confirms the official contact details.