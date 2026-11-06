# Inbox and notification delivery recovery

**Статус:** living · ops module (D4 extract).  
**Канон для consumers:** якоря `### Recovering …` остаются в [`docs/OPERATIONS.md`](../OPERATIONS.md); полный текст — здесь.

См. [README](README.md).

### Recovering report inbox delivery

New generic and community reports persist a `report_notification_deliveries` row
with the report and creation audit. Migration 0079 does not backfill historical
reports. The existing push worker processes one page of at most twenty recipients
per loop, including when VAPID is absent. It considers accounts created by the
event timestamp and checks their current moderator/admin role on each page.
The audience is not a historical role snapshot: later promotions behind the
saved cursor do not replay old reports. Generic notices link to `/admin`;
community notices link to their case. Notifications contain no complaint text.

Inbox insertion and the recipient cursor commit together. The job lock uses
`SKIP LOCKED`; recipient locks use `NOWAIT` so a locked account retries the whole
page instead of silently skipping a recipient. A process interruption rolls back
the current page. Retry does not duplicate notices or reset their read state.
Five consecutive failed pages stop automatic retries; a successful page resets
that failure counter. Retry delays are 5, 10, 20 and 40 seconds.

Inspect the same aggregate worker probe used for push:

```sh
node scripts/check-web-push-worker-queue.mjs
```

`reportPending`, `reportFailed` and `reportOldestAgeSeconds` describe unfinished
inbox fanout. `report_delivery_failed` and `report_delivery_backlog` produce alert
exit code 2 while process liveness remains a separate check. Backlog uses the
existing due-job and age thresholds. Logs contain counts and states only.

After diagnosing the database/lock failure, list exhausted sources and reset
**one** verified id on the intended database (retains cursor). Prefer the
operator CLI over ad-hoc SQL:

```sh
pnpm notifications:delivery list --channel report
NEXUS_NOTIFICATION_DELIVERY_RESET_ACK=YES pnpm notifications:delivery reset \
  --channel report --id rpt_REPLACE_WITH_VERIFIED_ID
```

Equivalent SQL (same predicates the CLI enforces):

```sql
SELECT report_id, attempts, available_at
FROM report_notification_deliveries
WHERE completed_at IS NULL AND attempts = 5
ORDER BY available_at, report_id
LIMIT 20;

UPDATE report_notification_deliveries
SET attempts = 0, available_at = clock_timestamp()
WHERE report_id = 'rpt_REPLACE_WITH_VERIFIED_ID'
  AND attempts = 5 AND completed_at IS NULL
RETURNING report_id;
```

Do not reset every source or delete inbox rows. The CLI never offers a bulk reset. Optional push admission can still
return `saturated`/`error`; the page logs `pushDeferred`, retains the inbox and
leaves durable admission recovery intent described below.
Completion of report fanout confirms inbox processing, not external push delivery.

### Recovering support moderator inbox delivery

New support cases and requester replies commit a `support_notification_deliveries`
row with the message and audit. Migration 0081 does not backfill historical cases.
The push worker processes at most twenty current moderators/admins per page,
including without VAPID. Accounts must predate the event; later promotions behind
the cursor do not replay it. Notices contain generic text and link to the support
list, without case IDs, requester identity, subjects or message text. Pages and
cursor updates commit together; retries preserve inbox read state. Five consecutive
failures stop automatic attempts, with 5, 10, 20 and 40 second retry delays.

The queue probe reports `supportPending`, `supportFailed`,
`supportOldestAgeSeconds`, and alerts `support_delivery_failed` or
`support_delivery_backlog`. After resolving the cause, inspect and reset one
verified failed message on the intended database:

```sh
pnpm notifications:delivery list --channel support
NEXUS_NOTIFICATION_DELIVERY_RESET_ACK=YES pnpm notifications:delivery reset \
  --channel support --id REPLACE_WITH_VERIFIED_MESSAGE_ID
```

Do not reset all jobs or delete inbox records. Inbox delivery does not guarantee
external push delivery; optional push admission has its own recovery below.

### Recovering verification moderator inbox delivery

New verification applications and server-claim proofs commit a
`verification_notification_deliveries` row with the request and audit.
Migration 0082 does not backfill historical requests. The push worker pages at
most twenty current moderators/admins, including without VAPID. Accounts must
predate the event; current role is rechecked on each page. Notices use generic
copy and link to the pending verification queue without target IDs, notes or
server names. Retry and operator reset match the support/report pattern.

The queue probe reports `verificationPending`, `verificationFailed`,
`verificationOldestAgeSeconds`, and alerts `verification_delivery_failed` or
`verification_delivery_backlog`. After resolving the cause, reset one verified
failed request on the intended database:

```sh
pnpm notifications:delivery list --channel verification
NEXUS_NOTIFICATION_DELIVERY_RESET_ACK=YES pnpm notifications:delivery reset \
  --channel verification --id REPLACE_WITH_VERIFIED_REQUEST_ID
```

Do not reset all jobs or delete inbox records.

### Recovering optional push admission

Migration 0080 adds `web_push_admission_recovery` without backfilling old inbox
rows. New ordinary inbox producers, including report outcomes, build reviews,
resource releases, support requester activity, verification resolutions and
moderation notices, write intent for degraded admission in the same transaction
as the inbox. An intent storage failure rolls back the source transaction.
Optional enqueue errors roll back only their savepoint. Successful recovery or
confirmed absence of eligible devices consumes intent atomically with any outbox
jobs. Initial successful admission needs no recovery row.

The existing worker examines at most twenty candidates and admits at most one
notification per loop, including without VAPID. It locks preferences before the
notification and intent, matching producers; account/notification lock contention
defers that intent for five seconds without consuming a retry. Other candidates
can advance, including when one locked account fills the entire discovery page.
Unread state and current category preferences are checked again. Recovery only
uses still-valid sessions and devices enrolled by the original inbox timestamp;
it never extends the original 24-hour deadline or enrolls a later device. Read,
suppressed, expired or deleted notices do not gain push jobs. Inbox data and read
state are preserved. This checks device eligibility and preferences, not renewed
authorization to the source object or staff role; source producers retain that
responsibility.

Saturation and queue errors retry after 5, 10, 20 and 40 seconds; the fifth failure
stops automatic admission. The queue probe reports `admissionPending`,
`admissionFailed`, `admissionOldestAgeSeconds` and alert reasons
`admission_recovery_failed`/`admission_recovery_backlog`. Alerts exit with code 2;
worker liveness is separate. Logs contain aggregate states/counts only. Expired
intents, including exhausted ones, are removed in bounded worker passes.

After diagnosing the cause, inspect exhausted intents and reset only one verified
unexpired notification on the intended database:

```sh
pnpm notifications:delivery list --channel admission
NEXUS_NOTIFICATION_DELIVERY_RESET_ACK=YES pnpm notifications:delivery reset \
  --channel admission --id ntf_REPLACE_WITH_VERIFIED_ID
```

The CLI enforces `attempts = 5` and `created_at` within 24 hours. Never synthesize
intents for historical or already accepted notifications. After
an admission succeeds, sender cleanup of outbox rows must not cause another
admission. Discussion replies use their existing typed receipt and explicit
`--repair-push` replay below. Admission recovery cannot create an inbox that was
lost before it was stored. Report, support, verification, discussion, and
server-publication fanout use transactional delivery sources; new user-follow
notices commit inbox rows in the follow transaction. HTTP notification paths do
not use Next.js `after()`. Historical discussion comments from before migration
0083 and publications from before 0084 are not backfilled. External push delivery
retains the existing lease, retry and provider guarantees and is not exactly-once.

### Recovering discussion moderator-style delivery jobs

New article comments commit a `discussion_notification_deliveries` row with the
comment and audit. Migration 0083 does not backfill historical comments. The push
worker first delivers direct participants, then pages followers who predate the
comment, rechecking publication, follow and preference eligibility on each write.
Notices stay generic and never include comment text. Retry and operator reset match
the support/report pattern.

The queue probe reports `discussionPending`, `discussionFailed`,
`discussionOldestAgeSeconds`, and alerts `discussion_delivery_failed` or
`discussion_delivery_backlog`. Server-linked publishes likewise enqueue
`publication_notification_deliveries` (newest followers first, capped at 100) with
`publicationPending` / `publicationFailed` probe fields and alerts
`publication_delivery_failed` or `publication_delivery_backlog`. After resolving the cause,
reset one verified failed comment or publication content id:

```sh
pnpm notifications:delivery list --channel discussion
NEXUS_NOTIFICATION_DELIVERY_RESET_ACK=YES pnpm notifications:delivery reset \
  --channel discussion --id REPLACE_WITH_VERIFIED_COMMENT_ID

pnpm notifications:delivery list --channel publication
NEXUS_NOTIFICATION_DELIVERY_RESET_ACK=YES pnpm notifications:delivery reset \
  --channel publication --id REPLACE_WITH_VERIFIED_CONTENT_ID
```

Do not reset all jobs or delete inbox records.

### Recovering build-incident downloader notices (SEC-002)

Quarantine alone stops new downloads. Moderators may also opt in to notify users
who already have a **served** `resource_delivery_receipts` row for that build.
The durable source is `build_incident_notification_deliveries` (migration 0085);
historical quarantines are not backfilled. The queue probe reports
`buildIncidentPending`, `buildIncidentFailed`, `buildIncidentOldestAgeSeconds`, and
alerts `build_incident_delivery_failed` or `build_incident_delivery_backlog`. Notices
are generic security inbox items linking to `/security` and never invent malware details.

```sh
pnpm notifications:delivery list --channel build_incident
NEXUS_NOTIFICATION_DELIVERY_RESET_ACK=YES pnpm notifications:delivery reset \
  --channel build_incident --id REPLACE_WITH_VERIFIED_BUILD_ID
```

Do not reset all jobs or delete inbox records.

### Recovering discussion inbox delivery

For comments created before migration 0083, or windows where delivery jobs were
never enqueued, use the addressed replay CLI. Run from the repository with the
target database environment loaded:

```sh
pnpm --filter @nexus/web notifications:replay /durable/checkpoints/discussions.json 2026-10-12T00:00:00.000000Z 2026-10-12T06:00:00.000000Z 100
```

The directory must exist on a durable local POSIX filesystem supporting file and
directory fsync and atomic rename. Both inclusive boundaries use UTC with six
fractional digits. Choose a window covering interrupted comment requests.
The ending boundary must be at or before PostgreSQL's current statement time, checked
at startup before opening any checkpoint and again before each pass. A future window
is rejected even if its saved checkpoint says completed. This uses exact microseconds,
not the host's millisecond clock. The window does not freeze later/backdated commits:
for delayed writes use a new overlapping completed-time window and inbox deduplication.
Re-run the same command/checkpoint until `completed` is true. Each pass handles at most
the requested number of comments (1–10000), in database pages of at most fifty
rows. A delivery step handles one follower page (fifty recipients) plus up to two
direct participants, checked again on every step. A partial event ends the pass
before the comment budget is reached. Pass logs include elapsed milliseconds and
numeric deliverySteps/attempted/stored/suppressed/duplicate/skipped/failed/pushQueued/
pushDegraded counters, never comment text, database URLs or recipient identities.
Counters reset per pass and count actual attempts: repeated direct recipients are
included again, and an unavailable event can increment skipped without an attempt.
They describe this pass, not unique recipients or guaranteed push delivery.

New files use a version-2 envelope containing a database-scope hash and the existing
version-1 window/cursor state. The fixed window, last fully delivered comment's
exact timestamp/ID and optional current comment/follower-page progress are retained.
Progress advances only after
successful inbox delivery; failure exits a one-shot run with status 1. Restart or
checkpoint-write failure repeats the uncheckpointed audience page. Existing inbox
idempotency prevents duplicate notices and preserves read state. Current publication,
subscription and preference checks still apply; unavailable targets are skipped.
This recovers delivery under current eligibility, not historical consent.

Checkpoint reads are bounded to 4 KiB and reject malformed, foreign-window,
non-regular and symlink files before delivery. Saves validate the checkpoint,
create an exclusive random temporary file with mode 0600, flush its data, atomically
replace the checkpoint and fsync the parent directory before acknowledging progress.
Handled failures clean up temporary files and release the owned lock; failure after
rename can leave a complete newer checkpoint, which restart validates and reuses.
An abrupt process/host failure can leave a harmless temporary file. Keep the directory
private and use a separate checkpoint per database/window. The scope hash binds the
configured hostname/port to the actual current_database name/OID and resolved
comments/follows relation OIDs. Metadata is read using ordinary PostgreSQL catalog
access before opening the checkpoint and before each delivery pass. Missing tables
or a changed scope stop delivery; credential/TLS rotations alone do not change it.
No connection credentials or raw database metadata are written to the file or logs.
This protects accidental scope reuse, not cryptographic identification of a database
cluster; an endpoint routed to another cluster with matching catalog identities may
not be distinguishable. Endpoint aliases and recreated tables require a new checkpoint.
Use a stable endpoint and restart recovery after maintenance; existing inbox deduplication
allows replaying the fixed window into a new checkpoint without resetting read state.

Older standalone version-1 files lack scope evidence. By default they are rejected
without changing the file or delivering notices. After verifying the original database,
run the same command once with `--adopt-legacy` to bind and atomically replace the file:

```sh
pnpm --filter @nexus/web notifications:replay /durable/checkpoints/discussions.json 2026-10-12T00:00:00.000000Z 2026-10-12T06:00:00.000000Z 100 --adopt-legacy
```

Adoption retains exact progress, including completion and pending audience state.
The flag never bypasses a mismatched/damaged version-2 file. Later runs do not need it.
`--worker` and `--adopt-legacy` may appear in either order after the optional budget;
omitted budget defaults to 100. Duplicate/unknown flags and ambiguous numeric budgets
are rejected. Saves reject concurrent writes, backwards event/audience progress and
changing a completed cursor; identical retries and advancing past deleted events remain
valid. A failed write does not acknowledge in-memory progress.

Exclusive `.lock` creation serializes workers, including symlink aliases of the
parent directory. Its private metadata records process ID, hostname and window to
aid inspection; those fields do not prove that a process is alive. A hard termination
can leave the lock. Remove it only after verifying the prior worker has stopped on
the recorded host; never automatically reclaim it based on age or PID alone. Do not
remove the checkpoint to retry a delivery failure.

Append `--worker` after the comment budget to drain the same fixed window:

```sh
pnpm --filter @nexus/web notifications:replay /durable/checkpoints/discussions.json 2026-10-12T00:00:00.000000Z 2026-10-12T06:00:00.000000Z 100 --worker
```

Successful incomplete passes wait one second. Explicit blocked delivery outcomes and
recognized temporary database/network errors retry with exponential backoff from one
second to one minute; success resets backoff. Driver/Drizzle cause wrappers are inspected
without printing their messages. Serialization/deadlock/lock/timeout, temporary server
capacity/restart and connection failures are retryable. Thrown authentication, missing table or
column, permission, unknown invariant and filesystem/checkpoint failures stop with
status 1; a changed scope or regressed database clock also stops before another page.
Inspect and fix those failures before restarting; the existing checkpoint is retained.
The worker exits after completion. SIGTERM/SIGINT interrupt waits and stop after the
active follower page is saved; allow shutdown time for that page and its direct
participants. A persistent failed event intentionally blocks later comments.
Launch from a service manager with database environment and durable storage.

This command recovers inbox fan-out. It neither discovers new windows nor enqueues
a transactional fan-out outbox alongside comment writes. Persisted push jobs retain
their existing push worker; push queue degradation does not block inbox progress and
ordinary duplicate inbox replay does not repair missing push jobs. Use the explicit
pending-push recovery mode below for new proven failures. Continuous database-backed
recovery/leases remain coordinated follow-up work with the schema
owner. Live PostgreSQL and actual power-loss/filesystem acceptance remain separate
checks from local fault-injection tests.

#### Previewing a discussion recovery window

Append `--dry-run` to the same command; a checkpoint argument is still required for
consistent CLI syntax but its path is neither read, validated, locked nor created:

```sh
pnpm --filter @nexus/web notifications:replay /durable/checkpoints/discussions.json 2026-10-12T00:00:00.000000Z 2026-10-12T06:00:00.000000Z 100 --dry-run
pnpm --filter @nexus/web notifications:replay /durable/checkpoints/discussion-push.json 2026-10-12T00:00:00.000000Z 2026-10-12T06:00:00.000000Z 100 --repair-push --dry-run
```

Preview checks the selected delivery-policy relation scope and closed window, then
uses the delivery source query in one `repeatable read`, `read only` transaction.
It fetches at most budget + 1 rows and returns only window/server timestamps, policy,
budget, `matchingComments`, `hasMore`, `dryRun: true` and `checkpoint: "ignored"`.
`matchingComments` is capped at the budget; `hasMore: true` means additional matching
source rows exist, not a full count. No recipient/source IDs, text or connection values
are printed. `--worker` and `--adopt-legacy` are incompatible with preview.

This reports the whole requested source window, including already delivered or now
ineligible comments, independently of checkpoint progress. It does not inspect follower
eligibility, pending receipts or devices and cannot estimate notices/push jobs or promise
delivery. Notification dispatch, queue admission and checkpoint writes are never called.
Run the regular command separately after inspecting the preview; it rechecks scope/time
and current eligibility. Query plans, live read-only execution and database clocks still
require the disposable PostgreSQL verification gate.

#### Recovering proven missing discussion push jobs

New discussion notifications record a private, typed `discussion_push` admission
receipt in their existing JSON data. `pending` means optional enqueue never committed;
`queued` means queue admission and its receipt committed in one savepoint; `unavailable`
means there was no eligible device. A queue/proof failure rolls that savepoint back
while retaining the inbox row and pending receipt. This is queue evidence, not proof
of provider delivery. Ordinary notification categories keep their existing semantics.

To recover missing queue admission, choose the interrupted reply window and a **new**
checkpoint, then enable the explicit mode:

```sh
pnpm --filter @nexus/web notifications:replay /durable/checkpoints/discussion-push.json 2026-10-13T00:00:00.000000Z 2026-10-13T06:00:00.000000Z 100 --repair-push --worker
```

The recovery dispatcher rechecks current publication/comment availability, event-time
follows/direct participation and preferences before locking the original notification.
Only unread, unexpired notices with exact pending evidence and their original eligible
category may be repaired. It changes no inbox text/link/category/read state. Unknown or
legacy evidence is skipped because a missing physical job may already have been sent.
Queued/unavailable receipts never reopen; deletion after provider acceptance cannot
cause another enqueue. Existing jobs remain owned by the push worker.

Recovery selects at most 64 currently valid devices created no later than the original
notification's database timestamp. It retains session/subscription expiry checks,
serialized queue capacity and the notification/subscription unique key. Repaired jobs
expire at the original timestamp plus 24 hours, with no extension after delays. Devices
registered later are excluded. No eligible device settles the receipt as unavailable.
Read/expired notices and revoked preferences/source rights cannot create a repair job.
These are enqueue-time checks; provider acceptance and later read/preference changes
retain the existing push worker's behavior.

Repair-mode saturation or optional queue/proof errors increment `pushPending` and block
the audience-page checkpoint even when inbox delivery already succeeded. The worker
retries from that page with its existing backoff; normal inbox mode remains non-blocking
for degraded push. Push counters report admissions, never guaranteed browser delivery.
The checkpoint policy and database fingerprint include this mode and all six push-related
relations. Inbox checkpoints and legacy adoption cannot be used to skip repair work;
resume a repair-mode file with the same flag. Schema/table recreation changes its scope.
There is no automatic background discovery, global pending-notice scan or legacy backfill.
No database migration is required: the existing JSON column gains a typed receipt only.

#### Dedicated real PostgreSQL recovery verification

`.github/workflows/discussion-recovery.yml` runs the seven real database suites for
discussion subscriptions/replay, preference serialization, outbox admission/capacity
and push worker leases/concurrency against a fresh PostgreSQL 18 service. It runs on
relevant `main` pushes and supports manual dispatch; code publication for this gate
must omit `[skip ci]`. The job uses fixture-only credentials, read-only repository
permissions and a ten-minute timeout. It deploys no application and contacts no real
push provider. Source-sensitive changes remain covered by the existing full CI too.

The same command is `node scripts/verify-discussion-recovery.mjs`. Create a new empty
loopback database named `mta_nexus_recovery` or `nexus_recovery_` followed by 8–32
lowercase alphanumeric characters, explicitly set its `DATABASE_URL`, `NODE_ENV=test`
and `NEXUS_DISCUSSION_RECOVERY_DB_ACK=disposable`. Use a clean checkout of the intended
commit, with installed workspace dependencies and the pinned Node version. Do not
point it at normal development/production data. The command never drops/recreates a
database: it rejects non-loopback/default/ambiguous names, a mismatched actual database,
non-18 server versions and existing user tables before applying current migrations.

It records the exact commit, Node/server versions, migration digest, current stage and
test counts in `artifacts/discussion-recovery.json`, with the complete Vitest JSON in
`artifacts/discussion-recovery-tests.json`. Environment URLs/credentials are excluded.
Each invocation invalidates older evidence even if environment validation fails.
Passing status requires all seven expected files and every reported assertion to pass;
a missing, stale, skipped or partial report cannot become green. GitHub retains both
artifacts for fourteen days. This verifies SQL/transactions/concurrency in this fixture
scope, not production topology, delivery providers or power-loss behavior.

A workflow conclusion without recorded steps or evidence is **not executed**, rather
than PostgreSQL acceptance. Inspect the job's startup annotation when no log exists;
the available API may not expose that annotation. Do not repeatedly rerun identical
jobs without resolving a startup blocker, and do not mark the database gate green
from successful local mock tests.

Local runtimes mapped only to UID 0 may be unable to start native PostgreSQL. Do not
disable PostgreSQL's root refusal or use production data to work around that condition;
use this disposable CI service or a normal non-root local PostgreSQL installation.

