# Malendo Verification Content MVP

This document explains the reusable verification-content shortcodes added to the `malendo-child` theme. They are designed for normal WordPress Pages built with WPBakery.

The components do not create Pages, import research, register post types, change MyHome data, submit forms, or make content indexable. An employee remains responsible for creating each Page as Draft, adding sourced content, setting Yoast to noindex, and completing the editorial quality gate.

## Scope

The MVP provides:

- verification status boxes;
- a last-checked date;
- a verification disclaimer;
- internal CTA links;
- an opt-in table of contents;
- table classes for facts, sources, projects, and developer relationships;
- narrowly scoped GA4 click events.

It does not provide:

- custom post types or taxonomies;
- automatic page or source generation;
- data imports;
- sticky mobile CTAs;
- forms;
- redirects;
- Review, AggregateRating, Product, Offer, or duplicate Organization schema;
- automatic indexation.

Yoast remains responsible for WebPage, Article, Breadcrumb, canonical, and robots output.

## Asset loading

`verification-content.css` and `verification-content.js` load only on a singular WordPress Page whose saved `post_content` contains at least one of these shortcodes:

- `malendo_verification_box`
- `malendo_last_checked`
- `malendo_verification_disclaimer`
- `malendo_verification_cta`
- `malendo_verification_toc`

Pages without these shortcodes are unaffected. The assets are not loaded for archives, estates, products, posts, REST, AJAX, WP-CLI, JSON requests, or wp-admin.

If a Page uses only the documented table classes, include at least one verification shortcode so the scoped stylesheet is loaded.

## WPBakery employee workflow

1. Create or open a normal WordPress Page.
2. Keep the Page as Draft.
3. In Yoast Advanced, set `Allow search engines to show this content` to `No`.
4. Add one main WPBakery Row and set its Extra class name to `malendo-verification-content`.
5. Add the shortcodes in a Text Block using Text mode, or in a dedicated shortcode element if available.
6. Add table HTML in a Raw HTML element or Text Block using Text mode.
7. Do not paste shortcode examples into a Code block; they must be processed by WordPress.
8. Preview the Page while logged in.
9. Complete source, content, link, legal, and QA checks before publishing.
10. Change Yoast to index only after owner/editor approval.

The `malendo-verification-content` row class gives the components a stable content scope and theme variables. It is mandatory when using `[malendo_verification_toc]`. The TOC does not fall back to `main`, `article` or `document.body`; it stays hidden when the shortcode is not inside this wrapper.

## Verification status box

Syntax:

```text
[malendo_verification_box type="verified" title="Verified fact"]
Normal formatted WordPress content can go here, including paragraphs, lists, emphasis and links.
[/malendo_verification_box]
```

Allowed `type` values:

| Type | Use |
|---|---|
| `verified` | A fact checked against a current source |
| `developer-claim` | A statement made by a developer or project sales source |
| `public-report` | A statement attributed to a public report or publication |
| `inconsistency` | Conflicting information that needs neutral explanation |
| `unknown` | A fact that is not currently confirmed |
| `buyer-question` | A practical question the buyer should verify |

Unknown type values fall back to `unknown`. Titles are rendered as escaped text. Body content supports normal safe WordPress post formatting and nested shortcodes.

Examples:

```text
[malendo_verification_box type="developer-claim" title="Developer-stated completion date"]
The developer's current brochure states Q4 2027. Malendo has not independently confirmed the construction schedule.
[/malendo_verification_box]

[malendo_verification_box type="inconsistency" title="Unit count differs between sources"]
The official project page and an older brochure show different totals. Ask for the current registered project schedule.
[/malendo_verification_box]

[malendo_verification_box type="buyer-question" title="Documents to ask for"]
Request the title documents, contract draft, payment schedule and evidence supporting any permit or EIA claim.
[/malendo_verification_box]
```

Use neutral wording. Do not use the component to label a person or business as fraudulent, criminal, a scam, or dishonest.

## Last checked

Syntax:

```text
[malendo_last_checked date="2026-07-15"]
```

Output:

```text
Last checked: 15 July 2026
```

The date must be a real calendar date in `YYYY-MM-DD` format. Invalid or missing dates render no output.

Use the date when the cited facts were actually reviewed, not the Page publication date.

## Verification disclaimer

Default:

```text
[malendo_verification_disclaimer]
```

Default text:

> Public-source research only. This page is not legal, tax, financial or investment advice. Buyers should verify documents with qualified Thai legal and professional advisers.

Optional custom text:

```text
[malendo_verification_disclaimer text="Project-specific disclaimer approved by the owner or editor."]
```

Custom text is rendered as escaped plain text. HTML and shortcodes are not supported in the `text` attribute.

## Verification CTA

Syntax:

```text
[malendo_verification_cta type="project-check" url="/request-phuket-project-check/" label="Request a Project Check"]
```

Allowed types and default labels:

| Type | Default label | Specific GA4 event |
|---|---|---|
| `project-check` | Request a Project Check | `project_check_request` |
| `developer-check` | Request a Developer Check | `developer_check_request` |
| `current-availability` | Check Current Availability | `project_availability_request` |
| `send-documents` | Send Project Documents | `project_documents_send` |
| `compare-projects` | Compare Projects | `project_compare_request` |

Examples:

```text
[malendo_verification_cta type="developer-check" url="/request-phuket-project-check/" label="Request a Developer Check"]

[malendo_verification_cta type="current-availability" url="/request-phuket-project-check/#current-availability" label="Check Current Availability"]

[malendo_verification_cta type="compare-projects" url="/request-phuket-project-check/#compare-projects" label="Compare Projects"]

[malendo_verification_cta type="send-documents" url="/request-phuket-project-check/#send-documents" label="Send Project Documents"]
```

CTA safety:

- The URL must be a relative internal path or an absolute URL on the current Malendo host.
- External, protocol-relative, `javascript:`, `mailto:` and `tel:` destinations do not render.
- For this MVP, use `/request-phuket-project-check/` and its approved `#current-availability`, `#compare-projects` and `#send-documents` anchors.
- Same-host validation preserves the approved URL fragment so the CTA can reach the intended section on the shared landing Page.
- Keep the documented CTA labels. Do not relabel a verification CTA with `Submit`, `Application` or `List your property`, because the existing global lead tracker intentionally treats those phrases as Submit/Application lead actions.
- The shortcode creates a link only. It does not submit a form or block navigation.
- Verify that the destination returns HTTP 200 before publishing.
- Do not place names, emails, phone numbers, unit numbers, messages or document details in a CTA URL.

## Table of contents

Syntax:

```text
[malendo_verification_toc]
```

The shortcode renders an initially hidden navigation placeholder. On that Page only, the scoped script:

- requires the shortcode to be inside the closest `.malendo-verification-content` wrapper;
- finds visible H2 and H3 headings only inside that wrapper;
- excludes headings inside headers, footers, navigation, sidebars, asides and widgets;
- preserves a unique existing heading ID;
- generates a unique ID when an ID is missing or duplicated;
- builds keyboard-accessible anchor links;
- keeps the TOC hidden if the wrapper is missing or no eligible headings exist.

The script does not scan or change headings on Pages without the shortcode.

Recommended heading structure:

```html
<h2>Developer overview</h2>
<h2>Projects in Phuket</h2>
<h3>Active projects</h3>
<h3>Completed projects</h3>
<h2>Sources checked</h2>
```

## Verification table classes

Apply one of these classes directly to employee-created HTML tables:

- `.malendo-verification-table` - general verification data;
- `.malendo-source-table` - editorial sources;
- `.malendo-project-facts` - project facts;
- `.malendo-developer-projects` - developer/project relationships.

Tables use horizontal scrolling on narrow screens. Always include a caption, table headers and appropriate `scope` attributes.

### Source table example

```html
<table class="malendo-source-table">
  <caption>Sources checked</caption>
  <thead>
    <tr>
      <th scope="col">Source</th>
      <th scope="col">What it supports</th>
      <th scope="col">Checked</th>
      <th scope="col">Status</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><a href="https://example.com/exact-source-page">Official project page</a></td>
      <td>Developer-stated facilities and unit mix</td>
      <td><time datetime="2026-07-15">15 July 2026</time></td>
      <td>Developer claim</td>
    </tr>
    <tr>
      <td><a href="https://example.com/commercial-source" rel="sponsored">Commercial source</a></td>
      <td>Current advertised availability</td>
      <td><time datetime="2026-07-15">15 July 2026</time></td>
      <td>Public report</td>
    </tr>
  </tbody>
</table>
```

For HTTP and HTTPS links inside `.malendo-source-table`, the scoped script opens the link in a new tab and adds `noopener noreferrer`. It preserves employee-added `nofollow`, `sponsored` and other relation values. It does not add `nofollow` automatically to authoritative editorial sources.

Use the exact source page or document. Do not use a company homepage when a more specific source exists.

## Example developer Page

Create the Page as Draft under `/developers/` and keep it noindex:

```text
[malendo_verification_toc]
[malendo_last_checked date="2026-07-15"]

<h2>Developer overview</h2>
[malendo_verification_box type="verified" title="Official public name"]
State the exact fact and cite the source in the source table below.
[/malendo_verification_box]

[malendo_verification_box type="unknown" title="Legal entity"]
The public legal entity has not yet been independently confirmed.
[/malendo_verification_box]

<h2>Projects in Phuket</h2>
Add a table using the malendo-developer-projects class.

<h2>Questions for buyers</h2>
[malendo_verification_box type="buyer-question" title="Documents to verify"]
List the practical documents and professional checks appropriate to this developer or project.
[/malendo_verification_box]

<h2>Sources checked</h2>
Add a table using the malendo-source-table class.

[malendo_verification_cta type="developer-check" url="/request-phuket-project-check/" label="Request a Developer Check"]
[malendo_verification_disclaimer]
```

## Example project Page

Create the Page as Draft under `/projects/`, use a `-review` slug, and keep it noindex:

```text
[malendo_verification_toc]
[malendo_last_checked date="2026-07-15"]

<h2>Project facts</h2>
Add a table using the malendo-project-facts class.

[malendo_verification_box type="developer-claim" title="Advertised completion date"]
State who made the claim, the date of the source and whether Malendo independently confirmed it.
[/malendo_verification_box]

<h2>Information to verify</h2>
[malendo_verification_box type="inconsistency" title="Conflicting public information"]
Describe the conflict neutrally and explain which current document the buyer should request.
[/malendo_verification_box]

<h2>Active Malendo listings</h2>
Link only verified, active estate listings related to this project.

<h2>Sources checked</h2>
Add a table using the malendo-source-table class.

[malendo_verification_cta type="project-check" url="/request-phuket-project-check/" label="Request a Project Check"]
[malendo_verification_cta type="current-availability" url="/request-phuket-project-check/#current-availability" label="Check Current Availability"]
[malendo_verification_cta type="compare-projects" url="/request-phuket-project-check/#compare-projects" label="Compare Projects"]
[malendo_verification_cta type="send-documents" url="/request-phuket-project-check/#send-documents" label="Send Project Documents"]
[malendo_verification_disclaimer]
```

## Draft and noindex workflow

1. Research and record exact source URLs outside the public Page.
2. Create the Page as Draft.
3. Set Yoast robots to noindex.
4. Add unique editorial content and the verification components.
5. Preview and complete manual QA.
6. Have an owner/editor approve identity, legal-risk, price, status and investment language.
7. Confirm internal links, canonical, title, meta description and one H1.
8. Publish only when the Page is useful to visitors.
9. Change Yoast to index only after the full quality gate passes.
10. Recheck time-sensitive project data at least every 90 days and stable developer information at least every 180 days.

## Quality gate before indexing

Do not index a Page unless all applicable items pass:

- clear Phuket commercial relevance;
- materially unique editorial copy rather than copied brochure text;
- one H1 and a useful H2/H3 structure;
- at least two exact sources, including one primary source;
- every important fact is presented as verified, developer claim, public report, inconsistency or unknown;
- a visible last-checked date;
- a source table and verification disclaimer;
- working related developer, project, location, estate and contact links;
- working verification CTA destination;
- unique Yoast title and meta description;
- clean self-canonical and intended robots value;
- no old-domain, unrelated, broken or suspicious links;
- no unsupported legal, completion, price, return, guarantee, permit or rating claim;
- no duplicate or competing legacy URL without an approved decision;
- owner/editor approval recorded.

Do not create a Page only because a MyHome developer term, imported row or project name exists.

## GA4 tracking

Each verification CTA click sends:

1. `verification_cta_click`;
2. the specific event mapped to the allowed CTA type.

Each HTTP/HTTPS source link click inside `.malendo-source-table` sends:

- `verification_source_click`.

Safe parameters only:

- `cta_type`;
- `page_path` without query data;
- `source_host` for source clicks;
- `event_category=verification`;
- `transport_type=beacon`.

The script does not send names, email addresses, phone numbers, unit numbers, prices, brochure text, document names, anchor text, full href values, URL query data or form values. It does not emit `generate_lead` and does not change existing `lead-events.js` behavior.

### Tracking validation

1. Open a Draft preview or approved test Page containing each CTA type.
2. Open the browser console and GA4 DebugView.
3. Click each CTA once.
4. Confirm one `verification_cta_click` and one matching specific event.
5. Confirm navigation is immediate and unchanged.
6. Click one source link.
7. Confirm `verification_source_click` contains only `page_path` and `source_host` plus common safe parameters.
8. Confirm no `generate_lead` is sent by these CTA clicks.
9. Confirm existing phone, email, WhatsApp, Telegram, Submit/Application and property-card tracking still works.
10. Confirm no personal or query-string data appears in DebugView.

## Manual QA

Test desktop and mobile:

- verification boxes display neutral labels and readable content;
- invalid verification types safely use `unknown`;
- invalid dates render nothing;
- external CTA URLs do not render;
- approved internal CTA URLs render and work;
- CTA text fits and the mobile link is full width;
- TOC includes only visible H2/H3 headings in the content area;
- repeated heading text receives unique IDs;
- TOC links work with keyboard navigation;
- source links open in a new tab with `noopener noreferrer`;
- manual `nofollow` or `sponsored` values remain present;
- tables remain readable and scroll horizontally on small screens;
- no PHP warning, fatal error or JavaScript console error;
- pages without verification shortcodes do not load the new CSS or JS;
- existing WooCommerce/CF7 dequeue, GA4, REST hardening and Submit URL safety behavior remains unchanged.

Run the repository QA where available:

```bash
node scripts/check-malendo-live.mjs --markdown
node scripts/discover-malendo-assets.mjs --markdown
```

Live QA can confirm deployment safety, but shortcode rendering must be tested on a Draft preview or a deliberately approved test Page because this PR does not create WordPress content.

## Rollback

Preferred rollback:

1. Revert this PR.
2. Redeploy the previous child theme through the approved GitHub Actions workflow.
3. Clear WordPress/server/plugin caches.
4. Re-run live QA.

If employees have already placed these shortcodes in published content, first replace or remove the shortcode blocks. Reverting the PHP while shortcodes remain in content would expose literal shortcode text to visitors.

This PR itself does not create any Page, post, term, form, source record or production data.
