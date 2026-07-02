# Malendo Schema Implementation Plan

## Purpose

This document defines a safe future schema strategy for `https://malendo-property.com`, focused on local SEO and Phuket real estate services.

This is documentation only. Do not implement schema code from this document yet. Business identity, contact details, address/service area, social profiles, canonicals, sitemap/indexation, and legacy brand cleanup must be confirmed first.

## Current Schema Situation

Yoast already outputs schema on the site. Prior audits found Yoast-generated graph nodes such as `WebSite`, `WebPage`, `Organization`, `BreadcrumbList`, and related graph objects.

Because Yoast already creates a connected JSON-LD graph, the safest future path is to enhance or filter Yoast's existing graph if needed. Do not add random duplicate JSON-LD blocks that create conflicting business identities.

Current risk areas:

- Legacy `Malendo.property` / `malendo.property` text has appeared on live pages.
- Old email `info@malendo.property` has appeared in some places.
- New email is likely `info@malendo-property.com`, but the mailbox must be confirmed before schema uses it.
- Phone appears as `+66888357304`, but owner should confirm it is the official public phone.
- WhatsApp appears as `66635080136`, but owner should confirm it is official and formatted correctly for public use.
- Official social URLs still need confirmation.
- Physical address, service area, opening hours, logo, and Google Business Profile details are not confirmed enough for production schema.

Principle: schema must describe the real business accurately. It should not be used to paper over incomplete WP-admin cleanup.

## Recommended Schema Types

| Schema Type | Recommendation | Why | Notes |
| --- | --- | --- | --- |
| `RealEstateAgent` | Primary future business type if owner confirms Malendo operates as an agency/agent-style real estate business | Closely matches Phuket rentals, sales, owner support, and property enquiries | Should be connected to Yoast's business identity, not duplicated separately |
| `LocalBusiness` | Acceptable parent/backup type if `RealEstateAgent` is difficult to integrate cleanly | Real estate services are local to Phuket and contact/service-area driven | `RealEstateAgent` is a subtype of local business in common schema usage, so avoid creating both as separate conflicting nodes |
| `Organization` | Keep or enhance through Yoast as the business identity node | Yoast already tends to output Organization-like identity data | Do not add a second unrelated Organization node |
| `WebSite` | Keep Yoast output | Represents the website and search action | Usually no custom code needed |
| `ContactPoint` | Add later only after official phone/email/languages are confirmed | Helps clarify public sales/support contact channels | Do not include unconfirmed email, personal data, or private numbers |
| `BreadcrumbList` | Keep Yoast/theme output | Useful for navigation and search understanding | Avoid duplicate breadcrumb generators |
| `Service` | Consider for property management and selected service landing pages | Good fit for property management, rental support, sales support, and owner services | Use only where page content clearly describes the service |
| `OfferCatalog` | Possible later, but only if services are stable and accurately grouped | Could describe service categories such as rentals, sales, property management | Avoid if it would be vague, inflated, or hard to maintain |

Recommended primary approach:

- Use one main business identity node, ideally typed as `RealEstateAgent` if confirmed.
- Preserve Yoast `WebSite`, `WebPage`, and `BreadcrumbList` output.
- Add page-level `Service` schema only for clear service pages after content is cleaned up.
- Avoid Product/Offer schema for property listings unless price, currency, availability, and listing details are accurate.

## Business Data Confirmation Checklist

The owner must confirm these before any schema implementation PR:

| Field | Required Confirmation |
| --- | --- |
| Official business name | Exact public business name, likely `Malendo Property` |
| Legal name if different | Legal registered name, if it should appear publicly |
| Public brand name | The name used on website, Yoast, Google Business Profile, social profiles, and schema |
| Official website URL | Likely `https://malendo-property.com/` |
| Official email | Confirm whether `info@malendo-property.com` exists, works, and should be public |
| Official phone | Confirm `+66888357304` is correct and public |
| WhatsApp number | Confirm `66635080136` is correct, public, and should be linked to the same contact flow |
| Physical address | Confirm whether a street address exists and should be public |
| Service area | Confirm exact wording, likely Phuket, Thailand, plus any specific areas served |
| Opening hours | Confirm real hours, or omit if not stable |
| Logo URL | Confirm final logo asset URL used by the site/Yoast |
| Image URL | Confirm representative business image if needed |
| Official social profiles | Confirm Facebook, Instagram, Telegram, and any other official profile URLs |
| Google Business Profile URL | Confirm if available and public |
| Price range | Only include if appropriate and stable, such as `$$`; otherwise omit |
| Accepted languages | Confirm languages actually supported for enquiries |
| Currencies | Confirm currencies used for rentals/sales, likely THB and possibly others depending on listings |

Do not guess these fields. Missing accurate data is better than confidently publishing wrong schema.

## Page-Level Schema Recommendations

| Page | Primary Schema Node | Supporting Node | What Not To Mark Up | Data Required First |
| --- | --- | --- | --- | --- |
| `/` | `WebPage` connected to main `RealEstateAgent` / `Organization` identity | `WebSite`, `SearchAction`, possible `ContactPoint` | Do not add duplicate Organization or fake ratings | Official business identity, logo, phone, email, socials, service area |
| `/properties/` | `CollectionPage` or Yoast `WebPage` for listing hub | Breadcrumbs; possibly item list only if accurate and generated cleanly | Do not mark archive as a single Product or Offer | Confirm listing architecture, canonical behavior, and whether MyHome already outputs listing schema |
| `/contact/` | `ContactPage` | `ContactPoint` connected to main business node | Do not publish unconfirmed email/phone/hours | Official email, phone, WhatsApp, languages, opening hours if used |
| `/submit-your-application/` | `WebPage` for owner submissions | Possible `Service` for owner/listing submission support | Do not mark as job application or product offer | Confirm page purpose, owner lead flow, contact destination, and final Submit URL source |
| `/rent-property/rent-villas/` | `CollectionPage` or service landing `WebPage` | Possible `Service` for Phuket villa rental assistance | Do not add Offer/Product schema to every visible listing without accurate price/currency | Confirm rental service description, listing schema behavior, and whether page remains indexable |
| `/rent-property/rent-apartment/` | `CollectionPage` or service landing `WebPage` | Possible `Service` for Phuket apartment rental assistance | Do not stuff apartment/condo variants into schema names unnaturally | Confirm service wording, listing schema behavior, and canonical/indexation settings |
| `/sell-property/sell-apartment/` | `CollectionPage` or service landing `WebPage` | Possible `Service` for apartment sales support | Do not claim investment returns or guaranteed sale outcomes | Confirm sales service wording, listing schema behavior, and canonical/indexation settings |
| `/thailand/phuket/services/property-management/` | `Service` page connected to main business identity | Breadcrumbs; possible `ContactPoint` | Do not add fake reviews, fake hours, or unconfirmed address | Confirm official property management service scope, service area, contact details, and business identity |

## Safe Implementation Approach Later

A future Codex/Git schema PR should be small, deliberate, and reversible.

Recommended future sequence:

1. Re-run schema audit after WP-admin cleanup.
2. View source on homepage, contact page, properties hub, and property management page.
3. Extract current Yoast JSON-LD graph and identify existing `@id` values.
4. Decide whether Yoast settings alone can set the correct Organization/business identity.
5. If code is needed, use child-theme filters only.
6. Modify the existing Yoast graph only where needed.
7. Keep output minimal and accurate.
8. Validate before and after with schema tools.

Implementation rules:

- Do not edit WordPress core.
- Do not edit the MyHome parent theme.
- Do not edit Yoast/plugin files.
- Do not add duplicate `Organization` nodes.
- Do not hardcode unconfirmed contact details.
- Do not add schema that conflicts with Yoast, MyHome, WooCommerce, or listing schema.
- Do not use old `Malendo.property` identity.
- Prefer Yoast admin settings first. Use Git only if admin settings cannot solve it cleanly.

Potential later files if a code PR becomes necessary:

- `wp-content/themes/malendo-child/functions.php`
- or a small child-theme include if the child theme already uses that pattern

No schema code should be added until business details are confirmed.

## Example JSON-LD Drafts

These examples are not ready for production. They are shape references only. Replace placeholders only after the owner confirms official data.

### Example Business Identity Shape

```json
{
  "@context": "https://schema.org",
  "@type": "RealEstateAgent",
  "@id": "https://malendo-property.com/#organization",
  "name": "Malendo Property",
  "url": "https://malendo-property.com/",
  "email": "CONFIRM_OFFICIAL_EMAIL",
  "telephone": "CONFIRM_OFFICIAL_PHONE",
  "logo": "CONFIRM_LOGO_URL",
  "image": "CONFIRM_IMAGE_URL",
  "areaServed": {
    "@type": "Place",
    "name": "CONFIRM_SERVICE_AREA"
  },
  "sameAs": [
    "CONFIRM_OFFICIAL_FACEBOOK_URL",
    "CONFIRM_OFFICIAL_INSTAGRAM_URL",
    "CONFIRM_OFFICIAL_TELEGRAM_URL"
  ]
}
```

Important: if Yoast already outputs `https://malendo-property.com/#organization`, do not add this as a separate duplicate block. Enhance the existing graph instead.

### Example ContactPoint Shape

```json
{
  "@type": "ContactPoint",
  "contactType": "sales and property enquiries",
  "telephone": "CONFIRM_OFFICIAL_PHONE",
  "email": "CONFIRM_OFFICIAL_EMAIL",
  "areaServed": "CONFIRM_SERVICE_AREA",
  "availableLanguage": ["CONFIRM_LANGUAGES"]
}
```

Only include this after the owner confirms public phone, email, and languages.

### Example Property Management Service Shape

```json
{
  "@context": "https://schema.org",
  "@type": "Service",
  "@id": "https://malendo-property.com/thailand/phuket/services/property-management/#service",
  "name": "Property management in Phuket",
  "serviceType": "Property management",
  "provider": {
    "@id": "https://malendo-property.com/#organization"
  },
  "areaServed": {
    "@type": "Place",
    "name": "CONFIRM_SERVICE_AREA"
  },
  "url": "https://malendo-property.com/thailand/phuket/services/property-management/"
}
```

This should only be added if it complements Yoast's page graph and does not duplicate existing service schema.

### Example OfferCatalog Shape

```json
{
  "@type": "OfferCatalog",
  "name": "Malendo Property services",
  "itemListElement": [
    {
      "@type": "Offer",
      "itemOffered": {
        "@type": "Service",
        "name": "Phuket property rentals"
      }
    },
    {
      "@type": "Offer",
      "itemOffered": {
        "@type": "Service",
        "name": "Phuket property sales"
      }
    },
    {
      "@type": "Offer",
      "itemOffered": {
        "@type": "Service",
        "name": "Phuket property management"
      }
    }
  ]
}
```

Use `OfferCatalog` only if services are stable, accurate, and helpful. Do not use it to imply specific prices or guarantees.

## Validation Plan After Future Schema Implementation

After a future schema PR or Yoast configuration change:

1. Clear WordPress/server/cache plugin cache.
2. View page source on homepage, contact page, property management page, properties hub, and one rent/sell landing page.
3. Confirm there is no duplicate/conflicting business identity.
4. Confirm no schema contains `Malendo.property`, `malendo.property`, `info@malendo.property`, or an old domain identity.
5. Confirm Yoast graph is still valid and connected.
6. Run Google Rich Results Test on key pages.
7. Run Schema.org validator on key pages.
8. Run live QA:

```bash
node scripts/check-malendo-live.mjs --markdown
```

9. Run the technical audit if available:

```bash
node scripts/audit-malendo-site.mjs --markdown
```

10. Check homepage, contact page, and property management page manually in browser.
11. Confirm no new PHP warnings/fatals appear in HTML.
12. Confirm no new JavaScript console errors if browser tooling is available.

## Do-Not-Do List

- Do not implement schema before email, phone, address/service area, social profile, and brand cleanup are confirmed.
- Do not add fake ratings or reviews.
- Do not add fake opening hours.
- Do not add a fake physical address.
- Do not mark all property listings as Products or Offers without accurate price, currency, availability, and listing details.
- Do not use old `Malendo.property` identity.
- Do not include `info@malendo.property` in schema.
- Do not duplicate Yoast `Organization` schema.
- Do not add broad JSON-LD blocks in page content builders.
- Do not edit plugin files or the MyHome parent theme.
- Do not use schema to hide or override unresolved WP-admin content problems.

## Recommended Next Step

Before any schema implementation PR:

1. Finish WP-admin cleanup for the remaining 19 estate canonical issues.
2. Finish sitemap/indexation decisions, especially WooCommerce product and product-category exposure.
3. Remove or correct old email, brand, and copyright references in WP admin, Yoast, MyHome options, widgets, menus, and content.
4. Confirm official business details:
   - business name
   - legal name if public
   - official email
   - official phone
   - WhatsApp
   - physical address or service area
   - opening hours if used
   - logo/image URLs
   - official social profiles
   - Google Business Profile URL if available
5. Re-run schema and live QA audits.
6. Only after that, create a small schema implementation PR.

The first schema PR should likely focus on one thing: correcting/enhancing the existing Yoast business identity graph as `RealEstateAgent` / `Organization`, without adding duplicate nodes.

## Rollback Plan For Future Schema PR

If a future schema implementation causes duplicate/conflicting JSON-LD or validation errors:

1. Revert the schema PR.
2. Clear cache.
3. Re-run Google Rich Results Test and Schema.org validator.
4. Re-run live QA.
5. Inspect Yoast graph again before trying a smaller fix.

This document itself can be rolled back by reverting the PR that added `docs/MALENDO_SCHEMA_IMPLEMENTATION_PLAN.md`.
