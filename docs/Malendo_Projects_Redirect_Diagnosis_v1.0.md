# Malendo `/projects/` Redirect Diagnosis v1.0

Evidence timestamp: 13 August 2026, 20:56-21:03 Asia/Bangkok. Read-only only.

## Exact redirect chains

| Requested route | Chain | Redirect owner evidence | Final canonical | Result |
|---|---|---|---|---|
| `/projects/` | `/projects/` `301` -> `/thailand/phuket/projects/` `200` | `X-Redirect-By: WordPress` | `/thailand/phuket/projects/` | Exact WordPress sub-source unresolved |
| `/projects-thailand-phuket/` | `/projects-thailand-phuket/` `301` -> `/thailand/phuket/projects/` `200` | `X-Redirect-By: Yoast SEO Premium` | `/thailand/phuket/projects/` | Yoast Premium configuration layer confirmed |
| `/thailand/phuket/projects/` | Direct `200` | No redirect | Self-canonical | Legacy hub remains live |

All responses report nginx as the server. The nginx header does not prove that nginx owns either redirect. The explicit `X-Redirect-By` headers place the behavior in WordPress/Yoast response handling.

## Planned routes

| Route | Public result | Redirect behavior |
|---|---:|---|
| `/request-phuket-project-check/` | `404`, `noindex, follow` | No redirect |
| `/project-check-methodology-phuket/` | `404`, `noindex, follow` | No redirect |
| `/projects/the-title-legendary-bang-tao-verification/` | `404`, `noindex, follow` | No legacy fallback |
| `/projects/laguna-lakeside-phuket-verification/` | `404`, `noindex, follow` | No legacy fallback |
| `/projects/the-base-bukit-phuket-verification/` | `404`, `noindex, follow` | No legacy fallback |

The direct child-route `404` results show that the current root redirect is not acting as a wildcard redirect over `/projects/*`. This does not prove that authenticated previews or future published children will work.

## Page and Preview evidence

Public REST requests for Pages `27678283`, `27678285`, `27678290`, `27678291`, `27678292`, and `27678293` return `401`. No credentials or cookies were used. Therefore the following remain unverified:

- current Draft/publish status;
- parent Page assignments;
- generated permalinks;
- `_wp_old_slug` or redirect metadata;
- authenticated Preview URLs;
- Yoast per-Page canonical/robots fields.

## Root cause

### Confirmed

- No child-theme or repository redirect/rewrite targets `/projects/`.
- `/projects-thailand-phuket/` is redirected by Yoast SEO Premium.
- `/projects/` is redirected by the WordPress layer, but the public response cannot distinguish WordPress core canonical redirect, old-slug metadata, another plugin using the generic header, or database state.

### Status

`UNRESOLVED — NEEDS ACCESS` for the exact `/projects/` source.

Required minimum evidence:

1. sanitized Yoast Premium redirect export;
2. read-only Page hierarchy/permalink metadata for `27678290-27678293`;
3. effective nginx vhost and `.htaccess` export;
4. redirect-plugin and mu/custom-plugin inventory;
5. authenticated Preview chains captured without exposing cookies.

## Dependency risk

- Legacy navigation and backlinks may rely on `/thailand/phuket/projects/`.
- Yoast redirects may carry historical SEO intent.
- Parent Draft state may influence WordPress canonical resolution.
- A global canonical or rewrite filter can affect unrelated hierarchical Pages.
- Publication order is outside this task and must not be inferred from public `404` behavior.

## Smallest future correction

No patch is ready until the exact source is exported.

Preferred decision order after access:

1. If an exact redirect-manager entry owns `/projects/`, change or disable only that record on staging.
2. If exact old-slug metadata owns it, remove only the confirmed stale metadata using a backed-up, auditable WordPress operation.
3. If WordPress core canonical behavior is caused by Page hierarchy/status, correct only the approved Page state/relationship during the later publication workflow.
4. Consider a narrowly scoped code filter only if no admin/config source can solve the exact route and staging proves no side effects.

## Prohibited alternatives

- wildcard `/projects/*` redirects;
- publishing the hub or children;
- changing slugs, parents, canonicals, or legacy destination now;
- global `redirect_canonical` disablement;
- database search/replace;
- changing server/CDN rules without source and rollback evidence.

## Proposed staging tests

1. Record the pre-change source record and checksums/export.
2. Request `/projects/`, `/projects-thailand-phuket/`, and the legacy hub with redirects disabled in the client.
3. Check authenticated previews for all four hub/project IDs.
4. Confirm planned child routes do not loop, fall back to root, or hit legacy content.
5. Confirm the legacy hub behavior matches the owner-approved temporary state.
6. Recheck canonical, robots, sitemap presence, navigation, and cache behavior.
7. Confirm unrelated hierarchical Page routes are unchanged.

## Rollback

- Restore the exact exported redirect record or Page metadata/state.
- Clear only the relevant WordPress/server/CDN caches.
- Repeat the pre-change route matrix.
- Stop if rollback cannot reproduce the recorded prior behavior.

No redirect, Page, slug, parent, canonical, or publication state was changed during this diagnosis.
