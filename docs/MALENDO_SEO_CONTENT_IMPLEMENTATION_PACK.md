# Malendo SEO And Conversion Content Implementation Pack

## Purpose

This pack gives a WordPress admin/operator practical page-by-page copy, metadata, CTA, and cleanup instructions for `https://malendo-property.com`.

It is documentation only. Do not edit code from this document. Implement the recommendations manually in WordPress admin, Yoast, MyHome/WPBakery page content, menus, widgets, and plugin settings where appropriate.

Source context from the technical audit:

- P0 safety findings: `0`
- P1 SEO/indexation findings: `3`
- P2 conversion/content findings: `43`
- P3 performance/asset findings: `16`
- Main content issues: missing `/properties/` meta description, multiple H1s on Contact and Property Management pages, weak CTA structure, blog-style metadata on landing pages, legacy `malendo.property` / `2025 by Malendo` text, and contact/brand cleanup still needing WP-admin verification.

## Priority Order

| Priority | Pages | Why first |
| --- | --- | --- |
| P0 | `/contact/`, `/submit-your-application/`, `/thailand/phuket/services/property-management/` | Highest lead and owner/operator trust impact. Contact details, H1s, and CTAs must be clean. |
| P1 | `/`, `/properties/` | Core SEO and navigation surfaces. The properties hub currently needs a meta description. |
| P2 | `/rent-property/rent-villas/`, `/rent-property/rent-apartment/`, `/sell-property/sell-apartment/`, `/sell-property/sell-bungalow/`, `/sell-property/sell-warehouse-factory/` | Commercial landing pages should be clearer, locally relevant, and conversion-focused. |
| P3 | Menu/footer/widgets/sidebar/recent-post blocks and legacy text cleanup | Clean support areas after primary page content is stable. |

## Global Implementation Rules

- Use exactly one visible primary H1 per page.
- Put the page's commercial intent in the first screen where possible.
- Add a clear contact path near the top and again near the end of each commercial page.
- Keep copy natural. Avoid keyword stuffing and fake guarantees.
- Do not claim to be the best unless there is proof.
- Use `Malendo Property`, not `Malendo.property`, for brand text.
- Replace `info@malendo.property` only after confirming `info@malendo-property.com` works.
- Remove `2025 by Malendo` old copyright-style text from page/footer/content blocks.
- Do not change official Instagram/Facebook handles only because the handle contains `malendo.property`.
- Keep the temporary Submit URL safety patch until the real WP/MyHome/menu source is verified fixed without it.

## P0 Pages

### `/contact/`

**Page role:** Contact page / direct lead page.

**SEO title:** Contact Malendo Property | Phuket Real Estate Help

**Meta description:** Call, email, or message Malendo Property for Phuket rentals, sales, owner support, and property management enquiries.

**Recommended H1:** Contact Malendo Property

**Recommended intro copy:**

Contact Malendo Property for help with Phuket rentals, property sales, owner support, and property management enquiries. Tell us what you are looking for, your preferred location, dates or budget, and whether you need a villa, apartment, condo, house, commercial space, or management support for an existing property. Our team can point you to suitable listings, explain the next step, and help owners prepare a property for rent or sale. For faster replies, include the property link if you are asking about a specific listing. You can contact us by phone, email, Telegram, or the enquiry form on this page.

**Recommended CTA block:**

- Primary CTA text: `Call Malendo Property`
- Secondary CTA text: `Send an enquiry`
- Suggested button destination: `tel:+66888357304` and `/contact/`
- WhatsApp/contact wording: `Prefer messaging? Send your enquiry with the property type, dates, and budget so we can respond with relevant Phuket options.`

**Internal links to add:**

- `/properties/` with text `browse Phuket properties`
- `/submit-your-application/` with text `submit your property`
- `/thailand/phuket/services/property-management/` with text `property management in Phuket`
- `/rent-property/rent-villas/` with text `villas for rent in Phuket`
- `/rent-property/rent-apartment/` with text `apartments for rent in Phuket`

**WP-admin implementation notes:**

- Update Yoast SEO title and meta description.
- Ensure the page has only one H1: `Contact Malendo Property`.
- Check WPBakery/MyHome content blocks for duplicate heading modules.
- Check contact widgets, footer blocks, Chaty labels, and menu labels for old contact details.

**Cleanup notes:**

- Remove `Malendo.property` brand text.
- Remove `info@malendo.property` after confirming the new mailbox works.
- Remove `2025 by Malendo` if present in footer/content/sidebar blocks.

### `/submit-your-application/`

**Page role:** Owner lead page / submit property page.

**SEO title:** List Your Phuket Property | Submit To Malendo

**Meta description:** Submit your Phuket villa, condo, apartment, house, or commercial property to Malendo Property for rental or sale enquiries.

**Recommended H1:** Submit Your Phuket Property

**Recommended intro copy:**

Owners can submit a Phuket property to Malendo Property for rental, sale, or management review. Use this page if you own a villa, condo, apartment, house, townhouse, bungalow, hotel, resort, office, retail space, warehouse, or factory in Phuket and want help reaching qualified tenants or buyers. Please include the property location, property type, asking price or rental range, available dates, photos, and any important details such as bedrooms, bathrooms, sea view, parking, pool, pet policy, or management needs. The clearer the information, the easier it is for our team to review the property and advise on the next step.

**Recommended CTA block:**

- Primary CTA text: `Submit your property`
- Secondary CTA text: `Ask about owner support`
- Suggested button destination: `/submit-your-application/` and `/contact/`
- WhatsApp/contact wording: `Need help before submitting? Contact us with the property location and type.`

**Internal links to add:**

- `/thailand/phuket/services/property-management/` with text `property management services`
- `/contact/` with text `contact Malendo Property`
- `/properties/` with text `view current Phuket listings`
- `/sell-property/sell-apartment/` with text `apartments for sale in Phuket`
- `/rent-property/rent-villas/` with text `Phuket villa rentals`

**WP-admin implementation notes:**

- Update Yoast SEO title and meta description.
- Keep exactly one H1.
- Confirm the form or submission block is visible and easy to use on mobile.
- Confirm all Submit/Application menu links point to `https://malendo-property.com/submit-your-application/`.

**Cleanup notes:**

- The old bad URL `https://malendo.property/submit-your-application/` must not appear in menus, buttons, page builder links, or MyHome options.
- Keep the temporary child-theme safety patch until the real WP/MyHome/menu source is fixed and verified without the patch.

### `/thailand/phuket/services/property-management/`

**Page role:** Property management service page / owner conversion page.

**SEO title:** Property Management In Phuket | Malendo Property

**Meta description:** Property management support in Phuket for owners of villas, condos, apartments, and rental properties. Contact Malendo Property.

**Recommended H1:** Property Management In Phuket

**Recommended intro copy:**

Malendo Property helps Phuket property owners prepare, promote, and manage rental properties with a practical local approach. This page is for owners of villas, condos, apartments, houses, and other Phuket properties who want support with enquiries, tenant communication, listing presentation, rental readiness, or ongoing property management. Share the property location, type, current condition, availability, target rental period, and any owner priorities. We can review the details and explain what information is needed before the property is promoted or managed. The goal is to make owner enquiries clearer, reduce wasted back-and-forth, and help each property reach the right renter or buyer audience.

**Recommended CTA block:**

- Primary CTA text: `Request property management help`
- Secondary CTA text: `Submit your property`
- Suggested button destination: `/contact/` and `/submit-your-application/`
- WhatsApp/contact wording: `Tell us your property type, Phuket location, and whether you need rental, sale, or management support.`

**Internal links to add:**

- `/submit-your-application/` with text `submit your Phuket property`
- `/contact/` with text `speak with Malendo Property`
- `/rent-property/rent-villas/` with text `villas for rent in Phuket`
- `/rent-property/rent-apartment/` with text `apartments for rent in Phuket`
- `/properties/` with text `current Phuket property listings`

**WP-admin implementation notes:**

- Update Yoast SEO title and meta description.
- Fix multiple H1s. Keep `Property Management In Phuket` as the only H1.
- Move any secondary large headings to H2 or H3.
- Remove date/admin/category/recent-post blocks if they make the page look like a blog post instead of a service page.

**Cleanup notes:**

- Remove legacy `malendo.property` references unless they are official social profile URLs.
- Remove outdated copyright text.
- Confirm contact email and phone are consistent.

## P1 Pages

### `/`

**Page role:** Homepage / primary commercial entry point.

**SEO title:** Phuket Real Estate For Rent And Sale | Malendo

**Meta description:** Find Phuket villas, condos, apartments, and commercial properties for rent or sale. Contact Malendo Property for local support.

**Recommended H1:** Phuket Real Estate For Rent And Sale

**Recommended intro copy:**

Malendo Property helps renters, buyers, and owners find practical real estate options in Phuket. Browse villas, condos, apartments, houses, bungalows, and commercial properties for rent or sale, or contact us if you want help narrowing the search. We work with people looking for short-term rentals, long-term homes, investment properties, owner support, and property management services in Phuket. Start with the property type that fits your goal, then contact us with your preferred area, budget, dates, and must-have features. If you own a property, you can also submit it for review and discuss rental, sale, or management options.

**Recommended CTA block:**

- Primary CTA text: `Browse Phuket properties`
- Secondary CTA text: `Submit your property`
- Suggested button destination: `/properties/` and `/submit-your-application/`
- WhatsApp/contact wording: `Tell us what you need in Phuket: rent, buy, sell, or property management.`

**Internal links to add:**

- `/properties/` with text `browse all Phuket properties`
- `/rent-property/rent-villas/` with text `villas for rent in Phuket`
- `/rent-property/rent-apartment/` with text `apartments for rent in Phuket`
- `/sell-property/sell-apartment/` with text `apartments for sale in Phuket`
- `/thailand/phuket/services/property-management/` with text `property management in Phuket`
- `/contact/` with text `contact Malendo Property`

**WP-admin implementation notes:**

- The current title is useful but slightly long. Update in Yoast if desired.
- Keep the H1 as the primary page statement.
- Make sure the first visible CTA helps visitors choose Browse, Contact, or Submit.
- Check homepage footer/content blocks for `2025 by Malendo`.

**Cleanup notes:**

- Replace legacy brand strings with `Malendo Property`.
- Keep official social profile URLs unchanged if they are confirmed official.

### `/properties/`

**Page role:** Listings hub / property archive.

**SEO title:** Phuket Property Listings | Rent And Sale Options

**Meta description:** Browse Phuket property listings for rent and sale, including villas, condos, apartments, houses, and commercial spaces.

**Recommended H1:** Phuket Property Listings

**Recommended intro copy:**

Browse Malendo Property listings for Phuket rentals and sales. This hub is for visitors comparing villas, condos, apartments, houses, bungalows, and commercial spaces across Phuket. Use the listing filters to narrow by property type, offer type, location, features, and availability where available. If you do not see the right match, contact us with your preferred area, budget, dates, and property requirements so we can point you toward suitable options. Owners can also submit a property for rental, sale, or management review. Keep this page simple: search, compare, shortlist, and contact Malendo Property when a listing looks relevant.

**Recommended CTA block:**

- Primary CTA text: `Contact about a listing`
- Secondary CTA text: `Submit a property`
- Suggested button destination: `/contact/` and `/submit-your-application/`
- WhatsApp/contact wording: `Send the listing link plus your budget, dates, and preferred Phuket area.`

**Internal links to add:**

- `/rent-property/rent-villas/` with text `villas for rent`
- `/rent-property/rent-apartment/` with text `apartments for rent`
- `/sell-property/sell-apartment/` with text `apartments for sale`
- `/sell-property/sell-bungalow/` with text `bungalows for sale`
- `/sell-property/sell-warehouse-factory/` with text `commercial property for sale`
- `/contact/` with text `ask about a property`

**WP-admin implementation notes:**

- Add the missing Yoast meta description.
- Keep exactly one H1.
- If this archive title is generated by MyHome, check MyHome archive settings before editing code.
- Add a short intro block above listings if the theme allows it safely.

**Cleanup notes:**

- Remove generic archive wording where possible.
- Avoid adding too much text above listings if it pushes property cards too far down on mobile.

## P2 Rent Landing Pages

### `/rent-property/rent-villas/`

**Page role:** Rent landing page / villa rental category.

**SEO title:** Villas For Rent In Phuket | Malendo Property

**Meta description:** Browse villas for rent in Phuket. Find short-term and long-term villa rental options and contact Malendo Property for help.

**Recommended H1:** Villas For Rent In Phuket

**Recommended intro copy:**

Find villas for rent in Phuket for holidays, extended stays, family living, or longer-term relocation. Malendo Property can help you compare villa options by area, budget, dates, bedrooms, pool, view, parking, pet policy, and other practical details. Phuket villa rentals vary widely by location and season, so it is helpful to contact us with your preferred dates and must-have features before shortlisting. Browse available villa listings first, then send us the property links that interest you. If you are an owner with a villa in Phuket, you can also submit the property for rental or management review.

**Recommended CTA block:**

- Primary CTA text: `Ask about villa rentals`
- Secondary CTA text: `Browse all properties`
- Suggested button destination: `/contact/` and `/properties/`
- WhatsApp/contact wording: `Send your villa dates, budget, area, and bedroom count.`

**Internal links to add:**

- `/properties/` with text `all Phuket listings`
- `/rent-property/rent-apartment/` with text `apartments for rent in Phuket`
- `/thailand/phuket/services/property-management/` with text `villa property management`
- `/submit-your-application/` with text `submit your villa`
- `/contact/` with text `contact Malendo Property`

**WP-admin implementation notes:**

- Update Yoast title/meta if current text is generic.
- Keep one H1 and move secondary headings to H2/H3.
- Remove blog-style metadata blocks such as date/admin/category/recent posts if visible.

**Cleanup notes:**

- Remove old brand/copyright text.
- Keep listing cards visible and easy to scan on mobile.

### `/rent-property/rent-apartment/`

**Page role:** Rent landing page / apartment rental category.

**SEO title:** Apartments For Rent In Phuket | Malendo Property

**Meta description:** Find Phuket apartments and condos for rent. Browse rental listings and contact Malendo Property with your dates and budget.

**Recommended H1:** Apartments For Rent In Phuket

**Recommended intro copy:**

Browse apartments for rent in Phuket, including practical options for short stays, long-term living, and relocation. Apartment and condo rentals can differ by area, building facilities, lease length, included services, and seasonal demand. Use this page to compare available listings, then contact Malendo Property with your preferred location, dates, budget, bedroom count, and any must-have features such as sea view, pool, gym, parking, pet policy, or walking distance to the beach. If you own an apartment or condo in Phuket, you can also submit it for rental, sale, or management review.

**Recommended CTA block:**

- Primary CTA text: `Ask about apartment rentals`
- Secondary CTA text: `Submit your apartment`
- Suggested button destination: `/contact/` and `/submit-your-application/`
- WhatsApp/contact wording: `Send your preferred Phuket area, dates, budget, and apartment requirements.`

**Internal links to add:**

- `/rent-property/rent-villas/` with text `villas for rent in Phuket`
- `/sell-property/sell-apartment/` with text `apartments for sale in Phuket`
- `/properties/` with text `all Phuket property listings`
- `/contact/` with text `ask about rentals`
- `/thailand/phuket/services/property-management/` with text `rental property management`

**WP-admin implementation notes:**

- Review title/meta for commercial clarity.
- Remove date/admin/category blocks if present.
- Keep contact CTA near the top and below listings.

**Cleanup notes:**

- Standardize `apartment`, `condo`, and `condominium` wording naturally; do not stuff all variants into every sentence.

## P2 Sell Landing Pages

### `/sell-property/sell-apartment/`

**Page role:** Sell landing page / apartments for sale.

**SEO title:** Apartments For Sale In Phuket | Malendo Property

**Meta description:** Browse apartments and condos for sale in Phuket. Contact Malendo Property for current listings, details, and owner support.

**Recommended H1:** Apartments For Sale In Phuket

**Recommended intro copy:**

Explore apartments and condos for sale in Phuket with Malendo Property. This page is for buyers comparing Phuket units by location, building type, price range, view, facilities, size, and rental potential. Browse available listings, then contact us with the property links that interest you and any questions about the area or next steps. If you own an apartment or condo and want to sell or prepare it for the market, you can submit your property for review. Clear photos, accurate details, and realistic pricing help attract better enquiries.

**Recommended CTA block:**

- Primary CTA text: `Ask about apartments for sale`
- Secondary CTA text: `Submit your apartment`
- Suggested button destination: `/contact/` and `/submit-your-application/`
- WhatsApp/contact wording: `Send the listing link, budget, preferred area, and buyer timeline.`

**Internal links to add:**

- `/rent-property/rent-apartment/` with text `apartments for rent in Phuket`
- `/sell-property/sell-bungalow/` with text `bungalows for sale in Phuket`
- `/sell-property/sell-warehouse-factory/` with text `commercial property for sale`
- `/properties/` with text `browse Phuket listings`
- `/contact/` with text `contact Malendo Property`

**WP-admin implementation notes:**

- Current title may read awkwardly. Use natural buyer intent wording.
- Remove blog-style metadata if visible.
- Keep one H1.

**Cleanup notes:**

- Do not add investment claims unless they can be supported.
- Avoid guaranteed rental-return language unless legally and factually confirmed.

### `/sell-property/sell-bungalow/`

**Page role:** Sell landing page / bungalows for sale.

**SEO title:** Bungalows For Sale In Phuket | Malendo Property

**Meta description:** Browse Phuket bungalows for sale and contact Malendo Property for listing details, viewings, and owner support.

**Recommended H1:** Bungalows For Sale In Phuket

**Recommended intro copy:**

Browse bungalows for sale in Phuket and compare options by location, land size, layout, condition, price range, and lifestyle fit. Bungalows can appeal to buyers looking for privacy, practical living, rental potential, or a simpler property type than a large villa. Use this page to review available listings, then contact Malendo Property with the links you want to discuss. If you own a bungalow in Phuket and want to sell, rent, or explore management support, submit the property details and photos so the team can review the next step.

**Recommended CTA block:**

- Primary CTA text: `Ask about bungalows for sale`
- Secondary CTA text: `Submit your bungalow`
- Suggested button destination: `/contact/` and `/submit-your-application/`
- WhatsApp/contact wording: `Send your preferred Phuket area, budget, and any listing links you like.`

**Internal links to add:**

- `/sell-property/sell-apartment/` with text `apartments for sale in Phuket`
- `/rent-property/rent-villas/` with text `villas for rent in Phuket`
- `/properties/` with text `all Phuket properties`
- `/thailand/phuket/services/property-management/` with text `property management support`
- `/contact/` with text `ask about a bungalow`

**WP-admin implementation notes:**

- Keep one H1.
- Remove date/admin/category blocks if the page looks like a blog post.
- Add a concise top CTA before listing cards if layout allows.

**Cleanup notes:**

- Use local Phuket wording naturally and keep the page focused on buyer/owner intent.

### `/sell-property/sell-warehouse-factory/`

**Page role:** Sell landing page / commercial property for sale.

**SEO title:** Commercial Property For Sale In Phuket | Malendo

**Meta description:** Browse warehouses, factories, and commercial properties for sale in Phuket. Contact Malendo Property for details.

**Recommended H1:** Commercial Property For Sale In Phuket

**Recommended intro copy:**

Find commercial property for sale in Phuket, including warehouses, factories, and other business-use spaces where available. Commercial property searches usually depend on location, access, usable area, zoning or permitted use, parking, loading access, condition, and price. Use this page to review current options, then contact Malendo Property with your business requirements and any listings you want to discuss. If you own a warehouse, factory, retail space, office, or other commercial property in Phuket, you can submit it for sale, rental, or management review.

**Recommended CTA block:**

- Primary CTA text: `Ask about commercial property`
- Secondary CTA text: `Submit commercial property`
- Suggested button destination: `/contact/` and `/submit-your-application/`
- WhatsApp/contact wording: `Send property type, location, size, budget, and intended business use.`

**Internal links to add:**

- `/properties/` with text `all Phuket property listings`
- `/sell-property/sell-apartment/` with text `apartments for sale in Phuket`
- `/submit-your-application/` with text `submit commercial property`
- `/contact/` with text `contact Malendo Property`
- `/thailand/phuket/services/property-management/` with text `property management services`

**WP-admin implementation notes:**

- Keep one H1.
- Make title/meta commercial-property focused rather than only warehouse/factory focused if the page includes mixed commercial inventory.
- Remove blog-style metadata if visible.

**Cleanup notes:**

- Avoid making legal/zoning claims unless confirmed for each listing.

## P3 Support Cleanup

Apply these checks after the priority pages are updated:

- Header menu: confirm Contact, Submit, Rent, Sell, and Properties links are clean and useful.
- Footer: remove `2025 by Malendo`, old brand text, and old email once confirmed.
- Sidebar/recent posts blocks: remove from commercial landing pages if they make pages look like blog posts.
- MyHome options: confirm Submit/Application link source uses `https://malendo-property.com/submit-your-application/`.
- Yoast site identity/schema: use `Malendo Property`, not `Malendo.property`.
- User profile URLs: remove or fix `http://malendo.property` if still output in schema or author data.

## WP-admin Implementation Checklist

For each page:

1. Open the page in WordPress admin.
2. Update Yoast SEO title.
3. Update Yoast meta description.
4. Check the visible page H1 and keep only one primary H1.
5. Add or update the intro copy near the top of the page.
6. Add a clear CTA block near the top if the layout supports it.
7. Add a second contact CTA near the bottom if the page is long.
8. Add relevant internal links naturally inside the copy or CTA area.
9. Remove blog-style metadata blocks from commercial landing pages where possible.
10. Remove legacy brand/contact/copyright text.
11. Update the page.
12. Clear site/cache plugin cache.
13. Check the page in an incognito browser on desktop and mobile.

Where to update:

- Yoast SEO title/meta: page editor Yoast panel.
- Page H1/content: WordPress page content, WPBakery blocks, or MyHome page builder settings.
- Menu/footer/contact blocks: Appearance, Menus, Widgets, Customizer, MyHome theme options, footer builder, or relevant plugin dashboards.
- Submit/Application link source: menus, MyHome header settings, button blocks, page builder blocks, and theme options.

## Validation Checklist After WP Updates

Run these after each group of updates:

```bash
node scripts/check-malendo-live.mjs --markdown
node scripts/audit-malendo-site.mjs --markdown
```

Confirm:

- Cache was cleared before testing.
- Homepage, Contact, Submit Application, Properties, rent landing pages, sell landing pages, and Property Management all return HTTP 200.
- No old email `info@malendo.property` appears on priority pages.
- No old brand text `Malendo.property` appears outside confirmed official social profile URLs.
- No old copyright text `2025 by Malendo` appears.
- Each updated page has exactly one H1.
- `/properties/` has a meta description.
- Contact and Property Management no longer have multiple H1s.
- CTA links still work: phone, email, Telegram, Contact, Submit Application, and relevant internal links.
- Submit/Application links point to `https://malendo-property.com/submit-your-application/`.
- The temporary Submit URL safety patch remains until the real source is verified fixed.
- No new JavaScript console errors are visible if browser tooling is available.
- Layout looks normal on mobile and desktop.

## Rollback For WP-admin Content Changes

If a manual content update breaks layout or creates confusion:

1. Restore the previous page revision in WordPress.
2. Clear cache.
3. Recheck the page in incognito.
4. Run the live QA script.
5. Fix one page at a time instead of bulk-editing many pages.

This document itself can be rolled back by reverting the PR that added `docs/MALENDO_SEO_CONTENT_IMPLEMENTATION_PACK.md`.
