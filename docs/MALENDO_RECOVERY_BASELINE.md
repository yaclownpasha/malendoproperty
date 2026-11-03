# Verified recovery theme baseline — 2026-11-04

This PR imports the existing production theme without changing any source byte. It makes
the current Malendo code reviewable in the existing repository; it does not deploy or
implement notifications. The older MyHome documentation remains historical context.

## Provenance

- Site: `https://malendo-property.com`, VPS `malendo-web-prod-01`, `152.42.198.33`.
- Production: `/srv/malendo-recovery/site/wp-content/themes/malendo-recovery/`.
- Server Git: `/root/malendo-stabilization-20261103/package`, `theme/`.
- Server HEAD: `e23ef676d35489c7677718d4a62756d92cea159d`.
- Analytics source commit recorded by Work: `31a9f084de42230edf32ff9cf23d70137a872a96`.
- GitHub base: `3906aff3f38971e30b5815b27f3830cee622b20d` in `yaclownpasha/malendoproperty`.
- Owner handoff: [Malendo P0 Leads + GA4, 2026-11-04](https://chatgpt.com/library?file_id=libfile_4d270006825c8191a499b8ce75f5ee7f&account_id=personal).
- File hashes and byte sizes: [MALENDO_RECOVERY_BASELINE_MANIFEST.json](MALENDO_RECOVERY_BASELINE_MANIFEST.json).

Read-only SSH used the existing Malendo identity and strict host-key checking. At
2026-11-03 17:26:30–17:27:12 UTC (2026-11-04 00:26:30–00:27:12 Bangkok), all 12 files
matched the handoff, production, server worktree and `git show HEAD:theme/<file>`.
The server Git has no tracked changes; its existing untracked `rendered/` was excluded.
The copied source totals 40,749 bytes. The historical "Recovery Preview" theme header
and version 0.1.0 are deliberately preserved; this baseline is not a theme rewrite.

## Ownership and deployment gate

The two relevant migration/recovery chats reported idle/completed; the connected Windows
device reported no active terminal sessions. The server process observation showed no
git/scp/rsync/archive/deployment writer, systemd reported no pending jobs, and neither
the production theme nor server package contained `*.lock` files. These are observations
at the check time, not a durable server-wide exclusive lock. No server write is needed
for this PR. Recheck ownership before any future mutation.

The requested `codex/malendo-lead-notifications` ref was absent before preparation.
Existing PRs #42–45 concern legacy audit/CF7 work and do not establish this baseline.
The existing `htemal` connection has repository push permission; no access grant was added.

At the pinned GitHub base there is one workflow, `.github/workflows/deploy.yml`, blob
`551d662f82da9f345579878cf2e0b48dcf96edf2`. Its only events are `push` to `main`
with paths `wp-content/themes/malendo-child/**` or that workflow itself, and manual
`workflow_dispatch`. There is no PR or branch-create trigger. This PR changes none of
those paths and never dispatches a workflow. Existing deployment secrets were not read;
their target is unverified. Do not use the old workflow for recovery.

## Validation and limits

- PASS: 12/12 exact SHA-256 comparisons across handoff, live theme, package and server Git.
- PASS: all 10 PHP files parsed using PHP 8.3.6, `php -n -l`, without executing theme code.
- PASS: static classic WordPress theme structure: `style.css` Theme Name/Text Domain,
  no parent Template header, `index.php`, header/footer hooks and all three includes present.
- Source review: only the 12 theme files are imported, with no SQL, backups, wp-config,
  keys, OAuth material, customer records or rendered output. Public brand email and GA4
  Measurement ID already present in the source are not credentials.
- `inc-leads.php`, `inc-analytics.php` and `analytics.js` are exact production copies:
  no changes to saving, consent, receipt consumption or event behavior.
- No old theme or workflow edits; no production writes, database access, form submissions,
  OAuth authorization, external email, synthetic analytics events, merge or deployment.
- NOT RUN: a new isolated WordPress/browser integration acceptance, live enquiry readback,
  actual GA4 conversion receipt, full backup restore, Gmail transport/authorization tests.
  Handoff evidence for enquiries #52/#56 and backups is historical, not a fresh claim here.

Known baseline limitations remain: meta writes are not fully read back before the saved
hook; analytics receipt consumption precedes delivery confirmation; the theme header and
404 copy still mention preview/recovery. Preserve these exact bytes in this PR. Independent
Work review decides acceptance; this import is not evidence that those issues are fixed.

## Independent Work acceptance

1. Review the separate documentation and source-import commits against the pinned main.
2. Compare every imported file with the manifest and a fresh read-only production readback.
   STOP on drift; never overwrite production to make hashes agree.
3. Verify there are exactly 12 theme additions, no changes to `malendo-child` or workflows,
   no secrets/customer data and no deployment run associated with the PR branch.
4. Repeat PHP syntax and theme structure checks on the PR checkout. Report integration
   coverage separately. No live form POST, DB mutation or test email is authorized.
5. Return acceptance evidence before any notifications implementation or release decision.

## Rollback

Before merge, close the Draft PR if rejected. Production needs no rollback because no
deployment occurs. If the baseline is later merged under separate authorization, revert
the source-import commit and then the documentation commit in a reviewable follow-up PR.
Do not restore an old database, remove enquiries or run the legacy deploy workflow.

## Next Codex task — only after independent baseline acceptance

Use the accepted baseline commit in this existing repository. Prepare a separate Draft PR
for Gmail notifications; keep transport disabled and do not authorize OAuth, install a
timer, send mail, merge or deploy. Recheck ownership and source hashes first.

Implement the detailed handoff section 6B–6C: read back every required saved field and
consent timestamp before success/hook; keep partially saved data on failure. Add a durable
queue in existing WordPress storage, unique ID/version keys, atomic claim/lease, bounded
retries, activation boundary and recovery for the save/enqueue gap. Exclude historical
#52/#56 from backfill. Gmail send-only scope, fixed authorized sender/recipient, minimal
body (ID, Bangkok time, whitelisted service, protected WP-admin URL), no client PII or
secrets in messages/logs. Keep unknown send outcomes as `unknown_delivery`, never blind
replay; API acceptance is not inbox delivery. OAuth mailbox/project selection, owner grant
and verification/exception remain separate gates. Tokens stay outside Git/webroot.

Suggested scope: `inc-leads.php`, one include in `functions.php`, new
`inc-notifications.php`, a bounded CLI worker, synthetic tests and reviewed timer example.
Keep analytics source unchanged unless a separately justified regression requires it.
Use the existing harness with mock transport: save failures, nonce/honeypot/consent,
duplicate hook/two workers/crash, expired leases, 429/503/Retry-After/invalid_grant,
timeout after send, message/header privacy, disabled WP cron and GA4 regressions without
external collection. A new production database or global WP cron activation is forbidden.

Sender `malendophuket@gmail.com`; recipient `acrabash@gmail.com`; subject
`Malendo — New enquiry #ID`. Real authorization and any concrete test send require a
separate owner-approved stage. Rollback must disable transport/worker while preserving
queue, accepted/unknown markers and all enquiries; never restore an old DB over live data.
