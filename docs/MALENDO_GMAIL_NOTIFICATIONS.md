# Gmail notifications — development candidate, transport disabled

Stacked Draft PR: HEAD `codex/malendo-gmail-notifications`, BASE
`codex/malendo-lead-notifications`, accepted base
`89f0cce42817437b58293ad52d2616b1e6741261`. Do not add these changes to PR #46.
The existing workflow has no PR trigger and deploys only legacy-theme/workflow changes
on main or explicit dispatch. This change touches neither; do not run it.

## Revision 3 · read-only acceptance handoff

Review the single child commit of `449a2da457f821af07395051a79acfcd3053fe52`.
The parent reproduced both failures under the new tests. [Test evidence](../scripts/malendo-notifications/evidence/revision-3.json).

| Ordered scenario | Required observations |
|---|---|
| Pause the form after preparing its marker. Run a healthy worker before each of the form's two failing reads. Run three further workers after the form error. | All fields remain private. No success receipt. One owner-visible `needs_review` job. Zero send POSTs throughout. |
| For seven worker cycles return 401 to the first POST, then fail the eligibility SELECT before the refreshed send. | Five send POSTs total. Persisted attempts by cycle: 1, 2, 3, 4, 5, 5, 5. Terminal `failed / attempt_limit`. Also exercise the WP adapter with a competing worker. |
| Stop the form before the confirmation INSERT, or immediately after it but before the saved hook. | Before: no send and the owner metabox reports unverified preparation. After: reconciliation creates one job and only one POST across restarts. |
| Lose the confirmation INSERT acknowledgment while a worker accepts the confirmed lead. Also test a rejected write and loss of both write results. | A proven confirmation remains successful. A definitive hold cannot send. If the decision cannot be read, show the visitor a pending message and suppress the success hook. Only a durable matching proof can later recover an automatic notification. |
| Lose the POST reservation acknowledgment or use a legacy marker, legacy job, corrupt counter or mismatched proof. | No blind send. An ambiguous persisted reservation becomes `unknown_delivery` at lease expiry, without replay. |

Rerun the offline commands below on the published HEAD, including the two `p0_` defect reproductions. Inspect the `sending` CAS and the proof read on both admission and pre-POST validation. Native WordPress/MariaDB concurrency, object cache and disconnect/reconnect behavior remain NOT RUN until a separate existing test DB is available. Production, transport activation, OAuth, real forms and mail remain outside this review.

## Revision 2 · read-only acceptance handoff

The review of `65f081b0d8c148dff696871d3f4705fad65475e4` reproduced R1–R5.
On the revised PR head, use the checks below. Run the synthetic suite with a mock transport
and a blocked network. The JSON evidence includes the tested source hashes and individual
outcomes. [Previous independent review](https://chatgpt.com/library?file_id=libfile_b825340b9bcc8191bd53fb4e1442de90&account_id=personal)

| Case | Expected observation |
|---|---|
| R1. Activation cannot be read before insertion | The completed lead gets a durable review marker and a non-dispatchable `needs_review` entry, including after a crash between those writes. Later activation cannot establish the original generation. Confirmed absence still excludes pre-activation submissions. |
| R1. One-off SELECT fails during reconciliation or worker eligibility | The cycle reports failure. Once reads recover, a valid marked lead reaches one job. The error consumes no send attempt when validation failed before POST. Verify missing/corrupt markers separately. |
| R2. Gmail returns HTTP 403 | Only whitelisted rate-limit reasons receive bounded backoff with Retry-After. Permission failures require attention; unknown or mixed unrecognized reasons stop with a safe code. |
| R3. The mock accepts the first POST, then returns HTTP 503/backendError | State becomes `unknown_delivery`. Subsequent runs after both the lease and retry windows produce zero further POSTs. |
| R4. Fail writes of name, email, phone and message separately | The record survives. There is no success hook or notification. Check PHP logs, stderr and diagnostic buffers for the canaries. Error mode returns to its previous value even on exception. |
| R5. Owner, another administrator, a regular user and missing configuration | Only the configured owner with `manage_options` can see the page and metabox. Invoke the captured callbacks directly under a different identity as well as testing menu registration. |

## Changed behavior

`inc-leads.php` reads back every required meta field (including existence of empty
optional contact fields and the consent timestamp), private status and post type before
success or the existing saved hook. Consent must be the form's exact `yes` value;
nonempty strings such as `no` and array values are refused. Meta writes use `wp_slash` to preserve backslashes.
A false `update_post_meta` return is not itself a failure: unchanged values are valid.
On incomplete persistence, keep the partial record, record a safe error code, return the
existing server-error response, and do not call the analytics/notification hook.
The private-field batch temporarily suppresses the core wpdb SQL error output and restores
the prior mode in `finally`. Only diagnostics captured within this batch are discarded.
The safe error log contains the enquiry ID. Verification reads the private post, all
required fields and completion marker with checked SQL snapshots. A submit-side one-off
read failure can repeat a SELECT without repeating the insertion or saved hook.

A new `_malendo_saved_v1` marker is explicitly **prepared**. It captures the complete
field hash, activation generation, QA flag, time, service and a per-preparation nonce.
After reading the fields and marker back together, the form publishes their proof by a
single insert into the unique, non-autoloaded option `malendo_confirm_v3_<ID>` containing
the SHA-256 of those exact marker bytes. The prepared marker records intent and never
contains the old worker’s eligible=true permission. A marker by itself cannot authorize a send.
The form never promotes another request's existing preparation. A previously confirmed
save can be checked idempotently. A crash after confirmation but before enqueue is
recovered from the proof. A preparation left by a crash is visible on the owner metabox.

On an uncertain confirmation INSERT, a competing insert of `hold` fences a late write.
Exactly one value can win. A matching proof means success, a definitive hold means
manual review. If neither outcome is observable, keep the stored fields, show a
pending response and avoid firing a success hook. Reconciliation and pre-POST
eligibility both require a matching proof, intact fields and the original generation.
QA, historical IDs and pre-activation records are excluded. Unknown activation
never acquires a generation later. Legacy markers carry no proof.

`inc-notifications.php` adds one unique `options.option_name` per ID/version with
`autoload=no`. Reads bypass WordPress option caches; transitions compare the complete
previous JSON with `BINARY` equality. A new random revision fences stale workers. The
stock unique `option_name` index must exist. There are no new tables or databases.

States: `pending`, `claimed` (pre-send), `sending`, `retry`, `accepted`, `failed`,
`needs_reauth`, `needs_review`, `unknown_delivery`. Each row has attempts, due time, a 180-second lease,
safe status/error code, optional Gmail message ID and up to 20 UTC/Bangkok log entries.
No headers, credentials, MIME body, names, contact fields or free-form API errors are logged.

Before every messages.send POST, including a 401 refresh attempt, one fenced transition
reserves the next persistent attempt and changes the state to `sending`. Expired `claimed`
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

Five send POST reservations maximum per job. A pre-send DB read consumes none.
A rejected 401 consumes one and is never refunded. Legacy pending jobs without a
trusted counter protocol require manual review. Pre-send token failures have a separate
five-failure bound. A confirmed 429, a 403 containing only rateLimitExceeded or
userRateLimitExceeded reasons, or a proven DNS/connect failure before upload uses exponential
backoff (60 seconds doubling plus 0–30 seconds jitter), respecting Retry-After. Delays over
one day require review. OAuth failures before sending can safely retry. One 401 allows one
refresh; repeated 401, known permission reasons, invalid_grant or invalid scope stop for
reauthorization. Unknown 403 reasons stop for inspection. A 503 from messages.send always
becomes unknown_delivery, even with a structured backendError body or Retry-After.
Malformed success, ambiguous network results, other ambiguous 5xx responses and crashes
in the sending phase also become unknown delivery. A conservative stop can leave a message unsent; owner review is
safer than a duplicate. No send-only API is used to read the mailbox for reconciliation.

CLI runs at most 10 jobs, stops starting work after 40 seconds, and finishes the in-flight
bounded job. An individual job may use up to four 20-second HTTP calls. The example service
allows 150 seconds; a killed worker leaves persisted state for safe recovery. The shared
flock prevents concurrent CLI invocations; SQL CAS additionally protects the queue itself.
No global WP cron processing. A heartbeat and owner-only Enquiries → Notifications screen
show stale/failed workers and recent queue state; each enquiry also shows save failure.

For owner diagnostics the web PHP environment must provide `MALENDO_NOTIFICATION_OWNER_ID`
as the positive decimal ID of the existing owner account, outside Git. The account must
also have `manage_options`. Missing, malformed or mismatched settings hide the menu and
metabox and block direct callbacks. No user or capability change is needed. Only the owner
may inspect `needs_review` and `unknown_delivery` rows. Compare the ID/time with the
private enquiry; for an uncertain send verify receipt manually with the recipient. The
worker never reads a mailbox or automatically resends these states. Use Older entries to
inspect jobs beyond the first 100.

## Activation and deployment — instructions only, not performed

1. Independent Work acceptance below; separate explicit deployment authorization.
2. Verify current production/source, ownership, backups and unchanged private enquiries
   #52/#56/#57 without copying client values into evidence. Keep all new enquiries too.
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
   A mismatch, ID below 57 or existing activation refuses the operation. This command
   writes a single new activation option and never sends mail. It is NOT run in this PR.
   New submissions capture that generation before insertion; in-flight older requests
   remain excluded. IDs 52/56/57 and all IDs at or below the boundary are excluded permanently.
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
Revision 1's 56/56 runtime evidence remains in php-run-04.json. Revision 2 replaces the
old 503 retry expectation, preserves the rest of that coverage, and replays R1–R5.
See `scripts/malendo-notifications/evidence/QA_RESULT.json` for the final tested hashes/counts.

To reproduce on the existing isolated Linux test environment, copy only the theme and
notification scripts, create a disposable fixture directory and run:

```sh
export MALENDO_TEST_TMP=/absolute/disposable/fixture-directory
# Optional: point MALENDO_TEST_WPDB_CORE at an isolated copy of core class-wpdb.php
# to exercise the real print_error implementation without WP bootstrap or a DB connection.
php -n -d extension=posix scripts/malendo-notifications/tests.php
node scripts/malendo-notifications/analytics-tests.mjs
php -n scripts/malendo-notifications/worker.php --run  # env unset: disabled, no WP bootstrap
```

Also lint all PHP files. Keep the tests offline using the existing isolated network.
The Node VM harness executes unchanged analytics source with mock DOM/events and no
browser/network. PHP exercises actual form and analytics callbacks, save fault injection,
one receipt claim, consent/QA/admin exclusions, retries, two workers and crash recovery.

The current restore directories have no independent running WordPress/MariaDB database.
Native integration remains NOT RUN. Only when an existing isolated clone is available,
independent Work can check:

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

Stop/disable only the future timer and transport first. Preserve all jobs, activation,
prepared markers, confirmation/hold options, accepted/unknown results and every enquiry.
Do not run an older notifications worker against Revision 3 data: it cannot interpret its proof gate. Revert the two modified
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
