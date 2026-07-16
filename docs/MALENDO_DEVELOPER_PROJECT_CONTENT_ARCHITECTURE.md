# Malendo Developer and Project Content Architecture

Status: Phase 1 audit and architecture only. No production templates, WordPress content, redirects, or schema changes are implemented by this plan.

Audit date: 2026-07-15

Production site: `https://malendo-property.com`

## Executive decision

Use normal WordPress Pages for the first editorial developer profiles and project reviews. Keep the existing MyHome `developer` taxonomy as the operational relationship between native `estate` listings and developers, but do not use its thin archive pages as the editorial profile pages.

The recommended URL model is:

- `/developers/` - editorial hub.
- `/developers/phuket/` - curated Phuket developer directory.
- `/developers/<developer-slug>/` - sourced developer profile.
- `/projects/` - editorial project review hub.
- `/projects/<project-slug>-review/` - sourced project review.

This is the safest MVP because it:

- avoids editing MyHome or plugin files;
- lets an employee create and maintain drafts through normal WordPress admin;
- preserves the existing `estate` post type and `developer` taxonomy;
- supports Yoast title, canonical, robots, and schema controls;
- avoids launching a second custom post type before the editorial workflow is proven;
- makes every new URL opt-in, reviewed, and reversible.

Do not build an automatic page generator from the current table or MyHome terms. The first release should be a curated 5-developer and 10-project editorial collection.

## Current-state audit

### Live routes and WordPress objects

| Surface | Current implementation | Audit evidence | Assessment |
|---|---|---|---|
| `/developers/` | Published WordPress Page, ID `27592012` | HTTP 200, clean self-canonical, WPBakery/MyHome markers, one table with about 1,143 rows, about 215 KB of REST content, modified 2025-01-13 | Indexable but not a trustworthy Phuket directory |
| `/projects/` | No root page | HTTP 404 | Required future hub does not exist |
| `/thailand/phuket/projects/` | Published WordPress Page, ID `3801`, parent page ID `9006` | HTTP 200, modified 2025-09-25 | Legacy project hub, not the requested root architecture |
| Legacy project records | 21 published child Pages under page ID `3801` | REST and page sitemap | Reusable only after source, status, URL, and duplicate review |
| Legacy developer records | Four post URLs and four parallel category archives under `/thailand/developers/` | Post and category sitemaps | Blog-shaped and duplicative, not a coherent developer profile model |
| MyHome property records | Native `estate` post type | Public REST type and `/wp/v2/estate` routes | Keep as the listing/inventory model |
| MyHome developer relationship | Non-hierarchical `developer` taxonomy attached to `estate` | Public REST taxonomy and `/wp/v2/developer` route | Keep for estate relationships; do not treat as editorial content |

The current child theme does not register developer or project templates, post types, taxonomies, or rewrite rules. It only recognizes the native `estate` post type for CF7 safety and property click tracking. There is no child-theme coupling that must be preserved for the proposed editorial URLs.

### Current internal-link shape

- The main navigation exposes `/developers/`.
- Rendered navigation also links to `/projects-thailand-phuket/`, which redirects to `/thailand/phuket/projects/`; this creates an unnecessary internal redirect hop.
- `/projects/` itself is a noindex 404.
- `/developers/` contains no detected links from the table rows to individual developer profiles.
- The legacy project hub visibly promotes only six project cards, while 21 child project Pages are present in WordPress and the sitemap.
- Legacy developer posts link into estate inventory, but blog categories and MyHome taxonomy archives create parallel paths for similar developer names.

Do not update global navigation in this Phase 1 PR. A future WP-admin migration should point Projects directly to the approved canonical hub after `/projects/` is ready.

### Current MyHome developer terms

| Term | Slug | Linked estate count at audit | Archive |
|---|---|---:|---|
| Botanica Luxury Phuket | `botanica-luxury-phuket` | 0 | `/developer/botanica-luxury-phuket/` |
| EPT Holdings | `ept-holdings` | 0 | `/developer/ept-holdings/` |
| Garden Properties | `garden-properties` | 0 | `/developer/garden-properties/` |
| Nai Harn Baan-Bua | `nai-harn-baan-bua` | 2 | `/developer/nai-harn-baan-bua/` |
| Phuket Best Way | `phuket-best-way` | 0 | `/developer/phuket-best-way/` |

All five term archives returned HTTP 200 with `noindex, follow` and no canonical, and four had zero linked estates. The `developer-sitemap.xml` contained zero URLs. This is consistent with an operational taxonomy that is not ready to act as an indexable editorial directory.

### Existing project URLs

The page sitemap exposes the legacy hub and 21 child Pages:

- `/thailand/phuket/projects/`
- `/thailand/phuket/projects/above-element-villa/`
- `/thailand/phuket/projects/fifth-element/`
- `/thailand/phuket/projects/palmetto-condo/`
- `/thailand/phuket/projects/proud/`
- `/thailand/phuket/projects/the-proud-karon-residence/`
- `/thailand/phuket/projects/utopia-central/`
- `/thailand/phuket/projects/utopia-karon-2/`
- `/thailand/phuket/projects/utopia-kata/`
- `/thailand/phuket/projects/utopia-loft/`
- `/thailand/phuket/projects/utopia-maikhao/`
- `/thailand/phuket/projects/utopia-naiharn/`
- `/thailand/phuket/projects/utopia-thalang/`
- `/thailand/phuket/projects/cherng-talay/`
- `/thailand/phuket/projects/proud-residence/`
- `/thailand/phuket/projects/tonino-lamborghini-boutique/`
- `/thailand/phuket/projects/utopia-dream/`
- `/thailand/phuket/projects/sai-yuan/`
- `/thailand/phuket/projects/vip-great-hill/`
- `/thailand/phuket/projects/utopia-karon/`
- `/thailand/phuket/projects/the-panora-phuket-condo/`
- `/thailand/phuket/projects/palmetto-park/`

Most are normal WPBakery Pages last modified in 2024 or early 2025. Important exceptions and warning signs include:

- `utopia-karon` and `utopia-karon-2` have the same displayed title and need a one-page canonical/redirect decision.
- `palmetto-park` returned an empty REST content body despite rendering a frontend shell.
- `above-element-villa` and `fifth-element` repeatedly returned HTTP 502 during the audit and require manual confirmation.
- The hub visibly promotes only a small subset of the 21 child pages.
- Existing pages have Yoast `WebPage` and breadcrumb schema but no visible source or last-updated block.
- Existing developer posts use `Article` schema and blog metadata such as author, date, category, and recent posts.
- The Panora Phuket Condo page was observed describing `Utopia Karon Condominiums` in its main About copy. This is a concrete content-to-entity mismatch and means legacy project copy cannot be migrated without line-by-line review.
- The Nai Harn Baan-Bua developer post contains first-person promotional copy and an unsourced claim of an approximate 400 percent property-value increase. Such claims require removal or strong sourcing and legal review before reuse.
- The project hub claim that Malendo has `proposed more than 15 projects` is ambiguous about Malendo's role and should not be carried forward without clarification.

### Sitemap and duplicate-surface findings

| Sitemap | Relevant finding |
|---|---|
| `page-sitemap.xml` | `/developers/`, the legacy project hub, and 21 project child Pages |
| `post-sitemap.xml` | Four URLs under `/thailand/developers/` |
| `category-sitemap.xml` | Four parallel developer category archives |
| `developer-sitemap.xml` | Zero URLs |
| `estate-sitemap.xml` | 215 estate URLs; no developer/project URL matches |

There are currently three different developer concepts:

1. A large standalone `/developers/` Page.
2. Blog posts and categories under `/thailand/developers/`.
3. MyHome estate taxonomy archives under `/developer/`.

Launching new editorial pages without a migration map would create a fourth overlapping surface. The architecture therefore requires one canonical editorial URL per entity and explicit handling of every legacy URL.

## Data trust and safety findings

### Current developer table

The `/developers/` table should not remain as the primary public experience.

Problems:

- It contains roughly 1,143 rows and mixes Phuket with Bangkok, Pattaya, Hua Hin, Samui, Chiang Mai, and other markets.
- Headings such as object count, total apartments, developer apartments, and secondary housing have no explained methodology.
- No source, owner, collection date, or last-updated date is visible.
- The names are not a useful path into a verified Malendo profile and related live inventory.
- The large unfiltered table does not match Malendo's Phuket commercial intent.
- The data cannot be treated as current merely because the WordPress Page was modified in January 2025.

Recommendation:

- Set the current page to `noindex, follow` in Yoast while replacement work is prepared.
- Preserve the data privately for research or export; do not use it as the source of truth.
- Replace the public table with a short editorial introduction, a Phuket directory link, and curated developer cards.
- Do not add filtering until there are at least 20 quality profiles and users have a real need for it.
- Do not publish numeric claims from the table unless each value has a named source and checked date.

### Critical legacy links found during this audit

These are WordPress content issues, not child-theme architecture issues. They should be fixed before new project/developer pages are promoted:

- `/thailand/developers/nai-harn-baan-bua/baan-komuth/` links a floor-plan PDF to `https://malendo.property/wp-content/uploads/2024/04/4-K02-PLAN-20230429-Standard.pdf`.
- `/thailand/phuket/projects/cherng-talay/` has `Contact us` -> `https://malendo.property/contact/`.
- `/thailand/phuket/projects/proud-residence/` has `Contact us` -> `https://malendo.property/contact/`.
- `/thailand/phuket/projects/tonino-lamborghini-boutique/` has `Contact us` -> `https://malendo.property/contact/`.
- `/thailand/phuket/projects/utopia-dream/` has `Contact us` -> `https://malendo.property/contact/`.
- `/thailand/phuket/projects/vip-great-hill/` has `Contact us` -> `https://malendo.property/contact/`.
- `/thailand/phuket/projects/utopia-karon/` has `Contact us` -> `https://malendo.property/contact/`.
- `/thailand/phuket/projects/the-panora-phuket-condo/` has `Contact us` -> `https://malendo.property/contact/`.
- `/thailand/phuket/projects/sai-yuan/` contains three old-domain project links to `cherng-talay`, `wyndham-la-vita`, and `vip-great-hill`.

Because `malendo.property` has previously resolved to unrelated content, old-domain lead links are a P0 trust and lead-loss risk. Fix them in the relevant Pages/Posts/WPBakery blocks. Do not run a blind database replacement, and do not alter official Instagram or Facebook handles merely because their usernames contain `malendo.property`.

### Trust classification

Current developer and project copy should be treated as `Unknown` until reviewed. Existing WordPress modified dates show when content changed, not when facts were independently checked.

Use the following status at the fact level, not as a blanket badge for an entire company:

| Status | Meaning | Display rule |
|---|---|---|
| Verified | Malendo checked the fact against a current primary source and recorded the source and check date | Show the fact, source, and checked date |
| Claimed | The developer, project owner, broker pack, or sales material states the fact, but Malendo has not independently confirmed it | Prefix with `Developer-claimed` or `Project-claimed` |
| Unknown | No adequate current source is available or sources conflict | State `Not independently confirmed`; do not infer |

Examples that must be classified separately include developer identity, legal entity, completion status, EIA or permit status, unit count, tenure, facilities, price, availability, rental guarantee, and completion date.

## Recommended content model

### MVP model

| Content | WordPress object | URL | Owner | Index rule |
|---|---|---|---|---|
| Developer hub | Page | `/developers/` | WP admin | Index after current table is replaced |
| Phuket developer directory | Child Page | `/developers/phuket/` | WP admin | Index after at least 5 qualified profiles exist |
| Developer profile | Child Page | `/developers/<developer-slug>/` | WP admin | Index only after profile gate passes |
| Project hub | Page | `/projects/` | WP admin | Index after at least 5 qualified reviews exist |
| Project review | Child Page | `/projects/<project-slug>-review/` | WP admin | Index only after review gate passes |
| Developer-estate relationship | Existing MyHome `developer` taxonomy | `/developer/<slug>/` operational archive | WP admin/MyHome | Noindex unless separately enriched and intentionally canonicalized |
| Property inventory | Existing MyHome `estate` post type | Existing estate URLs | WP admin/MyHome | Keep current estate rules |

### Why normal Pages first

Normal Pages are preferable to a new custom post type for the 5/10 MVP because:

- they already support the required clean parent/child URLs;
- Yoast controls are available without new code;
- employees can draft, review, schedule, and update them in the current admin;
- legacy project records are already Pages, making content comparison and migration simpler;
- no new plugin, database schema, or parent-theme dependency is required;
- a child-theme template can be assigned later only to approved Pages.

Reconsider a custom post type only when one of these conditions becomes real:

- more than 25 active profiles or reviews need structured filtering;
- the team needs required fields and validation that Pages cannot enforce;
- the same entity data must be reused across multiple languages or templates;
- project-to-developer relationships cannot be maintained reliably with editorial links and existing taxonomy data.

If that point arrives, register the post type in a dedicated site plugin or child theme only after a backup and migration plan. Do not register it in MyHome or edit the parent theme.

## URL and migration rules

### Canonical URL rules

- Use lowercase ASCII slugs with hyphens.
- Use the official public developer name for `/developers/<slug>/`.
- Use exactly one project slug plus `-review` for `/projects/<project-slug>-review/`.
- Do not add year, price, completion status, or marketing claims to permanent slugs.
- Each page must self-canonicalize to its clean HTTPS URL.
- No canonical may point to a query URL, old domain, or legacy duplicate.

### Legacy URL decision process

For each legacy developer post, category, MyHome taxonomy archive, and project Page:

1. Identify whether it represents the same entity as a proposed editorial page.
2. Check Google Search Console clicks, backlinks, leads, and indexed canonical.
3. Select one canonical editorial destination.
4. Reuse and rewrite trustworthy source-backed content only.
5. Publish the new page as `noindex` until QA passes.
6. Change the new page to index only when the content gate passes.
7. Add a one-to-one 301 from the old URL only after the destination is live and approved.
8. Remove the old URL from navigation and sitemap through WordPress/Yoast settings.
9. Never bulk redirect unrelated project URLs to a generic hub.

Do not redirect `/thailand/phuket/projects/` or `/developers/` until their replacement role is explicitly approved. A hub can remain at its current URL while individual records migrate.

## Editorial page blueprints

### Developer profile

Required sections:

1. One H1: `<Official Developer Name> in Phuket`.
2. A 100-150 word neutral summary explaining Phuket relevance.
3. Fact table: official public name, legal entity if confirmed, founded date if confirmed, Phuket areas, project types, official site, and status dates.
4. `Verified / Claimed / Unknown` fact block.
5. Phuket project portfolio with status and project review links.
6. Active Malendo estate listings assigned to the verified MyHome developer term.
7. What buyers or owners should independently check.
8. Source and last-updated block.
9. `Request a Developer Check` CTA.
10. Legal and commercial disclosure.

### Project review

Required sections:

1. One H1: `<Project Name> Review - Phuket`.
2. A 100-150 word neutral summary.
3. Fact table: developer, location, property type, build/completion status, tenure, unit mix, unit count, handover date, and checked date.
4. `Verified / Claimed / Unknown` fact block.
5. Location and access, with an accurate map or area link.
6. Facilities and unit mix, distinguishing confirmed facts from marketing claims.
7. Current price/availability only with THB currency, source, and checked date.
8. Practical strengths, constraints, and questions to verify.
9. Related active Malendo estate listings.
10. Developer profile and Phuket area links.
11. Source and last-updated block.
12. `Request a Project Check` CTA.
13. Legal and commercial disclosure.

### Source and last-updated block

Use the same visible structure on every profile and review:

```text
Sources checked
- Official developer/project website: <page title and URL> - checked YYYY-MM-DD
- Official brochure or filing: <document title and URL> - checked YYYY-MM-DD
- Independent source: <publisher and URL> - checked YYYY-MM-DD

Last editorial review: YYYY-MM-DD
Reviewed by: <Malendo editor name or role>
Open questions: <short list or None recorded>
```

Source rules:

- Prefer current primary sources for identity, specifications, price, and availability.
- Use at least one independent source for status, dispute, completion, or market-context claims when available.
- Link to the exact source page or document, not only a homepage.
- Archive the source date internally; do not imply that a marketing brochure is independent verification.
- Recheck time-sensitive facts at least every 90 days and all other indexed pages every 180 days.
- If a source disappears, change the affected fact to `Unknown` until reverified.

### Legal disclaimer

Recommended baseline copy:

> This page is general property information, not legal, financial, tax, valuation, or investment advice. Project status, availability, prices, ownership terms, permits, and completion dates can change. Buyers should appoint independent legal and technical advisers and verify title, contracts, licenses, EIA status, construction progress, fees, and payment terms before making a decision. Malendo Property may act as an agent and may receive a commission if a transaction completes.

`Request a Developer Check` and `Request a Project Check` must be described as an initial information check, not legal due diligence or a guarantee.

## CTA design

### Request a Developer Check

- Primary label: `Request a Developer Check`
- Destination: `/contact/?topic=developer-check&developer=<developer-slug>`
- Supporting copy: `Ask Malendo to check current projects, availability, and the facts we can verify.`
- Secondary action: `View related Phuket properties`
- Fallback contact: phone or WhatsApp using the confirmed site-wide contact details.

### Request a Project Check

- Primary label: `Request a Project Check`
- Destination: `/contact/?topic=project-check&project=<project-slug>`
- Supporting copy: `Ask about current availability, price, project status, and what still needs independent verification.`
- Secondary action: `View active listings in this project`
- Fallback contact: phone or WhatsApp using the confirmed site-wide contact details.

The query values contain only public slugs. They must not contain names, emails, phone numbers, free-text form answers, or other personal data. A future implementation must preserve form behavior if query-prefill support is not available.

## GA4 event model

Do not count a CTA click as a completed lead. Track the click for funnel analysis and reserve `generate_lead` for an accepted form submission or direct high-intent contact action.

| Event | Trigger | Safe parameters | `generate_lead`? |
|---|---|---|---|
| `view_developer_profile` | Qualified profile view | `entity_slug`, `page_type` | No |
| `view_project_review` | Qualified review view | `entity_slug`, `page_type` | No |
| `click_developer_check` | Developer-check CTA click | `entity_slug`, `cta_location`, `source_path` | No |
| `click_project_check` | Project-check CTA click | `entity_slug`, `cta_location`, `source_path` | No |
| `click_related_project` | Developer profile -> project review | `developer_slug`, `project_slug` | No |
| `click_related_listing` | Profile/review -> estate | `entity_type`, `entity_slug`, `listing_path` | No |
| `click_source` | External source link | `entity_type`, `entity_slug`, `source_host` | No |
| `developer_check_submit` | Check form accepted | `lead_type=developer_check`, `entity_slug`, `source_event` | Yes, once |
| `project_check_submit` | Check form accepted | `lead_type=project_check`, `entity_slug`, `source_event` | Yes, once |

Privacy and event safety:

- Do not send names, email addresses, phone numbers, message text, full hrefs, or form values.
- Do not block navigation or form submission.
- Do not add duplicate document listeners.
- Keep current phone, email, WhatsApp, Telegram, property-card, and submit tracking unchanged in the first CTA PR.
- Prefer a Contact Form 7 success signal for the completed check event; do not infer success from a button click.

## Internal linking model

The intended path is:

```text
/developers/
  -> /developers/phuket/
      -> /developers/<slug>/
          -> related /projects/<slug>-review/
          -> verified related estate listings
          -> /contact/?topic=developer-check...

/projects/
  -> /projects/<slug>-review/
      -> /developers/<slug>/
      -> Phuket location/rent/sale landing pages
      -> verified related estate listings
      -> /contact/?topic=project-check...
```

Rules:

- Every developer profile links back to the Phuket directory and developer hub.
- Every project review links to one verified developer profile or states that the developer is not confirmed.
- Every project review links to the relevant Phuket area and commercial rent/sale landing page.
- Every related listing link must point to an active `estate` URL, not an imported WooCommerce product unless the product strategy explicitly changes.
- Estate-to-developer or estate-to-project links require an explicit verified mapping; do not auto-link based on a name string.
- Use Yoast breadcrumbs for hierarchy and avoid duplicate breadcrumb plugins.
- Do not create tag, filter, or search URLs as indexable landing pages.

## Schema model

Yoast already outputs `Organization`, `WebSite`, `WebPage`, and `BreadcrumbList` nodes. Future schema must enhance that graph rather than add disconnected duplicate JSON-LD blocks.

| Page | Recommended schema | Notes |
|---|---|---|
| `/developers/` | `CollectionPage` + visible `ItemList` | List only profiles visible on the page |
| `/developers/phuket/` | `CollectionPage` + visible `ItemList` | Do not claim completeness or rankings |
| Developer profile | `WebPage` or `ProfilePage` with `mainEntity` as a distinct `Organization` | Developer organization must use its own `@id`; do not merge it with Malendo's Organization node |
| `/projects/` | `CollectionPage` + visible `ItemList` | List only published project reviews |
| Project review | `Article` or `WebPage` about `ApartmentComplex`, `Residence`, or `Place` when factually accurate | Use `Review` only for genuine editorial review content; no fabricated rating |
| All pages | Existing Yoast `BreadcrumbList` | Keep one breadcrumb graph |

Do not add:

- `Product` or `Offer` without accurate current price, THB currency, availability, seller, and checked date;
- `AggregateRating`, `Review`, or testimonials without genuine, attributable evidence;
- developer `LocalBusiness` data without an official public address and contact details;
- project completion, permit, EIA, ownership, or guarantee claims that are not sourced;
- a second Malendo Organization node.

Schema implementation is a later Codex PR after official business identity and each entity's source data are confirmed.

## Sitemap and indexation policy

### Indexable surfaces

- Hubs with unique local copy and enough qualified child pages.
- Developer profiles that pass the developer quality gate.
- Project reviews that pass the project quality gate.
- Existing estate listings that remain active and meet current estate indexation rules.

### Noindex surfaces

- Draft or incomplete profiles and reviews.
- Empty MyHome `developer` term archives.
- MyHome term archives that merely repeat listing cards and compete with an editorial profile.
- Current nationwide developer table until it is replaced or substantially rebuilt.
- Duplicate legacy categories and posts after a replacement mapping is approved.
- Search, filter, parameter, and preview URLs.
- Pages with unresolved 5xx errors, old-domain lead links, or an unverified canonical.

Only canonical, indexable pages should appear in Yoast sitemaps. `noindex` is not a substitute for a one-to-one redirect when a legacy page has a true replacement.

## Content quality gates

Word count is a diagnostic, not the definition of quality. A page fails if it lacks current evidence even when it is long.

### Developer profile gate

Before indexing, require all of the following:

- 700-1,200 words of materially unique editorial copy;
- official public name and legal name clearly separated when different;
- clear Phuket relevance;
- at least two exact sources, including one primary source;
- every material claim classified as Verified, Claimed, or Unknown;
- a last editorial review date within 180 days;
- at least one related project or active estate, unless the owner approves a strategic exception;
- a working Developer Check CTA;
- links to the hub, Phuket directory, projects/listings, and contact page;
- unique title, meta description, H1, self-canonical, and clean schema;
- no old-domain links, unsupported superlatives, investment guarantees, or copied marketing text.

### Project review gate

Before indexing, require all of the following:

- 900-1,500 words of materially unique editorial copy;
- confirmed project identity, location, developer, and current status, or visible `Unknown` labels;
- at least two exact sources and an independent source for sensitive status claims when available;
- dated price and availability if displayed;
- one verified developer link or an explicit unknown-developer statement;
- one Phuket area link and at least one relevant active listing or approved strategic reason for none;
- practical strengths, constraints, and buyer questions rather than brochure-only copy;
- a working Project Check CTA;
- a last editorial review date within 90 days for price/status and 180 days for stable facts;
- unique title, meta description, H1, self-canonical, and clean schema;
- no duplicate project URL, old-domain links, 5xx response, or unsupported legal/return claim.

### Hub gate

- At least 5 qualified child pages.
- 400-700 words of unique Phuket-focused introductory and decision-support copy.
- A visible explanation of inclusion criteria and last directory review date.
- Curated cards that link to qualified profiles/reviews.
- No empty filters or generated doorway pages.

## Preventing thin programmatic pages

- Never publish a page only because a row, taxonomy term, imported product, or project name exists.
- Default every new record to Draft and `noindex`.
- Require a human editor, sources, and a checked date before indexing.
- Do not clone the same page-builder copy and swap names.
- Do not create area/developer/project combinations unless each page has independent search intent and unique evidence.
- Do not index zero-result taxonomy archives.
- Cap the MVP at 5 developers and 10 projects; learn from quality, traffic, and leads before scaling.
- Review Search Console and GA4 quarterly. Pages with no value should be improved, consolidated, or noindexed after human review.
- Maintain a source ledger outside public copy with source URL, access date, owner, and open questions.

## Recommended MVP

### Deliverables

- Rebuilt `/developers/` hub.
- New `/developers/phuket/` directory.
- Five draft developer profiles.
- New `/projects/` hub.
- Ten draft project reviews.
- One reusable source/status block and one disclaimer.
- Developer Check and Project Check CTAs.
- Manual, verified relationships to existing estates.
- No filter engine, bulk generator, or new custom post type.

### First five developer research candidates

These are a research queue, not endorsements and not automatic publish candidates:

1. Nai Harn Baan-Bua - strongest current linkage because the MyHome term has two estates and legacy editorial content exists.
2. Botanica Luxury Phuket - existing MyHome term; requires current official sources and a strategic inventory check.
3. Garden Properties - existing MyHome term and related estate naming signals; requires identity and inventory validation.
4. EPT Holdings - existing MyHome term; keep Draft/noindex unless Phuket relevance and active inventory are confirmed.
5. Phuket Best Way - existing MyHome term; keep Draft/noindex unless identity, projects, and business value are confirmed.

If candidates 2-5 lack active inventory, Search Console value, or reliable sources, replace them with developers tied to current high-value Malendo estates. Do not publish simply to reach five.

### First ten project research candidates

These candidates maximize reuse of existing content while exposing the duplicate/stale records that most need a decision:

1. Baan Komuth.
2. The Panora Phuket Condo.
3. Palmetto Condo.
4. The Proud Karon Residence.
5. VIP Great Hill.
6. Above Element Villa.
7. Fifth Element.
8. Palmetto Park.
9. Utopia Karon - only after resolving `utopia-karon` versus `utopia-karon-2` and confirming current status.
10. Utopia Nai Harn - only after confirming current status and source quality.

Selection gate for each candidate:

- current Phuket relevance;
- owner-approved commercial value;
- at least one active listing or strategic lead purpose;
- source availability;
- no unresolved legal/status claim;
- a one-to-one legacy URL decision.

## Exact future Codex PR sequence

No production implementation belongs in this Phase 1 PR.

### PR 1 - Read-only QA coverage

Files likely affected:

- `scripts/check-malendo-live.mjs`
- relevant QA documentation

Scope:

- Add checks for the approved new hubs, profile/review canonicals, old-domain CTA links, source blocks, and required status labels.
- Do not create content or redirects.

### PR 2 - Scoped child-theme presentation templates

Files likely affected:

- child-theme Page templates or template parts
- one scoped stylesheet
- child-theme enqueue code only if needed

Scope:

- Add opt-in developer profile and project review templates.
- Preserve normal WordPress content editing.
- Render content, source/status blocks, related links, CTAs, and disclaimer only on Pages assigned the template.
- Do not edit MyHome parent templates or plugin files.

### PR 3 - CTA analytics

Files likely affected:

- `wp-content/themes/malendo-child/assets/js/lead-events.js`
- possibly child-theme tests/docs

Scope:

- Add `click_developer_check` and `click_project_check` without changing existing event behavior.
- Add successful check-request events only when a reliable form success signal exists.
- Keep personal data out of GA4.

### PR 4 - Yoast graph enhancement

Files likely affected:

- child-theme schema/filter module or `functions.php`

Scope:

- Enhance the existing Yoast graph for qualified hubs, profiles, and reviews.
- Use confirmed data only.
- Avoid duplicate Malendo Organization, breadcrumb, Product, Offer, Review, and rating nodes.

### PR 5 - Exact redirects and canonicals

Files likely affected:

- child theme only if WP admin/Yoast/redirect tooling cannot safely solve the approved map

Scope:

- Implement only owner-approved one-to-one legacy redirects.
- Do not use pattern redirects across all legacy projects or developer categories.
- Verify Search Console/backlink value first.

### PR 6 - Optional directory filtering

Only consider this after at least 20 qualified profiles exist and analytics show a need. Keep filters client-side or query-safe, do not create indexable parameter combinations, and preserve an accessible unfiltered list.

Every future PR must be separate, reversible, manually deployed, and validated on mobile and desktop.

## Exact WP-admin employee tasks

### Before any new page is published

1. Fix the exact old-domain content links listed in this audit.
2. Confirm `above-element-villa` and `fifth-element` return HTTP 200 consistently.
3. Resolve the `utopia-karon` / `utopia-karon-2` duplicate.
4. Export current `/developers/` table data for internal reference; do not delete it blindly.
5. Set the current table page to `noindex, follow` until it is rebuilt.
6. Review Google Search Console for all legacy developer/project URLs before redirect or noindex decisions.
7. Confirm the official developer/project source list and who signs off facts.
8. Map each active estate to the correct existing MyHome `developer` term; do not create duplicate spellings.

### Draft creation workflow

1. Create `/developers/phuket/` as a child Page of `/developers/`, status Draft.
2. Create developer profiles as child Pages of `/developers/`, status Draft.
3. Create a root `/projects/` Page, status Draft.
4. Create project reviews as child Pages of `/projects/`, with `-review` slugs, status Draft.
5. Set each draft to `noindex` in Yoast until the quality gate passes.
6. Add one H1, unique title/meta, source block, fact-status block, CTA, disclaimer, and internal links.
7. Record source URLs and checked dates.
8. Ask an owner/editor to approve factual and legal-risk claims.
9. Run QA and confirm a one-to-one legacy URL decision.
10. Publish and change to index only after approval.

### Ongoing maintenance

- Recheck price, availability, and project status every 90 days.
- Recheck stable developer facts every 180 days.
- Update `Last editorial review` even when no facts changed.
- Change unsupported facts to `Unknown`; do not silently retain stale claims.
- Unlink sold/removed estates and add current related listings.
- Keep official social handles unchanged unless their destination is confirmed wrong.

## Risk assessment

| Risk | Level | Why | Mitigation |
|---|---|---|---|
| Old-domain CTA lead leakage | Critical | Visitors can leave Malendo for an unrelated domain | Fix exact links in WP admin before promotion; re-run link audit |
| Unsourced developer table | High | Stale or unexplained counts can damage trust and SEO | Noindex, preserve privately, replace with curated pages |
| Duplicate developer surfaces | High | Pages, posts, categories, and taxonomy archives can compete | One editorial canonical per entity and explicit migration map |
| Duplicate/stale project pages | High | Multiple project URLs and old claims split signals and mislead users | Source review, one-to-one redirect/canonical decision |
| Legal/investment claims | High | Returns, permits, title, completion, and guarantees are sensitive | Status labels, sources, disclaimer, independent professional advice |
| Thin page scaling | High | Programmatic pages would add to existing index bloat | Draft/noindex by default and quality gates |
| Parent-theme coupling | High | MyHome updates could break parent edits | Child-theme opt-in templates only; no parent/plugin edits |
| Empty taxonomy archives | Medium | Zero-result archives create weak indexable pages | Keep noindex and out of sitemap |
| Duplicate schema | Medium | Random JSON-LD can conflict with Yoast | Enhance the Yoast graph later with stable `@id` nodes |
| Employee workflow drift | Medium | Manual pages can become inconsistent | Reusable templates, editorial checklist, and scheduled review |
| Performance growth | Medium | Large galleries and page-builder blocks can repeat existing asset issues | Reuse optimized media and run image/asset QA |
| 5xx project pages | Medium | Unreliable pages waste crawl and lose users | Confirm origin/cache behavior before migration |

## Validation and acceptance

### Phase 1 validation

Run:

```bash
node --check scripts/audit-malendo-developer-structure.mjs
node scripts/audit-malendo-developer-structure.mjs
node scripts/audit-malendo-developer-structure.mjs --markdown
node scripts/audit-malendo-developer-structure.mjs --json
```

The script is read-only. It fetches public pages, WordPress REST metadata, and relevant sitemap documents. It does not authenticate, submit forms, modify WordPress, or write production data.

### Before any future template PR merges

- Confirm only child-theme, script, and documentation paths changed.
- Confirm no parent-theme or plugin changes.
- PHP lint every changed PHP file.
- Confirm templates are opt-in and do not alter existing Pages automatically.
- Confirm no old-domain link, personal data, secret, or hardcoded unverified claim.
- Confirm rollback is a PR revert.

### After future content publication

- HTTP 200 and clean self-canonical.
- One H1.
- Index/noindex matches the quality gate.
- Correct Yoast title and meta description.
- Source, last-updated, status, CTA, and disclaimer visible.
- CTA destinations remain on `malendo-property.com` or approved phone/WhatsApp channels.
- No `malendo.property`, `drunkentiki.com`, PHP warning, fatal error, or console-breaking marker.
- Related developer, project, area, estate, and contact links work.
- New URLs appear in the correct sitemap only after indexing is approved.
- Old URLs follow the approved keep/noindex/redirect decision.
- GA4 custom clicks fire once and no personal data is sent.

## Rollback principle

This Phase 1 PR adds only documentation and a read-only audit script. Rollback is to revert the PR. It does not require a deployment or cache clear because no child-theme or production content is changed.

Future implementation PRs must keep their own exact rollback steps. Content migration should never depend on deleting the old content before the new canonical URL has passed live QA.

