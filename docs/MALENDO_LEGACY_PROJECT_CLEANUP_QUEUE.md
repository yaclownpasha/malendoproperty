# Malendo Legacy Developer and Project Cleanup Queue

## Purpose and safety boundary

This document turns the PR #33 architecture audit and a fresh public-site check on 16 July 2026 into an exact WordPress-admin cleanup queue.

This is a content and information-architecture queue, not an instruction to delete or redirect pages automatically. For every item below:

- do not delete, unpublish, redirect, merge, or change a canonical without owner approval;
- check Google Search Console, backlinks, leads, and the intended project/developer entity first;
- make one WordPress-admin change at a time, clear cache, and validate the public result;
- do not run a blind database replacement over WPBakery or MyHome serialized content;
- do not edit WordPress core, the MyHome parent theme, or plugin files.

## Audit snapshot

| Item | Current evidence |
|---|---|
| Legacy project hub | `https://malendo-property.com/thailand/phuket/projects/`, WordPress Page ID `3801`, HTTP `200`, title/H1 `Projects`, self-canonical, indexable |
| Future editorial route | `https://malendo-property.com/projects/` currently returns `404`; PR #33 reserves it for the future editorial MVP but does not create it |
| Legacy project children | 21 published child Pages under Page ID `3801`; all 21 are in `page-sitemap.xml` |
| Old-domain project links | 8 project Pages contain 10 links to `https://malendo.property/...` |
| Old-domain developer link | 1 developer post contains a PDF link to `https://malendo.property/...` |
| Repeated server failures | 2 project Pages returned `502` on three cache-busted attempts each |
| Hub cards | 6 cards: 2 reach live pages, 4 point directly to `404` URLs |
| Hub coverage | Only Sai Yuan reaches one of the 21 child project Pages from the hub; the other 20 are hub-unlinked candidates, not proven sitewide orphans |
| Developer surfaces | Main Page, blog posts, category archives, and MyHome `developer` taxonomy overlap for several entities |

## Priority queue

| Priority | Exact problem | Why it matters | Owner decision required |
|---|---|---|---|
| P0 | Old-domain links on 8 project Pages and the Baan-Komuth developer post | The tested old URLs resolve to `https://drunkentiki.com/`, causing immediate trust and lead leakage | Approve each destination or removal; the Baan-Komuth PDF needs a real replacement file |
| P0 | Above Element Villa and Fifth Element return repeated `502` | Published sitemap URLs are unavailable to visitors and crawlers | Decide whether each page should be repaired, held as Draft/noindex, or retired after traffic/entity review |
| P0 | The Panora page contains Utopia Karon copy | Visitors may receive materially wrong project facts | Confirm the correct Panora source pack and approve replacement copy/images |
| P1 | Four of six legacy hub cards return `404` | The main legacy project journey is visibly broken | Approve direct links to the existing child Pages |
| P1 | Utopia Karon 2 is an indexable empty shell with the same title as Utopia Karon | Creates duplicate entity ambiguity and a weak search result | Confirm whether it is a phase, accidental duplicate, or placeholder |
| P1 | Palmetto Park is an indexable empty shell | Thin page remains in the sitemap with no H1 or substantive page body | Confirm whether source content exists and whether the project is still relevant |
| P1 | Developer posts and category archives duplicate entity names | Splits internal links and indexation across editorial, archive, and taxonomy surfaces | Choose one indexable editorial URL per developer/entity |
| P2 | 20 project child Pages are not reached from the legacy hub | Pages may be difficult for users and crawlers to discover | Review GSC/backlinks and decide which deserve hub/editorial links |
| P2 | Legacy hub claims Malendo "proposed more than 15 projects" | The wording can imply a developer role rather than editorial/agency coverage | Confirm the claim or rewrite it neutrally |

## P0: old-domain project links

The following list is complete for the 21 legacy project child Pages at the audit time. A cache-busted live pass found old-domain links on exactly these 8 Pages.

| Priority | WordPress page | Exact old link and label | WP-admin location to inspect | Recommended action | Validation after human fix |
|---|---|---|---|---|---|
| P0 | `https://malendo-property.com/thailand/phuket/projects/cherng-talay/` (Page ID `7711`) | `Contact us` -> `https://malendo.property/contact/` | Pages -> Cherng Talay -> WPBakery button/raw HTML/text block | Replace only this link with `https://malendo-property.com/contact/` | Page is `200`; source contains no `malendo.property`; CTA opens current Contact page |
| P0 | `https://malendo-property.com/thailand/phuket/projects/proud-residence/` (Page ID `7727`) | `Contact us` -> `https://malendo.property/contact/` | Pages -> Proud Residence -> WPBakery button/raw HTML/text block | Replace only this link with `https://malendo-property.com/contact/` | Same checks as above |
| P0 | `https://malendo-property.com/thailand/phuket/projects/tonino-lamborghini-boutique/` (Page ID `9804`) | `Contact us` -> `https://malendo.property/contact/` | Pages -> Tonino Lamborghini boutique -> WPBakery button/raw HTML/text block | Replace only this link with `https://malendo-property.com/contact/` | Same checks as above |
| P0 | `https://malendo-property.com/thailand/phuket/projects/utopia-dream/` (Page ID `9810`) | `Contact us` -> `https://malendo.property/contact/` | Pages -> Utopia Dream -> WPBakery button/raw HTML/text block | Replace only this link with `https://malendo-property.com/contact/` | Same checks as above |
| P0 | `https://malendo-property.com/thailand/phuket/projects/vip-great-hill/` (Page ID `7707`) | `Contact us` -> `https://malendo.property/contact/` | Pages -> Vip Great Hill -> WPBakery button/raw HTML/text block | Replace only this link with `https://malendo-property.com/contact/` | Same checks as above |
| P0 | `https://malendo-property.com/thailand/phuket/projects/utopia-karon/` (Page ID `7715`) | `Contact us` -> `https://malendo.property/contact/` | Pages -> Utopia Karon -> WPBakery button/raw HTML/text block | Replace only this link with `https://malendo-property.com/contact/` | Same checks as above; also confirm the page still renders its galleries |
| P0 | `https://malendo-property.com/thailand/phuket/projects/the-panora-phuket-condo/` (Page ID `7719`) | `Contact us` -> `https://malendo.property/contact/` | Pages -> The Panora Phuket Condo -> WPBakery button/raw HTML/text block | Replace only this link with `https://malendo-property.com/contact/` while correcting the content mismatch separately | Page is `200`; no old-domain CTA; Panora content validation also passes |
| P0 | `https://malendo-property.com/thailand/phuket/projects/sai-yuan/` (Page ID `7284`) | `Cherng Talay Phuket GO` -> `https://malendo.property/cherng-talay/`; `Wyndham La Vita Phuket GO` -> `https://malendo.property/wyndham-la-vita/`; `Vip Great Hill Phuket GO` -> `https://malendo.property/vip-great-hill/` | Pages -> Sai Yuan -> WPBakery Raw HTML/card block | After owner confirms each entity, use the current child URL for Cherng Talay, the live self-canonical Wyndham URL, and the current child URL for Vip Great Hill | All three cards resolve to `200` on `malendo-property.com`; no card reaches `drunkentiki.com` |

Suggested destinations for the Sai Yuan cards, subject to owner confirmation:

- Cherng Talay: `https://malendo-property.com/thailand/phuket/projects/cherng-talay/`
- Wyndham La Vita: `https://malendo-property.com/wyndham-la-vita/` (Page ID `7702`, currently `200` and self-canonical)
- Vip Great Hill: `https://malendo-property.com/thailand/phuket/projects/vip-great-hill/`

The tested old `contact`, `cherng-talay`, `wyndham-la-vita`, and `vip-great-hill` URLs all ended at `https://drunkentiki.com/`. This is not covered by the child-theme Submit URL safety patch because that patch intentionally rewrites only the exact Submit/Application URL.

### Related P0 developer document link

| Priority | Exact URL | Problem and evidence | WP-admin location | Recommended action | Validation |
|---|---|---|---|---|---|
| P0 | `https://malendo-property.com/thailand/developers/nai-harn-baan-bua/baan-komuth/` | `Ground Floor/ Second Floor/ Roof Plan` points to `https://malendo.property/wp-content/uploads/2024/04/4-K02-PLAN-20230429-Standard.pdf`. The old link ends at `drunkentiki.com`; the same path on `malendo-property.com` returns `404`. | Posts -> Baan-Komuth -> WPBakery/text/download block and Media Library | Do not perform a domain-only replacement. Obtain the approved PDF, upload it to the current Media Library, then replace the link; otherwise remove the download CTA with owner approval. | New link returns the intended PDF with an appropriate PDF content type; page source contains no old-domain URL; document identity is checked |

## P0: repeated `502` project pages

| Priority | Exact URL | Evidence | WP-admin/server location to inspect | Recommended action | Validation |
|---|---|---|---|---|---|
| P0 | `https://malendo-property.com/thailand/phuket/projects/above-element-villa/` | Page ID `9990`; published; present in page sitemap; public REST body exists (`26,614` rendered-content bytes); three cache-busted requests returned `502 Bad Gateway` from nginx | Pages -> Above Element Villa -> revisions/WPBakery Raw HTML and shortcodes; PHP/nginx logs for the request timestamp; cache/plugin diagnostics | Reproduce on a staging copy or saved revision, inspect malformed/expensive embedded markup, and repair the page. Do not unpublish/delete/redirect without owner and SEO review. | Three cache-busted requests return `200`; title/H1/content render; no PHP warning/fatal; canonical remains approved; page is visually checked mobile/desktop |
| P0 | `https://malendo-property.com/thailand/phuket/projects/fifth-element/` | Page ID `9984`; published; present in page sitemap; public REST body exists (`25,462` rendered-content bytes); three cache-busted requests returned `502 Bad Gateway` from nginx | Pages -> Fifth Element -> revisions/WPBakery Raw HTML and shortcodes; PHP/nginx logs; cache/plugin diagnostics | Same controlled diagnosis as Above Element Villa; compare the two pages for a shared malformed component or shortcode. | Same checks as above |

The shared modification timestamp (`2024-07-22 19:48:57` in WordPress REST) makes a common import/template defect plausible, but this is an inference. Server logs are required before assigning root cause.

## P0: Panora contains Utopia Karon copy

Page: `https://malendo-property.com/thailand/phuket/projects/the-panora-phuket-condo/` (Page ID `7719`). It returns `200`, uses the title/H1 `The Panora Phuket Condo`, and has a self-canonical. The mismatch is inside the page body.

| Section to locate | Exact evidence | WP-admin location | Recommended action | Validation |
|---|---|---|---|---|
| `About` | The paragraph begins `Located on top of a prime hill, 7 rai...` and identifies `Utopia Karon Condominiums`, `238 units`, 1- and 2-bedroom units, Utopia facilities, and `The Utopia property developments`. | Pages -> The Panora Phuket Condo -> WPBakery -> `About` custom heading and adjacent Text Block | Replace only after an approved Panora source pack is available. If facts cannot be verified, keep the page Draft/noindex or remove the unsupported section with owner approval. | No `Utopia Karon` or Utopia-specific unit claims remain; Panora facts match cited source; title/H1/canonical still identify Panora |
| Later custom project block | Heading reads `Utopia Karon Project is located on Karon Beach`; text starts `The property is 800 meters from Karon Beach...` and discusses Karon. | Same page -> later WPBakery Raw HTML/custom `.project-block` | Replace the whole project block with sourced Panora location copy or remove it with owner approval. | View source and visible page contain only Panora location facts |
| Image paired with that block | Rendered image URL: `https://malendo-property.com/wp-content/uploads/2025/01/S__205119510.jpg` (`1706 x 960` in rendered markup) | Same row -> Single Image/Raw HTML block; Media Library | Confirm the image depicts Panora before keeping it. Do not infer identity from filename. | Image is visually verified against the approved source pack and has accurate alt text |
| Contact CTA | `Contact us` points to `https://malendo.property/contact/` | Same page -> CTA button/raw HTML | Replace with the current Contact page URL while doing the page cleanup | CTA reaches `https://malendo-property.com/contact/` and no old-domain URL remains |

## P1 decision: Utopia Karon versus Utopia Karon 2

| Check | Utopia Karon | Utopia Karon 2 |
|---|---|---|
| URL | `https://malendo-property.com/thailand/phuket/projects/utopia-karon/` | `https://malendo-property.com/thailand/phuket/projects/utopia-karon-2/` |
| WordPress Page ID | `7715` | `9816` |
| HTTP status | `200` | `200` |
| Title | `Utopia Karon - Malendo Property` | `Utopia Karon - Malendo Property` |
| H1 | No rendered H1 found | `Utopia Karon` |
| Canonical | Self-canonical to `/utopia-karon/` | Self-canonical to `/utopia-karon-2/` |
| Robots/indexation | Indexable and in page sitemap | Indexable and in page sitemap |
| Public REST content | `21,075` rendered-content bytes with substantive WPBakery project content | `191` rendered-content bytes; visible REST text is effectively empty |
| Content similarity | Full Utopia Karon description, location block, and galleries | No substantive page body to compare; this is entity/title duplication plus an empty shell, not evidence of a separate phase |
| Images | 32 unique rendered content images plus the site logo. Representative files: `03-UBR-Overview-scaled.jpg`, `DSC04172-scaled.jpg`, `DSC04191-scaled.jpg`, `DSC04196-scaled.jpg`, and `DSC04204-scaled.jpg`; exterior and interior galleries are present. | Zero content images; only the global site logo renders |
| Page-body internal links | Old `Contact us` link to `https://malendo.property/contact/`; breadcrumb/global navigation links excluded | No substantive page-body links; only breadcrumb/global navigation |
| Last modified | `2025-01-24 02:19:31` | `2024-07-22 19:49:02` |

Current assessment: `/utopia-karon-2/` is more likely an empty duplicate/import placeholder than a documented separate phase. There is no content, image, source, phase name, or linking evidence proving it is a distinct project phase. This is not sufficient authority to delete or redirect it.

Human decision workflow:

1. Open Page IDs `7715` and `9816` side by side in Pages -> All Pages.
2. Inspect revisions, parent, slug history, custom fields, Yoast canonical, featured image, WPBakery content, and any MyHome/import metadata.
3. Check GSC clicks/impressions, backlinks, leads, and indexed URL history for both URLs.
4. Ask the owner/developer source whether a separately named phase exists.
5. If it is a real phase, give it unique sourced title, H1, content, images, internal links, and phase evidence before indexing.
6. If it is an accidental duplicate, prepare a separate owner-approved consolidation/redirect plan. Do not change the canonical or redirect as part of this cleanup document.

Validation after the decision: exactly one approved canonical entity per intended project/phase; no empty indexable shell; sitemap contains only approved indexable URLs; internal links point to the chosen URLs.

## P1: legacy project hub

Hub: `https://malendo-property.com/thailand/phuket/projects/` (Page ID `3801`). Current state: `200`, title/H1 `Projects`, self-canonical, indexable, six rendered project cards.

| Card label | Current href | Result | Recommended WP-admin action | Validation |
|---|---|---|---|---|
| Sai Yuan Phuket | `https://malendo-property.com/projects-thailand-phuket/sai-yuan/` | Redirects to the live child Page `/thailand/phuket/projects/sai-yuan/` and returns `200` | Prefer the final child URL directly after owner confirmation | One hop, `200`, self-canonical target |
| Wyndham La Vita Phuket | `https://malendo-property.com/wyndham-la-vita/` | `200`, Page ID `7702`, title/H1 `Wyndham La Vita`, self-canonical | Keep only if this is the approved project page; otherwise align it with the future architecture after review | Card and destination identify the same project and stay `200` |
| Vip Great Hill Phuket | `https://malendo-property.com/vip-great-hill/` | `404` | Update card to `https://malendo-property.com/thailand/phuket/projects/vip-great-hill/` after owner confirmation | Card target is `200`; no old/broken route |
| Cherng Talay Phuket | `https://malendo-property.com/cherng-talay/` | `404` | Update card to `https://malendo-property.com/thailand/phuket/projects/cherng-talay/` after owner confirmation | Same checks |
| Utopia Karon Phuket | `https://malendo-property.com/utopia-karon/` | `404` | Do not select the target until the Karon/Karon2 decision is complete; likely child target is `/thailand/phuket/projects/utopia-karon/` | Approved target is `200`, unique, and factually correct |
| The Panora Phuket Condo Phuket | `https://malendo-property.com/the-panora-phuket-condo/` | `404` | Fix Panora content first, then link to `/thailand/phuket/projects/the-panora-phuket-condo/` | Card is `200` and Panora content no longer contains Utopia copy |

Additional hub issues:

- The global/header Projects link observed as `https://malendo-property.com/projects-thailand-phuket/` currently returns `404`. Check Appearance -> Menus, MyHome Theme Options/Header Builder, desktop menu, and mobile menu.
- The hub text says, `Over the years, we have proposed more than 15 projects that improve the daily lives of thousands of people.` Confirm Malendo's role and evidence. If Malendo did not develop/propose these projects, replace it with neutral editorial wording.
- The hub shows only 6 cards while 21 child Pages are published. Decide which projects are current, sourced, and commercially useful before adding more cards.
- `/projects/` is currently `404`. Do not create, redirect, or canonicalize it until the PR #33 editorial architecture is approved for implementation.

## Full 21-page project inventory and hub-link status

`Hub-unlinked` means the current hub does not provide a working link to that exact child Page. It does not prove that no other page links to it.

| Priority | Page ID | Exact child URL | Live/content state | Hub state | Recommended action and validation |
|---|---:|---|---|---|---|
| P0 | 9990 | `https://malendo-property.com/thailand/phuket/projects/above-element-villa/` | Repeated `502`; REST content exists | Hub-unlinked | Diagnose and restore `200`; do not delete/redirect without approval; validate logs, page render, canonical, sitemap |
| P0 | 9984 | `https://malendo-property.com/thailand/phuket/projects/fifth-element/` | Repeated `502`; REST content exists | Hub-unlinked | Same as Above Element Villa |
| P1 | 10088 | `https://malendo-property.com/thailand/phuket/projects/palmetto-condo/` | `200`; substantive REST content | Hub-unlinked | Review source freshness and GSC; add an approved internal link or keep Draft/noindex; validate factual source and crawl path |
| P1 | 10084 | `https://malendo-property.com/thailand/phuket/projects/proud/` | `200`; substantive REST content | Hub-unlinked | Compare with Proud Residence/The Proud Karon Residence before treating as separate entity |
| P1 | 9973 | `https://malendo-property.com/thailand/phuket/projects/the-proud-karon-residence/` | `200`; substantive REST content | Hub-unlinked | Entity/deduplication review against Proud and Proud Residence |
| P1 | 9819 | `https://malendo-property.com/thailand/phuket/projects/utopia-central/` | `200`; substantive REST content | Hub-unlinked | Source/date/GSC review before adding to architecture |
| P1 | 9816 | `https://malendo-property.com/thailand/phuket/projects/utopia-karon-2/` | `200`; empty indexable shell | Hub-unlinked | Complete Karon phase/duplicate decision; do not redirect/delete/change canonical without approval |
| P1 | 9828 | `https://malendo-property.com/thailand/phuket/projects/utopia-kata/` | `200`; substantive REST content | Hub-unlinked | Source/date/GSC review |
| P1 | 9822 | `https://malendo-property.com/thailand/phuket/projects/utopia-loft/` | `200`; substantive REST content | Hub-unlinked | Source/date/GSC review |
| P1 | 9813 | `https://malendo-property.com/thailand/phuket/projects/utopia-maikhao/` | `200`; substantive REST content | Hub-unlinked | Source/date/GSC review |
| P1 | 9825 | `https://malendo-property.com/thailand/phuket/projects/utopia-naiharn/` | `200`; substantive REST content | Hub-unlinked | Source/date/GSC review |
| P1 | 9807 | `https://malendo-property.com/thailand/phuket/projects/utopia-thalang/` | `200`; substantive REST content | Hub-unlinked | Source/date/GSC review |
| P0 | 7711 | `https://malendo-property.com/thailand/phuket/projects/cherng-talay/` | `200`; old-domain Contact CTA | Hub card exists but points to a `404` root URL | Fix old-domain CTA and hub card; validate both targets return `200` |
| P0 | 7727 | `https://malendo-property.com/thailand/phuket/projects/proud-residence/` | `200`; old-domain Contact CTA | Hub-unlinked | Fix CTA; compare Proud entity pages before adding links |
| P0 | 9804 | `https://malendo-property.com/thailand/phuket/projects/tonino-lamborghini-boutique/` | `200`; old-domain Contact CTA | Hub-unlinked | Fix CTA; source/date/GSC review |
| P0 | 9810 | `https://malendo-property.com/thailand/phuket/projects/utopia-dream/` | `200`; old-domain Contact CTA | Hub-unlinked | Fix CTA; source/date/GSC review |
| P0 | 7284 | `https://malendo-property.com/thailand/phuket/projects/sai-yuan/` | `200`; three old-domain project cards | Working hub card via one redirect | Fix all three old-domain links; point hub directly to final child URL |
| P0 | 7707 | `https://malendo-property.com/thailand/phuket/projects/vip-great-hill/` | `200`; old-domain Contact CTA | Hub card points to `404` root URL | Fix CTA and hub card; validate `200` |
| P0 | 7715 | `https://malendo-property.com/thailand/phuket/projects/utopia-karon/` | `200`; old-domain Contact CTA; missing H1 | Hub card points to `404` root URL | Fix CTA; resolve Karon/Karon2 entity; restore one H1 if kept indexable |
| P0 | 7719 | `https://malendo-property.com/thailand/phuket/projects/the-panora-phuket-condo/` | `200`; old-domain CTA; Utopia Karon copy | Hub card points to `404` root URL | Correct facts and CTA, then fix hub card |
| P1 | 9981 | `https://malendo-property.com/thailand/phuket/projects/palmetto-park/` | `200`; Page content is empty; no H1; only global shell | Hub-unlinked | Find approved source/revision or hold Draft/noindex; do not leave an empty indexable page |

## Developer post/category/taxonomy duplicates

The following are overlapping WordPress surfaces, not necessarily exact content duplicates. Keep them unchanged until the owner chooses the primary editorial entity URL and GSC/backlinks are reviewed.

| Priority | Entity/surface | Exact URL | Evidence | WP-admin location | Recommended action | Validation |
|---|---|---|---|---|---|---|
| P1 | Main developer directory | `https://malendo-property.com/developers/` | Page ID `27592012`; indexable; H1 `Developers`; PR #33 found a 1,143-row imported table with no per-row source/date | Pages -> Developers; Yoast Advanced | Keep as the directory decision point. Audit/filter rows and quality before indexing changes; do not auto-generate child pages. | Sources/dates/CTA present; no thin auto-generated URLs |
| P1 | Legacy developer post root | `https://malendo-property.com/thailand/developers/` | Indexable post-style surface; same title/H1 `Developers` as the main directory | Posts -> Developers; Yoast | Decide whether it has unique editorial value or duplicates `/developers/`; no redirect/noindex without GSC/backlink approval | One clearly chosen primary surface; intentional internal links/canonical/index status |
| P1 | Matching category root | `https://malendo-property.com/category/thailand/developers/` | Indexable category archive; title `Developers Archives - Malendo Property`; no H1 found | Posts -> Categories -> Developers; Yoast taxonomy settings | Review archive value; likely noindex if it has no unique useful content, but only after GSC review | Desired robots and sitemap state; no lost clicked URLs |
| P1 | Nai Harn Baan-Bua post | `https://malendo-property.com/thailand/developers/nai-harn-baan-bua/` | Indexable; title `Nai Harn Baan-Bua Phuket Thailand - MALENDO`; three H1s include Nai Harn Baan-Bua/Baan-Komuth | Posts -> Nai Harn Baan-Bua; WPBakery; Yoast | Define developer versus project content, fix heading hierarchy, and choose the primary entity URL | Exactly one H1; sourced developer facts; approved internal links |
| P1 | Nai Harn category | `https://malendo-property.com/category/thailand/developers/nai-harn-baan-bua/` | Indexable archive with matching entity name; no H1 found | Posts -> Categories -> Nai Harn Baan-Bua; Yoast | Review/noindex only after GSC; do not treat category as the editorial profile by accident | Intentional robots/sitemap state |
| P2 | MyHome developer taxonomy | `https://malendo-property.com/developer/nai-harn-baan-bua/` | `200`, H1 `Nai Harn Baan-Bua`, `noindex, follow`, no canonical, term count 2 | MyHome/Estates -> Developer taxonomy and Yoast taxonomy settings | Retain for estate relationships as PR #33 recommends; do not turn it into a second editorial profile | Remains noindex/follow unless architecture explicitly changes; estate relations still work |
| P0 | Baan-Komuth post | `https://malendo-property.com/thailand/developers/nai-harn-baan-bua/baan-komuth/` | Indexable; three H1s; old PDF link ends at `drunkentiki.com` | Posts -> Baan-Komuth; WPBakery; Media Library; Yoast | Fix/remove unsafe PDF link first, then clarify whether this is a project page under a developer post | Safe PDF/CTA; one H1; correct entity and internal links |
| P1 | Baan-Komuth category | `https://malendo-property.com/category/thailand/developers/nai-harn-baan-bua/baan-komuth/` | Indexable matching category archive; no H1 found | Posts -> Categories -> Baan-Komuth; Yoast | Review as likely low-value duplicate archive after GSC check | Intentional robots/sitemap state |
| P1 | Metrics developer post | `https://malendo-property.com/thailand/developers/metrics-development-thailand/` | Indexable; three identical H1s `Metrics Development Thailand` | Posts -> Metrics Development Thailand; WPBakery; Yoast | Fix heading hierarchy and decide editorial primary URL | Exactly one H1; unique sourced profile |
| P1 | Metrics category | `https://malendo-property.com/category/thailand/developers/metrics-development-thailand/` | Indexable matching category archive; no H1 found | Posts -> Categories -> Metrics Development Thailand; Yoast | Review/noindex after GSC if it adds no distinct value | Intentional robots/sitemap state |

Other MyHome developer terms found by PR #33 are `Botanica Luxury Phuket`, `EPT Holdings`, `Garden Properties`, and `Phuket Best Way`. They currently have zero attached estates and their public archives are noindex/follow. Keep them as relationship data or remove them only through a separately approved taxonomy cleanup; do not convert them into auto-generated editorial pages.

## Exact employee cleanup order

1. Replace the seven old-domain Contact CTAs and the three old-domain Sai Yuan project links.
2. Replace or remove the unsafe Baan-Komuth PDF only after obtaining the approved file.
3. Repair Above Element Villa and Fifth Element using page revisions plus server logs.
4. Correct the two Utopia Karon sections and associated image on the Panora page using approved Panora sources.
5. Fix the four broken hub cards and the broken global/header Projects URL.
6. Decide whether Utopia Karon 2 is a separate phase or an accidental empty duplicate.
7. Resolve the Palmetto Park empty shell.
8. Review the 20 hub-unlinked project Pages against GSC, backlinks, current inventory, sources, and lead value.
9. Choose the primary editorial developer URLs, then review duplicate category archives and heading structure.
10. Re-run a public audit before any redirect, noindex, unpublish, or canonical proposal.

## Validation after each human fix

- Fetch the edited URL with a cache-busting query and confirm HTTP `200`.
- View source and search for `https://malendo.property`, `http://malendo.property`, and `drunkentiki.com`.
- Click every changed CTA/card and confirm the expected final `malendo-property.com` URL.
- Confirm the title, exactly one intended H1, meta robots, and canonical are unchanged unless that change was separately approved.
- Confirm WPBakery sections, images, mobile layout, and galleries still render.
- Confirm no raw shortcode, `Fatal error`, `PHP Warning`, or `Uncaught` marker appears.
- Confirm page sitemap inclusion matches the approved indexation state.
- Run `node scripts/check-malendo-live.mjs --markdown` to protect the existing global safety baseline.
- For a developer/project architecture change, re-run the PR #33 read-only structure audit if its script is available and compare exact URL counts/relationships.

## Decision gates before deletion, redirect, noindex, or canonical changes

Do not perform an irreversible SEO action until all boxes are checked:

- [ ] Owner confirms whether the project/developer and phase still exist and are strategically relevant.
- [ ] GSC clicks, impressions, and queries are reviewed for both source and proposed target URLs.
- [ ] Backlinks and important internal links are reviewed.
- [ ] Leads or CRM references to the URL are checked.
- [ ] Source facts, images, dates, and project identity are verified.
- [ ] The proposed destination is live, correct, and not thin.
- [ ] Redirect/canonical/noindex plan is documented in a separate approved change.
- [ ] Rollback path and post-change QA are ready.

## Rollback for human WordPress changes

1. Record the Page/Post ID, current URL, and a screenshot before editing.
2. Save the existing WPBakery/raw HTML content outside the editor or rely on a verified WordPress revision/backup.
3. If the edit breaks content or links, restore the previous WordPress revision.
4. Clear WordPress, server, and CDN/cache-plugin caches.
5. Re-run the URL, link, title/H1/canonical, and live QA checks above.

This documentation PR itself is rolled back by reverting the single documentation commit. It does not change production content, redirects, canonicals, theme code, or deploy behavior.
