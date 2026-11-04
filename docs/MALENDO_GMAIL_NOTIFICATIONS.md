# Gmail notifications — development candidate, transport disabled

Stacked Draft PR: HEAD `codex/malendo-gmail-notifications`, BASE
`codex/malendo-lead-notifications`, accepted base
`89f0cce42817437b58293ad52d2616b1e6741261`. Do not add these changes to PR #46.
The existing workflow has no PR trigger and deploys only legacy-theme/workflow changes
on main or explicit dispatch. This change touches neither; do not run it.

## Changed behavior

`inc-leads.php` reads back every required meta field (including existence of empty
optional contact fields and the consent timestamp), private status and post type before
success or the existing saved hook. Consent must be the form's exact `yes` value;
nonempty strings such as `no` and array values are refused. Meta writes use `wp_slash` to preserve backslashes.
A false `update_post_meta` return is not itself a failure: unchanged values are valid.
On incomplete persistence, keep the partial record, record a safe error code, return the
existing server-error response, and do not call the analytics/notification hook.
No code in `inc-analytics.php` or `analytics.js` changes.

The final `_malendo_saved_v1` marker contains a hash of the complete saved field set,
activation generation, eligibility, QA flag, saved time and whitelisted service. It
contains no raw client fields. If the PHP request dies after this marker but before
enqueue, reconciliation creates the missing job. A crash before the marker cannot
produce a notification. No old unmarked record is inferred to be complete.

`inc-notifications.php` adds one unique `options.option_name` per ID/version with
`autoload=no`. Reads bypass WordPress option caches; transitions compare the complete
previous JSON with `BINARY` equality. A new random revision fences stale workers. The
stock unique `option_name` index must exist. There are no new tables or databases.

States: `pending`, `claimed` (pre-send), `sending`, `retry`, `accepted`, `failed`,
`needs_reauth`, `unknown_delivery`. Each row has attempts, due time, a 180-second lease,
safe status/error code, optional Gmail message ID and up to 20 UTC/Bangkok log entries.
No headers, credentials, MIME body, names, contact fields or free-form API errors are logged.

Before any Gmail call the worker durably transitions to `sending`. Expired `claimed`
work can be retried; expired `sending` becomes `unknown_delivery`. A lost SQL write after
Gmail success also leaves the job requiring reconciliation. No automatic retry of unknown,
accepted, failed or needs-reauth entries. This deliberately does not promise exactly-once
inbox delivery: Gmail acceptance and inbox receipt are different facts, and `Message-ID`
is not a Gmail deduplication guarantee. A second process cannot send using a stale revision.

## Transport and bounds

The theme only queues. Only the CLI constructs an enabled transport, and only when
`MALENDO_GMAIL_TRANSPORT=enabled`; default is disabled. Disabled CLI exits before loading
WordPress, reading credentials or making requests. The example service explicitly sets
`disabled`. Queue activation is a separate, immutable, explicit CLI operation.

Send endpoint is pinned to the sender mailbox in the URL, not `me`:
`https://gmail.googleapis.com/gmail/v1/users/malendophuket%40gmail.com/messages/send`.
From: `malendophuket@gmail.com`; To: `acrabash@gmail.com`; no CC/BCC.
Decoded subject: `Malendo — New enquiry #ID`. Body contains only ID, Bangkok time,
whitelisted service and the HTTPS WordPress admin link requiring normal authorization.

The refresh response must contain exactly `https://www.googleapis.com/auth/gmail.send`.
Missing/wider scopes stop with `needs_reauth`; there is no silent scope assumption and no
token in query strings. The Gmail mailbox route enforces authorization for that mailbox;
the future owner grant must independently verify the actual sender, project and scopes.
No OAuth grant, Cloud Terms acceptance or actual Google request is part of this PR.

Requests use fixed HTTPS URLs, certificate/hostname verification, no redirects/proxy,
5-second connect and 20-second overall timeout, and a 32 KiB response bound. Credentials
are read only by the enabled worker from an owner-owned regular 0600 JSON file outside
webroot, theme code and Git; no symlink file. Fields are `client_id`, `client_secret`,
`refresh_token`, `sender`. Never put a populated example in Git or a secret in CLI args.
Production CLI dependencies: PHP 8.3, JSON, cURL, POSIX; PCNTL enables graceful signals.

Five attempts maximum. Explicit Gmail 429/503 rejection and proven DNS/connect failure
before upload use exponential backoff (60 seconds doubling, 0–30 seconds jitter) and
respect Retry-After. OAuth failures before sending can also safely retry. Retry-After
over one day requires review rather than retrying too soon. One 401 permits one token
refresh/resend; subsequent 401, 403, invalid_grant or invalid scope stop for reauthorization.
Malformed success, ambiguous network results, 502/504 and crashes in the sending phase
become unknown delivery. A conservative stop can leave a message unsent; owner review is
safer than a duplicate. No send-only API is used to read the mailbox for reconciliation.

CLI runs at most 10 jobs, stops starting work after 40 seconds, and finishes the in-flight
bounded job. An individual job may use up to four 20-second HTTP calls. The example service
allows 150 seconds; a killed worker leaves persisted state for safe recovery. The shared
flock prevents concurrent CLI invocations; SQL CAS additionally protects the queue itself.
No global WP cron processing. A heartbeat and owner-only Enquiries → Notifications screen
show stale/failed workers and recent queue state; each enquiry also shows save failure.

## Activation and deployment — instructions only, not performed

1. Independent Work acceptance below; separate explicit deployment authorization.
2. Verify current production/source, ownership, backups and unchanged private enquiries
   #52/#56 without copying client values into evidence. Keep all new enquiries too.
3. Deploy reviewed code with transport disabled. Validate WordPress and form in an existing
   isolated clone. Never point the old MyHome deploy workflow at this theme.
4. Choose/approve a worker OS identity and least-privilege access; no account is created
   by this PR. `malendo-notifications` in the example service is a placeholder requiring
   review, not an assertion that this user exists. Do not share a credential with web PHP.
5. Under separate owner OAuth authorization, use the existing Malendo project, send-only
   scope and verified sender. Resolve verification/exemption and token lifetime gates.
   Store credentials outside webroot/Git; verify 0600 ownership. No Windows-profile binding.
6. For activation, configure `MALENDO_WORDPRESS_ROOT`, `MALENDO_NOTIFICATION_LOCK`; obtain
   the current maximum post ID, then explicitly run `worker.php --activate-after-id=N`.
   A mismatch, ID below 56 or existing activation refuses the operation. This command
   writes a single new activation option and never sends mail. It is NOT run in this PR.
   New submissions capture that generation before insertion; in-flight older requests
   remain excluded. IDs 52/56 and all IDs at or below the boundary are excluded permanently.
7. Review/copy the service and timer examples only with separate authorization. The
   timer is needed because WP cron is disabled. Do not install it during development.
   Enable transport only after an independently approved test-send and receiving evidence.

QA is an explicit submission marker, independent of analytics consent. QA submissions
remain saved but never enter this queue. Denying analytics does not disable notifications.
Do not reset activation or remove terminal markers on upgrade/rollback. `unknown_delivery`
requires checking actual receipt outside this send-only worker and a separate decision;
there is intentionally no automatic replay button or CLI reset command.

## Author verification and independent acceptance

The author harness uses synthetic WordPress functions and a parameter-checking wpdb fake;
real parallel PHP children use a shared file CAS store. This proves state-machine fencing
and process recovery, not actual MySQL locking or full WordPress integration. Tests execute
PHP 8.3 in a temporary directory on the existing Malendo host, in a new network namespace,
with PHP `open_basedir` restricted to that directory and network/shell functions disabled.
No production bootstrap, DB socket, external requests, new DB or installed service.
First-run 40/43 results are preserved; minimal PHP lacked ctype. Retry parsing now uses
PCRE; the next run passed 48/48 before the additional permission/ambiguous-response tests.
See `scripts/malendo-notifications/evidence/QA_RESULT.json` for the final tested hashes/counts.

To reproduce on the existing isolated Linux test environment, copy only the theme and
notification scripts, create a disposable fixture directory and run:

```sh
export MALENDO_TEST_TMP=/absolute/disposable/fixture-directory
php -n -d extension=posix scripts/malendo-notifications/tests.php
node scripts/malendo-notifications/analytics-tests.mjs
php -n scripts/malendo-notifications/worker.php --run  # env unset: disabled, no WP bootstrap
```

Also lint all PHP files. Keep the tests offline using the existing isolated network.
The Node VM harness executes unchanged analytics source with mock DOM/events and no
browser/network. PHP exercises actual form and analytics callbacks, save fault injection,
one receipt claim, consent/QA/admin exclusions, retries, two workers and crash recovery.

Work must independently check in the existing isolated WordPress/MariaDB clone:

- Native meta slashing/readback, each failed field/marker write and intact partial records;
  correct activation boundary, QA and historical records excluded, no false success/receipt.
- Stock options unique index, binary CAS under the real collation, autoload disabled,
  JSON_EXTRACT query support, persistent object cache, due-row fairness and duplicate hooks.
- Two real workers, flock, SIGTERM, death before send/after acceptance/before outcome commit,
  reconciliation and manual handling of unknown delivery. Accepted/unknown survive rollback.
- Admin authorization, diagnostic/heartbeat visibility, query failure and missing dependencies.
- Mock Gmail endpoint/HTTP boundary, scopes/mailbox binding, TLS/redirect/response bounds,
  cURL pre-connect versus ambiguous upload failure, permissions on credential file and timer.
- Native form/GA4 browser regression with network capture blocked from real Google collection.
  Actual OAuth/sending is NOT RUN and requires a separate authorized stage.

## Rollback

Stop/disable only the future timer and transport first; preserve all jobs, activation,
completion markers, accepted/unknown results and every enquiry. Revert the two modified
theme files and remove the notifications include/file together to accepted baseline SHA.
Never restore an old DB or delete the queue. On reinstallation reuse the generation and
terminal markers; baseline-era unmarked submissions must not become automatic backfill.
Before merge this Draft PR can simply be closed: production needs no rollback.

## Primary API references

- [Gmail send and mailbox userId](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/send)
- [Gmail error/retry semantics](https://developers.google.com/workspace/gmail/api/guides/handle-errors)
- [OAuth refresh and granted scopes](https://developers.google.com/identity/protocols/oauth2/web-server)

Original owner handoff: sections 4 and 6B–6E of the 2026-11-04 Malendo P0 Leads + GA4
document. No notification implementation here is permission to merge, deploy or send.
