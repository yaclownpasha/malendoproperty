# Malendo Next Exact Diffs Proposal v1.0

These are proposals only. No patch is authorized or applied. Every item requires authorized access, timestamped backup, tested staging restore, exact pre-change export, regression evidence, and a rollback rehearsal.

## 1. Remove stale rent sitemap declaration

- **Source task ID:** CDX-AFTER-01 / MLD-P0-04
- **Exact problem:** `robots.txt` declares `https://malendo-property.com/rent-sitemap.xml`, which returns `404` HTML.
- **Source of truth:** Yoast-generated robots configuration, exact setting/export still required.
- **Proposed minimal change:** remove only that one stale `Sitemap:` declaration. Keep `sitemap_index.xml` unchanged.
- **Affected files/settings/URLs:** one Yoast/admin robots setting; `/robots.txt`; `/rent-sitemap.xml` only as validation target.
- **Expected effect:** no broken sitemap declaration.
- **Dependencies:** source ownership export, backup, staging restore.
- **Risks:** editing the wrong robots source could overwrite unrelated directives.
- **Tests:** parse robots; GET every declared sitemap; validate XML; compare full robots diff; confirm CSS/JS and commercial crawlability.
- **Rollback:** restore exact prior robots configuration/export and clear relevant cache.
- **Access/backup requirement:** read/write to exact Yoast setting only after approved backup/staging gate.
- **Status:** `NEEDS ACCESS`.

## 2. Remove exact empty/noindex entries from sitemap output

- **Source task ID:** CDX-AFTER-02 / MLD-P0-05
- **Exact problem:** five child sitemaps contain zero URLs; Cart and My Account are noindex but appear in `page-sitemap.xml`.
- **Source of truth:** Yoast sitemap/taxonomy/Page settings in WordPress DB.
- **Proposed minimal change:** exclude only neighborhood, street, beach, developer, and place-of-property empty children; exclude only `/cart/` and `/my-account/` from XML while preserving their `200/noindex` behavior.
- **Affected files/settings/URLs:** exact Yoast taxonomy/Page sitemap settings; seven known outputs.
- **Expected effect:** sitemap consistency without Woo functional change.
- **Dependencies:** GSC check for the exact items, Yoast export, booking/OTA dependency inventory, backup/staging.
- **Risks:** broad taxonomy setting could remove non-empty or strategic URLs; Woo settings could affect account/cart behavior.
- **Tests:** compare all child counts to the 1,861-entry baseline; functional Cart/My Account smoke test; booking/OTA regression; no unrelated count change.
- **Rollback:** restore exact Yoast settings and recrawl XML.
- **Access/backup requirement:** WP/Yoast staging write after restore proof.
- **Status:** `NEEDS EVIDENCE`.

## 3. Correct only the proven `/projects/` source

- **Source task ID:** CDX-AFTER-04 / MLD-P0-02
- **Exact problem:** `/projects/` redirects to the legacy hub while the future hub must remain Draft and child routes must later publish safely.
- **Source of truth:** unresolved WordPress sub-layer; `/projects-thailand-phuket/` separately belongs to Yoast Premium.
- **Proposed minimal change:** after export proves ownership, change only the exact `/projects/` record/state. No wildcard and no legacy destination change.
- **Affected files/settings/URLs:** exact redirect record, old-slug metadata, or Page state identified by diagnosis; `/projects/`, legacy hub, and three child previews.
- **Expected effect:** approved child-route readiness while hub remains Draft.
- **Dependencies:** authenticated Page metadata, Yoast redirect export, server rules, backup/staging, owner-approved temporary route behavior.
- **Risks:** legacy backlinks/navigation, canonical loops, unrelated Page hierarchy.
- **Tests:** root/legacy/preview matrix; no loop/fallback; canonical/robots; unrelated hierarchical Pages.
- **Rollback:** restore exact exported rule or Page metadata and cache state.
- **Access/backup requirement:** read access first; later narrowly authorized staging write.
- **Status:** `NEEDS ACCESS`.

## 4. Replace form-attempt lead semantics with approved success events

- **Source task ID:** CDX-AFTER-03 / MLD-P1-03
- **Exact problem:** child-theme `form_submit_attempt` immediately emits `generate_lead`; no CF7 delivery-success callback is present.
- **Source of truth:** `lead-events.js` plus CF7/GTM/plugin configuration.
- **Proposed minimal change:** only after owner approval, bind one deduplicated privacy-safe event to native CF7 success and keep validation errors distinct; remove success semantics from attempts if approved.
- **Affected files/settings/URLs:** likely child-theme JS or versioned GTM container; exact CF7 forms; no field changes.
- **Expected effect:** one event per actual successful submission and no validation-error lead inflation.
- **Dependencies:** approved event dictionary, qualified-lead definition, consent rules, CF7 export, staging delivery test.
- **Risks:** duplicate events; false success; consent bypass; PII leakage.
- **Tests:** invalid attempt sends no success; one controlled staging success sends exactly one; DebugView matches non-PII delivery record.
- **Rollback:** revert one versioned JS/container change.
- **Access/backup requirement:** staging and versioned rollback; production publish separately approved.
- **Status:** `BLOCKED BY OWNER DECISION`.

## 5. Remove contact data from click-event `link_text`

- **Source task ID:** CDX-AFTER-03 / MLD-P1-03
- **Exact problem:** `click_phone`, `click_email`, WhatsApp/Telegram, submit, and property-card events include visible `link_text`, which may contain contact or entity data.
- **Source of truth:** `wp-content/themes/malendo-child/assets/js/lead-events.js`.
- **Proposed minimal change:** remove `link_text` from owner-approved event payloads; retain only approved categorical fields and pathname without query data.
- **Affected files/settings/URLs:** one child-theme JS file; all frontend tracked clicks.
- **Expected effect:** lower analytics PII/content risk without changing navigation.
- **Dependencies:** analytics owner approval, GTM/GA4 duplicate inventory, consent policy, staging.
- **Risks:** dashboard dimensions relying on link text; duplicate implementations elsewhere.
- **Tests:** inspect every event payload; verify no phone/email/name/project/unit/message/full URL/query; verify clicks navigate normally and fire once.
- **Rollback:** revert one versioned child-theme commit/container version.
- **Access/backup requirement:** staging plus GA4/GTM read access; production deploy separately approved.
- **Status:** `READY FOR OWNER REVIEW` after access inventory.

## Recommended first review

Review proposal 1 first after the backup/staging gate. It is the narrowest confirmed defect and has the smallest expected dependency surface. This document does not authorize implementation.
