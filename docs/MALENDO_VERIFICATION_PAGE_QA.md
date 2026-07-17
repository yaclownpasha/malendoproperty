# Malendo Verification Page QA

## Purpose

`scripts/check-malendo-verification-pages.mjs` is a read-only QA tool for Malendo developer and project verification Pages. Run it when a public URL or an authenticated-preview URL is available and before asking an editor to approve indexing.

The tool reads local HTML snapshots or fetches HTML and linked resources. It does not log in, submit forms, change WordPress, write to the database, or mutate production.

## Requirements

- Node.js 18 or newer with built-in `fetch`;
- a local JSON manifest;
- network access to each Page and source URL being checked, unless local snapshots are supplied.

No npm install or API credential is required.

Do not put WordPress cookies, passwords, preview nonces, private source data, or personal data in a committed manifest. Keep manifests containing private preview URLs outside the repository.

## Run

Default console report:

```bash
node scripts/check-malendo-verification-pages.mjs --manifest path/to/pages.json
```

Markdown report:

```bash
node scripts/check-malendo-verification-pages.mjs --manifest path/to/pages.json --markdown
```

JSON report:

```bash
node scripts/check-malendo-verification-pages.mjs --manifest path/to/pages.json --json
```

Authenticated local snapshots:

```bash
node scripts/check-malendo-verification-pages.mjs \
  --manifest phase1-page-manifest.json \
  --snapshots phase1-snapshots.json \
  --markdown
```

Use `--json` or omit the output flag for JSON or console output in the same way as network mode.

Help:

```bash
node scripts/check-malendo-verification-pages.mjs --help
```

## Manifest format

The preferred root format has `pages` and optional `ordinaryPages` arrays:

```json
{
  "pages": [
    {
      "pageName": "Example Phuket Project Review",
      "url": "https://malendo-property.com/projects/example-phuket-project-review/",
      "expectedTitle": "Example Phuket Project Review | Malendo Property",
      "expectedH1": "Example Phuket Project Review",
      "expectedRobots": "noindex,nofollow",
      "expectedCanonical": "https://malendo-property.com/projects/example-phuket-project-review/",
      "pageType": "project",
      "requiresSources": true,
      "requiredInternalLinks": [
        "/developers/example-developer/",
        "/properties/"
      ],
      "requiredCtaLinks": [
        "/request-phuket-project-check/",
        "/request-phuket-project-check/#current-availability",
        "/request-phuket-project-check/#compare-projects",
        "/request-phuket-project-check/#send-documents"
      ],
      "requiredSourceIds": ["[S01]", "[S02]"]
    }
  ],
  "ordinaryPages": [
    {
      "pageName": "Contact page",
      "url": "https://malendo-property.com/contact/"
    }
  ]
}
```

A root JSON array of Page entries is also accepted, but it cannot configure ordinary-page asset-scope checks.

### Page fields

| Field | Purpose |
| --- | --- |
| `pageName` | Human-readable report label. Required. |
| `url` | Absolute HTTP(S) Page or preview URL. Required. |
| `expectedTitle` | Exact expected title tag. |
| `expectedH1` | Exact expected H1 text. |
| `expectedRobots` | Expected robots directives. Use `noindex,nofollow` before editorial approval. |
| `expectedCanonical` | Expected canonical URL. |
| `pageType` | Report grouping such as `developer` or `project`. |
| `requiresSources` | Whether research-source evidence is mandatory. Defaults to `true`. |
| `requiredInternalLinks` | Internal paths or absolute URLs that must render and be accessible. |
| `requiredCtaLinks` | Approved CTA destinations that must render. |
| `requiredSourceIds` | Source identifiers that must appear inline and in the source table. |

`requiredInternalLinks`, `requiredCtaLinks`, and `requiredSourceIds` default to empty arrays. Configure them explicitly so the report can enforce the editorial brief.

### Optional source requirements

Research pages keep the default `"requiresSources": true`. Developer and project pages cannot opt out: they must include inline source IDs, a `.malendo-source-table`, HTTP(S) source links, and accessible source URLs.

Methodology and Request a Project Check pages may set:

```json
"requiresSources": false
```

For those pages, the five source checks are reported as `SKIPPED` with the detail `Not required for this page type`. Every other metadata, H1, robots, canonical, component, CTA, internal-link, asset, domain, schema, and wording check still runs.

A manifest is invalid when `requiresSources` is not a boolean, when a developer/project page sets it to `false`, or when `requiredSourceIds` contains values while `requiresSources` is `false`. This prevents an accidental opt-out from silently weakening a research brief.

### Ordinary Pages

Add at least one unrelated normal Page to `ordinaryPages`. The checker confirms that `verification-content.css` and `verification-content.js` are absent there. This validates that verification assets remain page-scoped.

## Local authenticated snapshots

Use snapshots when a WordPress Draft or preview requires an authenticated browser session. Export the fully rendered HTML locally, then create a private JSON mapping next to a private snapshots directory:

```json
{
  "https://malendo-property.com/project-check-methodology-phuket/": {
    "htmlFile": "private-snapshots/methodology.html",
    "finalUrl": "https://malendo-property.com/project-check-methodology-phuket/"
  },
  "https://malendo-property.com/request-phuket-project-check/": {
    "htmlFile": "private-snapshots/request.html",
    "finalUrl": "https://malendo-property.com/request-phuket-project-check/"
  }
}
```

Snapshot keys must be absolute HTTP(S) Page URLs. `htmlFile` must be a relative path inside the snapshot manifest directory; absolute paths and `..` traversal are rejected. `finalUrl` must be the public URL represented by the rendered HTML.

The checker matches a snapshot by the Page `url`, falling back to `expectedCanonical`. Pages without a matching snapshot continue through the existing network mode. This permits a mixed report without changing network behavior.

For a snapshot Page, all HTML checks still run: metadata, H1, robots, canonical, wrapper, last-checked block, disclaimer, classifications, source requirements, rendered CTA/internal links, duplicate IDs, raw shortcodes, asset markers, schema, risky wording, and old domains.

The checker does not make Page, source, CTA, or required internal-link requests for a snapshot Page. These accessibility checks report:

```text
SKIPPED: Local authenticated snapshot
```

Presence in exported HTML is not proof that a destination works. Complete accessibility checks after the Page has an owner-approved public URL.

### Snapshot privacy

- Never commit exported authenticated HTML or a private snapshot manifest.
- Never include cookies, authorization headers, passwords, preview nonces, form values, or personal data.
- Store snapshot files outside Git or in a locally ignored private directory.
- Inspect exports before use because rendered HTML can contain admin-bar details or private preview URLs.
- Reports include only the snapshot manifest basename and Page URLs. Absolute local file paths are never printed.

## Approved CTA destinations

Verification CTA links must use the Malendo host and this path:

```text
/request-phuket-project-check/
```

The following anchors are approved:

```text
/request-phuket-project-check/#current-availability
/request-phuket-project-check/#compare-projects
/request-phuket-project-check/#send-documents
```

Both relative links and absolute `https://malendo-property.com` links are accepted. Other hosts, paths, anchors, or CTA query strings fail the approved CTA check.

## Checks

For every verification Page, the script checks:

1. HTTP status and final URL after redirects.
2. Title and non-empty meta description.
3. Exactly one H1 and exact expected H1 text.
4. Mandatory public pre-approval `noindex,nofollow` plus expected robots directives.
5. Canonical presence and exact expected canonical.
6. Rendered last-checked date.
7. Visible verification disclaimer.
8. Rendered verification classifications.
9. Required inline source IDs such as `[S06]` when `requiresSources` is true.
10. Required source IDs represented in `.malendo-source-table` when sources are required.
11. Source-table HTTP(S) links and their accessibility when sources are required.
12. Verification CTA presence, approved destination, and accessibility.
13. Required CTA and internal-link presence.
14. Required internal-link accessibility.
15. Links or HTML using `malendo.property` or `drunkentiki.com`.
16. Raw `[malendo_...]` shortcode leakage.
17. Verification CSS and JavaScript presence.
18. `.malendo-verification-content` wrapper presence.
19. Approved responsive classes on rendered tables.
20. Duplicate element or heading IDs.
21. GA4 and `lead-events.js` markers.
22. Absence of Review and AggregateRating schema.
23. Conservative unsupported guarantee/yield wording patterns.

In snapshot mode, all HTTP accessibility checks are `SKIPPED`; every applicable HTML check above remains active.

The tool also checks that verification CSS/JS are absent from configured ordinary Pages.

## Preview handling

The script does not accept WordPress credentials or cookies. A response is marked `Unverifiable without authenticated preview` when it returns HTTP 401/403, redirects to `wp-login.php`, or displays a WordPress login form for a preview URL.

This is not a content failure. Open the preview in an authenticated browser and export its rendered HTML for snapshot mode, complete the checks manually, or provide a temporary owner-approved public noindex URL. Never paste credentials or private cookies into either manifest.

## Page statuses

| Status | Meaning |
| --- | --- |
| `Ready for editorial approval` | No failures or warnings were found. This is not permission to index automatically. |
| `Needs factual correction` | Unsafe domain or unsupported guarantee/yield wording was found. |
| `Needs source correction` | Source identifiers, source table, source links, or source accessibility failed. |
| `Missing CTA/internal links` | Required or approved CTA/internal links are missing or broken. |
| `Needs formatting correction` | Metadata, H1, components, assets, wrappers, tables, IDs, or shortcode rendering failed. |
| `Indexing/status unsafe` | Robots, canonical, or disallowed schema failed. |
| `Unverifiable without authenticated preview` | Public HTML was unavailable without authentication. |
| `Keep Draft/noindex` | Only warnings remain and human review is still required. |

Individual checks may report `SKIPPED` when source evidence is explicitly not required for that page type. A skipped source check does not change the page status or exit code.

The primary status follows the highest-priority failed category. The per-check table remains the source of truth when several categories have problems.

## Exit codes

- `0`: the run completed and no `FAIL` check was recorded;
- `1`: at least one `FAIL` check occurred, the manifest was invalid, or the script could not run.

Warnings, including an authenticated preview that cannot be inspected, do not alone cause exit code `1`.

## Report privacy

Page, source, CTA, and internal-link query strings are not printed. URL fragments are printed only for approved CTA reporting. Snapshot reports never expose absolute local file paths. The script does not report anchor text as an analytics payload and does not send analytics events itself.

The script never submits forms. Requests use a fixed user agent and a timeout. Source and destination checks use `HEAD` where possible, with a small ranged `GET` fallback only when a server rejects `HEAD`.

## Interpreting source accessibility

- HTTP 200-399: pass;
- HTTP 401, 403, or 429: warning because the source may block automated checks;
- network error, HTTP 404, or HTTP 5xx: fail and verify the source manually.

A passing HTTP status does not prove that a source supports the claim. The editor must still read the source, confirm the date, and verify the cited fact.

## Unsupported wording review

The checker flags phrases such as guaranteed returns, guaranteed yield, risk-free investment, fixed or assured returns, and numeric yield/return/ROI claims. This is intentionally conservative.

If a Page neutrally quotes such wording as a developer claim or warning, an editor must still review the passage. Do not weaken or remove the check merely to obtain a green report.

## Editorial workflow

1. Keep the WordPress Page as Draft.
2. Set Yoast to `noindex,nofollow` before exposing a public pre-approval URL.
3. Prepare a local manifest with exact expected metadata, links, CTA destinations, and source IDs.
4. For an authenticated Draft, export rendered HTML and prepare a private snapshot mapping outside Git.
5. Run the Markdown report in network or snapshot mode.
6. Correct factual and source failures first.
7. Correct links, formatting, robots, and canonical issues.
8. Rerun until no failures remain.
9. Complete manual legal/editorial review and browser QA.
10. Obtain owner/editor approval before changing indexation.

## Manual checks still required

The script cannot prove:

- that a source is trustworthy or current;
- that a claim is legally safe or complete;
- that images, tables, and components look correct at every viewport;
- that TOC and CTA keyboard behavior works in a real browser;
- that GA4 events appear correctly in DebugView;
- that a Page deserves indexation.

Manually test desktop and mobile layout, keyboard navigation, source context, CTA behavior, GA4 DebugView, browser console, and the complete editorial quality gate.

## Rollback

This tool is local and read-only. To remove it, revert the PR that added:

- `scripts/check-malendo-verification-pages.mjs`;
- `docs/MALENDO_VERIFICATION_PAGE_QA.md`;
- `docs/malendo-verification-pages.example.json`.

No production rollback or cache clear is required because the tool does not deploy or alter WordPress.

Delete private snapshot exports locally when they are no longer needed. They are not repository artifacts and must never be committed.
