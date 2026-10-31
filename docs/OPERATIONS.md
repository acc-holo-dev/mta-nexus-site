# MTA NEXUS Operations / Эксплуатация

This document covers development startup, verification and production boundaries.  
Документ описывает запуск разработки, проверки и эксплуатационные ограничения.

## 1. Supported DEV startup

Use the root `compose.yaml` directly when you want a Docker-only startup:

```bash
docker compose -p nexus-local -f compose.yaml up --build --detach --wait --wait-timeout 600
```

When Node.js 26+ and the pinned pnpm are installed, the supported convenience entrypoint is shown below. Host tooling is explicit: `.nvmrc` and `.node-version` pin Node 26.10.0, and `package.json#packageManager` pins pnpm 12.4.2. Use the repository version files before running host-side commands:

```bash
pnpm dev
```

It runs `pnpm dev:preflight` first and then starts the same full Compose development stack. The preflight checks required repository files, Docker/Compose availability, Linux containers, the selected local port and whether `compose.yaml` renders without implicitly importing application secrets.

`pnpm dev:host` is intentionally different: it starts only the Next.js development server. Use it only when PostgreSQL, storage and scanner dependencies are already configured externally.

The stack contains:

- PostgreSQL 18;
- ClamAV;
- the Next.js development container;
- the durable Web Push worker, healthy-idle when the VAPID triplet is absent;
- persistent database, ClamAV and upload volumes.

Only the application port is published to the host and it is bound to loopback. PostgreSQL and ClamAV stay on the Compose network.

Both supported Compose stacks set `CLAMD_CONF_AlertExceedsMax=yes`. ClamAV otherwise treats some files skipped because of archive scan limits as clean. With this setting, NEXUS rejects incomplete scans before storage; deployments that provide their own ClamAV daemon must enable the same `AlertExceedsMax` directive. The build upload route counts streamed multipart bytes, so omitting `Content-Length` does not bypass its request-body limit. The file cap is shared by the API, storage, and browser UI; its multipart headroom is checked against the production proxy limit. If the initial build is rejected, the publishing form keeps the saved draft and retries the build against it instead of creating duplicate resources. If the resource-creation response is lost, retrying the same slug recovers the draft only when its metadata matches and the current author owns it. The retry identity survives a page refresh in the same tab; only the generated resource ID, slug and compatibility version target are stored in session storage. MTA sortable release targets such as `1.6.0-9.22279.0` are accepted consistently for resource compatibility and build metadata; the manifest inspector only copies a minimum into the shared form when its client/server scope is unambiguous, and warns in Russian and English when the declaration is missing, malformed, repeated, or conflicting. Its ACL and export previews show up to 20 manifest declarations as written without judging their policy or security. Run `pnpm test:scanner` to exercise INSTREAM framing, real TCP request/response handling, timeout and response limits, RU/EN resource creation and scan errors, duplicate-slug privacy, draft recovery and retry, scan-limit rejection, multipart size enforcement with and without `Content-Length`, proxy-limit alignment, manifest structure and localized version diagnostics, ACL/export previews, and version suggestions, plus accepted uploads without a running ClamAV database or PostgreSQL.

Source directories are bind-mounted read-only. Next.js uses polling in Docker so edits under `apps/web/src` and workspace `src` directories hot-reload. Package/dependency and image changes still require a rebuild.

Readiness:

```bash
docker compose -p nexus-local -f compose.yaml exec app node scripts/check-local-readiness.mjs
```

`pnpm dev:docker:check` requires both app readiness and push-worker liveness.
The app half checks HTTP health, database reachability and writable private storage;
the worker half validates heartbeat/progress and queue counters. With no VAPID triplet it remains
healthy-idle and performs queue maintenance; with all three VAPID values set it
dispatches durable Web Push jobs.

`pnpm dev:docker:down` (or `docker compose … stop`) sends SIGTERM. App and workers use
`init: true` so the signal reaches the Node process; the push worker gets a 30-second
grace window to finish the current page, emit `stopped`, and remove its health file.
License and resource-release workers do the same cleanup. A fresh heartbeat alone is not
liveness: probes also require recent dispatcher progress (see [Worker liveness vs progress](#worker-liveness-vs-progress)).
App and push-worker keep `restart: "no"` so a crash stays visible; start the stack again
after fixing the cause rather than relying on silent restarts.

### Optional local mail capture

`compose.mailpit.yaml` extends only the development `compose.yaml`. It adds
Mailpit 1.31.4, the existing durable account-mail worker and a one-shot initializer:

```bash
docker compose -p nexus-local -f compose.yaml -f compose.mailpit.yaml up --build --detach --wait --wait-timeout 600
# Or, with host Node/pnpm:
pnpm dev:mail
pnpm dev:mail:check
```

The Mailpit UI is bound to `127.0.0.1:8025`; use `http://localhost:8025`.
`NEXUS_MAILPIT_PORT=8026` changes this host port. `NEXUS_DEV_PORT` changes the app
port and the origin used in recovery links together. Set these variables
consistently for startup, checks and shutdown. SMTP port 1025 stays unpublished.
Relay/forwarding are not configured; even a real recipient address stays in the
local capture box. The app's generic `EMAIL_PROVIDER` remains `disabled`; account
recovery uses its separate encrypted outbox and dedicated worker.

The initializer creates two independent 32-byte keys and a self-signed certificate
for the Docker hostname `mailpit`. Keys persist in `dev_mail` and are never silently
rotated on restart; corrupted keys stop startup. The certificate is renewed near
expiry. App and worker read their keys from files as UID 1000; the worker verifies
the certificate and hostname when connecting with implicit TLS. HTTP recovery
links are allowed only for an explicitly configured `NODE_ENV=development` and
`localhost`, `127.0.0.1` or `::1`; production and other environments still require
HTTPS. This exception changes the link origin, not SMTP TLS verification.

`pnpm dev:mail:check` checks the app, push-worker and mail-worker, then sends a
synthetic message through the actual SMTP transport, verifies its captured body
through the Mailpit API and deletes only that probe. It does not verify the entire
account recovery flow. For that, log into a regular password-based development account without 2FA,
verify its existing email in security settings using the captured link, then
request a password reset and follow the captured reset link.

Mailpit keeps at most 200 messages for 24 hours in its temporary database;
container replacement discards captures. Database outbox data and encryption keys
remain in their named volumes. Do not remove `dev_mail` while keeping queued mail
that you intend to dispatch. `pnpm dev:mail:down` preserves all volumes. Stop with
that command before starting the basic stack again. Use `pnpm dev:mail:logs` for
diagnostics. Production recovery rollout still uses the dedicated production
overlays and operator-supplied secrets, not this initializer or capture server.

The `Local Docker startup` CI job adds this overlay after checking the basic
stack and validates non-root services, port isolation, worker health and SMTP/API
capture. Standalone tooling tests exercise key persistence and a real verified
TLS connection without Docker. These tests do not replace the Compose acceptance.
Mailpit configuration follows the [official Docker](https://mailpit.axllent.org/docs/install/docker/)
and [SMTP TLS documentation](https://mailpit.axllent.org/docs/configuration/smtp/).

## 2. Verification

Run the appropriate scope against a prepared environment. PostgreSQL tests need a disposable database; do not run the full suite against the development database.

```bash
pnpm install --frozen-lockfile
pnpm check:code
pnpm docs:check
pnpm test:isolated  # requires the running Docker development stack
pnpm build
```

`test:isolated` owns a uniquely named database and removes it after success or failure. It never recreates a shared database. For a host-only setup, create a separate database, apply migrations there and set its `DATABASE_URL` before `pnpm test:database`. Product-specific moderation and verification contracts are indexed in the [domain map](handbook/15-AI-CONTEXT-INDEX.md).

### Test and CI scopes

- `pnpm check:code`: formatting, lint, types, package boundaries, unused code, unit and tooling checks; no Docker or PostgreSQL required.
- `pnpm test:unit`: isolated unit/mock suites, at most four parallel workers; no database required. Prints the normal reporter and writes timings/results to ignored `artifacts/unit-tests.json`.
- `pnpm test:database`: real DB/integration suites, sequential files against a disposable PostgreSQL database.
- `pnpm test:tooling`: standalone Node suites. Compose validators that require rendered JSON remain owned by their infrastructure harnesses.
- `pnpm test`: both Vitest projects; `pnpm check` and `pnpm release:verify` retain the full local release path.

CI chooses a scope from the changed-file set (`scripts/ci-policy.mjs`). Unknown or
mixed paths never narrow the gate; they stay on `fast_ci` or escalate to
`full_acceptance`. Local commands stay aligned with those scopes:

| Scope             | When                                                                                                                                                          | CI jobs                                               | Local analogue                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------ |
| `documentation`   | Markdown-only (`README.md`, `docs/**/*.md`)                                                                                                                   | `plan` (doc links)                                    | `node scripts/check-doc-links.mjs`                     |
| `unit_ci`         | Only `packages/ui/**` and/or `apps/web/src/components/**` (plus markdown)                                                                                     | `plan`, `unit`                                        | `pnpm check:code`                                      |
| `fast_ci`         | Other application code that is not infrastructure                                                                                                             | `plan`, `unit`, `verify`, `image`, `smoke`            | `pnpm check:code` then disposable `pnpm test:database` |
| `full_acceptance` | Migrations, Compose/Docker, workflows, lockfiles, security/storage/config, selected trust-boundary repositories, release tags, or workflow_dispatch with full | All CI jobs including browser and production rehearse | `pnpm release:verify` / full isolated acceptance       |

Release tags (`v*`) and explicit full workflow dispatch always run `full_acceptance`.
The CI unit job and host development use the same `check:code` command. It uses
the pinned pnpm's [native script selection](https://pnpm.io/cli/run#running-multiple-scripts),
with an anchored selector for exactly seven scripts. `--sequential` bounds memory;
`--no-bail` lets independent checks finish after an earlier failure and returns a
nonzero result if any check failed. The selected checks are independent of order. Unit
test files still run with four Vitest workers. CI preserves the unit JSON even
when a different check fails; database/build/browser acceptance keep their own jobs.
No additional task runner is installed.

`scripts/test-projects.mjs` uses the existing pinned SWC parser to inspect source
syntax without executing modules. It follows executable imports/re-exports,
CommonJS and TypeScript import-equals edges, plus calls inside template expressions.
Explicit type-only declarations and TypeScript import queries are erased; inline
type specifiers remain conservative because their module can retain side effects.
Zero-argument arrow factories in hoisted `vi.mock` calls cut a mocked import edge,
including Vitest's typed `vi.mock(import("..."), factory)` syntax. Partial/automatic
and runtime mocks, `importActual` and unmock calls retain live edges. Unknown
dynamic targets and unresolved local/workspace imports remain in the DB project;
syntax errors stop classification with the source path. This is a conservative
repository policy, not a whole-program evaluator of arbitrary aliases or control flow.
See [SWC parsing APIs](https://swc.rs/docs/usage/core#parse)
and [Vitest mock semantics](https://vitest.dev/api/vi#vi-mock).

### Automated browser accessibility

All five browser-tool installations in the workflows use
`scripts/browser-toolchain.mjs`. This is the single place to update their
pinned package versions:

| Profile | Tools                                               | Used by                               |
| ------- | --------------------------------------------------- | ------------------------------------- |
| `basic` | Playwright                                          | DEV origin/hydration verification     |
| `a11y`  | Playwright, axe Playwright integration and axe-core | Production smoke and Resource browser |
| `agent` | Playwright and agent-browser                        | Account and Directory browser         |

The installer receives an absolute tool directory, invokes npm directly, and
preserves a failed installation's exit status. Each job still uses its own
temporary tool directory and Chromium installation. The application dependency
graph is unchanged by these profiles. Direct package versions are pinned;
browser-tool transitive dependencies retain npm's normal resolution behavior.

The Chromium acceptance uses `@axe-core/playwright` 4.13.0 and
`axe-core` 4.13.0. Both are pinned in the isolated browser-tools installations for
the smoke and resource-browser jobs; they are not application dependencies.

| Contour                  | Scanned states                                                                                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Production browser smoke | Login, registration and password recovery in RU/EN, light desktop and dark mobile themes; authenticated workspace after registration.                                                      |
| Resource browser         | Open notification and mobile More dialogs in RU/EN; login error, recovery success and authenticated Settings, Security, Support, resource publishing and server claim at 320px and 1280px. |

`scripts/axe-accessibility.mjs` scans the full rendered state after each test's
readiness assertions. It selects WCAG 2 A/AA, 2.1 A/AA and 2.2 AA rule tags and
fails on every returned violation, including contrast. There are no rule disables
or excluded page regions. Existing keyboard, focus, reflow and ARIA-reference
checks remain in the same scenarios.

Every completed scan writes a JSON diagnostic under the job report's `axe/`
directory and attaches it to Playwright. Reports retain rule IDs, impacts, help
links and element selectors, without raw HTML or form values. Incomplete checks
are recorded for review separately from confirmed violations. Passing scans are
retained even though general Playwright output is preserved only for failures.
These checks cover automatically detectable issues in the tested states; keyboard
and assistive-technology assessments remain necessary.

The standalone gate tests verify that a violation blocks acceptance after its
report is saved, incomplete findings stay visible, and engine errors propagate.
They use a browser-adapter fixture and do not claim a real DOM scan. Current
browser execution/hosted-runner limitations are tracked in [PROBLEMS](PROBLEMS.md).
Integration follows the [official Playwright accessibility guide](https://playwright.dev/docs/accessibility-testing)
and [axe Playwright API](https://github.com/dequelabs/axe-core-npm/tree/v4.13.0/packages/playwright).

### Property-based checks

`fast-check` 4.10.2 is a root development dependency and runs through the existing
Vitest unit project. `pnpm test:properties` executes four trusted-proxy/IP
properties, each with 1000 generated cases: mismatched Unicode markers must not
throw, missing/untrusted markers must ignore forwarded IPs, a trusted real IPv4/IPv6
address takes precedence, and an invalid first forwarded hop must not be skipped.

The default seed is `20261009`, keeping CI repeatable. Use another signed 32-bit
seed to explore additional inputs:

```bash
FC_SEED=12345 pnpm test:properties
```

Fast-check reports its seed and shrinks a failure to a smaller counterexample.
The first adoption caught a UTF-8 length error in proxy-marker comparison;
the exact Latin-1 regression is also covered using real Fetch Headers. Invalid
markers return `unknown` before `timingSafeEqual` can throw, while correct
markers still use timing-safe byte comparison. This is a bounded property suite,
not an exhaustive proof of all request handling.
See the [official fast-check building blocks](https://fast-check.dev/docs/core-blocks/)
and [Node timingSafeEqual contract](https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b).

### Code analysis and focused checks

Use `pnpm analyze:architecture` and `pnpm analyze:unused` for dependency boundaries and unused code. Dependency-cruiser currently warns about TypeScript 7 compatibility; do not treat its result as complete without resolving that limitation.

`pnpm test:focus <test-file> ...` runs only named Vitest or `.node-test.mjs` files and classifies only the selected Vitest import graphs. Database tests require a disposable `DATABASE_URL`, applied migrations and `NEXUS_DISPOSABLE_DATABASE=1`. Existing grouped commands include `pnpm test:directory`, `pnpm test:resource`, `pnpm test:scanner`, `pnpm test:catalog` and `pnpm test:reports`. These focused checks do not replace full CI or release acceptance.

`pnpm ci:diagnose --run-id <id>` reads one GitHub Actions run and its annotations. It may require an appropriate read-only GitHub credential. A workflow with zero executed steps is not a successful test.

## 3. Production boundary

Production must use explicit production Compose/configuration, not the local development stack.

Required properties include:

- HTTPS public URL;
- unique strong authentication and proxy secrets;
- persistent private storage;
- TLS-edge security headers: HSTS, frame denial, MIME sniffing protection, strict-origin referrer policy and disabled camera/microphone/geolocation/payment browser capabilities;
- container health that verifies HTTP/database readiness and real read/write access to the mounted private storage before the public proxy depends on the app;
- PostgreSQL backup and restore procedure;
- ClamAV enabled and reachable;
- no development placeholder secrets;
- no public database/ClamAV ports;
- explicit recovery/email configuration before claiming email delivery is operational.

Paid commerce remains disabled.

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
`publicationPending` / `publicationFailed` probe fields. After resolving the cause,
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
historical quarantines are not backfilled. Notices are generic security inbox
items linking to `/security` and never invent malware details.

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

## 4. Backup and recovery

Before a production migration:

1. inventory the existing database and upload storage;
2. take backups;
3. restore them into an isolated environment;
4. run migrations against the restored copy;
5. verify application health and critical user journeys;
6. only then schedule the production change.

Do not delete unknown Docker volumes as a troubleshooting step.

## 5. Resource safety operations

The build safety rule is enforced in repository queries and at the database layer. Migration `0020_build_safety_invariants.sql` deliberately fails closed:

- unsafe legacy `published` builds are retired;
- invalid legacy `clean` verdicts without provenance are reset to `not_scanned`;
- public products without a remaining safe build are returned to `draft`;
- `currentVersion` is realigned to the newest safe published build where one exists.

Review these data-changing effects on an isolated restored backup before applying the migration to any existing production dataset.

## 6. Branch and release operations

The maintained branch is `main`.

A release is not accepted merely because code exists on `main`. Acceptance requires:

- exact-SHA checks executed successfully;
- migration review;
- browser/runtime checks appropriate to the change;
- backup/restore confidence for data-changing releases;
- explicit deployment decision.

Current package version: `1.2.0-beta.3`. Confirm the candidate version in `package.json`; a version string alone does not demonstrate production acceptance.

## Resource integrity rollout and seed recovery

Before applying migration `0024_product_type_invariant`, inspect the type inventory
on the target database and follow the backup/restore procedure above:

```sql
SELECT type, count(*) FROM products GROUP BY type ORDER BY type;
```

The migration normalizes only `tool` to `plugin`. Unknown values must be reviewed
and explicitly corrected by an operator; the constraint intentionally blocks an
unreviewed migration. Run `pnpm db:migrate` before the updated application.

Development baseline commands (shared absolute local storage required):

```bash
docker compose -p nexus-local -f compose.yaml exec app pnpm db:seed
docker compose -p nexus-local -f compose.yaml exec app pnpm db:seed
# Only after inspecting a reported legacy demo metadata mismatch:
docker compose -p nexus-local -f compose.yaml exec app pnpm db:seed:repair
# Optional cleanup for exact old Unsplash/DiceBear values written by the seed:
docker compose -p nexus-local -f compose.yaml exec app pnpm db:seed:repair-media
```

The second normal run should report zero insertions and zero repairs. Changed
passwords, roles, product descriptions and build moderation states stay intact.
Build repair touches only known demo size/hash fields. Media repair clears only
exact legacy demo CDN values; a custom avatar/banner/thumbnail/cover survives.
A conflicting on-disk file is never overwritten; inspect it separately.
Do not use these commands for production data provisioning.

Run the fast regression group with `pnpm test:resource-integrity`. Against an
isolated, migrated PostgreSQL development database, run
`pnpm test:resource-integrity:integration` with its `DATABASE_URL`. The new database
tests use temporary tables; the seed test copies checks/indexes, not foreign keys,
and is not a substitute for the full `pnpm test:isolated` acceptance run.

Finally verify both demo resource claim/download flows through the browser,
compare response length/hash to disk, rerun seed, and confirm account edits remain.
A 409 `BUILD_ARTIFACT_MISMATCH` means storage metadata disagrees with the build;
inspect storage and the build record before retrying. Current acceptance gaps
remain in [PROBLEMS.md](PROBLEMS.md).

### Local archive integrity and immutable keys

Local downloads hash the opened file before responding. Same-size corruption now
returns the same private 409 `BUILD_ARTIFACT_MISMATCH` as a size mismatch, for both
public and reviewer downloads. Hashing uses a 64 KiB buffer but adds a full disk
read per download; include this cost in latency/load acceptance tests.

Uploads atomically publish complete files and refuse an existing storage key.
Do not retry with a reused key or edit published files in place. Publish a new
build/key through the normal upload workflow. Filesystem administrators can still
change an inode after verification; keep application storage private and treat
manual file changes as maintenance requiring verification.

A process crash may leave a UUID-suffixed `.tmp` file. Automatic cleanup covers
handled failures, not process termination. Inspect orphan files before cleanup;
never remove files belonging to an active upload. Filesystems must support hard
links within the storage directory; unsupported publication fails without a
partially published destination.

Cancelled downloads propagate the request signal to storage. Preparation stops
between disk reads; streams and abort listeners are released. A cancellation
before response delivery maps to private 499 `DOWNLOAD_CANCELLED`, without a
server-error log. The disconnected client may never receive this response.
If cancellation races with an audit write, the started event can remain; it must
not be interpreted as a completed download. Include a real network disconnect
during hashing and during response streaming in deployment acceptance checks.

## Production compilation in restricted build environments

The default `pnpm build` uses Next.js Turbopack. Some sandbox environments deny
its internal local port binding while processing CSS (`Operation not permitted`).
When that environment limitation is confirmed, run `pnpm build:webpack` explicitly
with the same production build environment variables. This selects Next.js's
Webpack compiler and produces the configured standalone output. It does not start
a web server or disable application configuration validation.

There is no automatic fallback: a failed default build remains a failed gate.
CI/release verification continues to execute the default build. Record which
compiler was used; a successful Webpack build does not establish Turbopack parity,
service connectivity or runtime/browser acceptance.

Release evidence explicitly records its required gate names. The summary requires
repository identity, evidence harness, database migrations, lint, typecheck, tests
the default Next.js build and final repository stability exactly once each. Missing or duplicate gate records
block release-candidate status even if every recorded command passed. Additional
checks may extend the report; failed or incomplete checks still prevent success.
Repository cleanliness must be explicitly confirmed as false for `dirty`.

After the commands finish, release verification reads HEAD and working-tree status
again. A changed commit, dirty final tree or failed Git read blocks the candidate;
both initial and final identity are recorded without serializing changed paths.
This detects final-state drift, not transient edits that were reverted during the
run. Use an isolated checkout in CI and avoid editing it during verification.

Local container readiness probes the mounted storage directory using the same
hard-link publication primitive as local archive uploads. It verifies that a new
published name is readable, replacement fails with EEXIST, and removing the
staging name preserves the published bytes. Success includes
`publication: "atomic-no-replace"`. Filesystems without hard-link support fail
readiness instead of reporting that uploads are ready based on read/write alone.
Each probe uses and removes only its own unique temporary directory. This does
not prove scanner availability, crash durability or end-to-end HTTP uploads.

Release verification bounds each external gate command to 30 minutes and identity
lookups to 15 seconds. A gate timeout is recorded as failed with `timedOut`,
`timeoutMs` and `ETIMEDOUT`; it cannot produce a release candidate. Verification
continues to collect remaining gate results. The timeout forcibly terminates the
direct child process; it is not a process-tree cleanup guarantee, so CI should
retain its job-level timeout and isolated runner cleanup.

Evidence JSON is serialized before writing, flushed to a private temporary file
on the same filesystem, then published by rename. A serialization or pre-rename
write failure preserves the previous report; normal failures clean only the
current run's temporary directory. Readers see a complete old or new report.
Always verify the report SHA and command exit status: a failed run can leave the
older report in place. Abrupt termination may leave a temporary directory, and
this does not guarantee directory-entry durability after power loss.

The Verify CI job uploads only `artifacts/release-evidence.json` immediately after
release verification, including failed verification runs. Artifact names include
the workflow SHA and attempt; retention is 14 days. If verification ran but no
report exists, upload fails explicitly. Earlier setup failures that skip
verification do not attempt an upload. Runner termination or job cancellation can
still prevent artifact preservation; a downloadable report does not imply passed
gates. Check its repository SHA and summary before using it as release evidence.

The production proxy rejects declared Content-Length above 65 MiB before
upstream handling, including routes that never read request bodies. The existing
request_body limit remains in place for streaming/chunked reads. Production smoke
reports safe phase names and line numbers on failure without shell xtrace or
command text; all browser rehearsals share this production prerequisite.


## Existing-installation release and recovery

This runbook prepares an operator-reviewed Docker deployment. It does not deploy
production, select a target host, or authorize deletion/restoration of its data.
Use the existing production Compose project name and its protected environment
file throughout. Changing the project name during a normal update creates different
volumes and can make an intact installation appear empty.

### Open free beta candidate evidence

ROADMAP 20 prepares a **checkable** free open-beta candidate. It does not open
beta, authorize production deployment, or activate paid marketplace/DRM.

1. Select one exact `main` SHA and wait for `full_acceptance` CI to succeed
   (backup-restore and release-upgrade artifacts are published only when
   `plan.outputs.full=true`; retention is 14 days).
2. On a clean checkout of that SHA run `pnpm beta:fetch` (or
   `pnpm beta:fetch <sha>`). It uses `gh` to download retained
   `ci-evidence-<sha>`, `release-upgrade-<sha>-<attempt>`, and
   `backup-restore-<sha>-<attempt>` into local `artifacts/ci-evidence.json`,
   `artifacts/release-upgrade.json`, and `artifacts/backup-restore-evidence.json`.
   The fetch never invents PASS JSON; missing/expired artifacts fail honestly.
3. Run `pnpm beta:candidate`. ROADMAP 19 backup-restore evidence must report
   `status: "PASS"`, matching SHA, and every disposable-rehearsal flag true
   (`sourceDestroyedBeforeRestore`, checksum/row/schema/ledger/upload restores,
   `cleanupComplete`). Incomplete flags block the candidate—they do not pass.

The report writes `artifacts/beta-candidate-evidence.json`. Interpret it as:

| Field                                    | Meaning                                                                                                                                                                                                                                             |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `checkableCandidate: true`               | Required technical proofs for that SHA passed; only owner deploy authorization remains                                                                                                                                                              |
| `status: awaiting_owner_deploy_decision` | Same as checkable; still not live and not authorized                                                                                                                                                                                                |
| `openBetaLive` / `productionAuthorized`  | Always `false` in this harness                                                                                                                                                                                                                      |
| `technicalBlockers`                      | Named gaps (often missing backup-restore CI evidence for ROADMAP 19)                                                                                                                                                                                |
| `residuals`                              | Optional proofs only: `legal_surfaces` passes from in-repo Terms/Privacy/Community rules (counsel review stays human); `observability` clears only when `artifacts/observability-readiness-evidence.json` validates via `pnpm observability:verify` after `NEXUS_OBSERVABILITY_READY_ACK=YES pnpm observability:ready`; `web_push` still needs both soak + live provider JSON (presence alone never clears) |

`ci-evidence.json` from the CI summary job now includes `requiredJobs` and
`jobResults` so browser/mail/runtime categories can be checked per job.

Legal product surfaces: `pnpm legal:check` (Terms `/terms`, Privacy `/privacy`,
Community rules `/community-rules`, footer links, RU/EN substance). This is not
counsel approval.

Operator observability readiness (alert thresholds + in-repo probes/runbooks):

```bash
NEXUS_OBSERVABILITY_READY_ACK=YES pnpm observability:ready
pnpm observability:verify
```

Optional Web Push residual (both artifacts required; never invent PASS). Soak uses
a fixture sender against a migrated database reachable from the runner (compose
`app`/`push-worker` network is typical when host `localhost:5432` is unpublished).
Provider probe needs a real HTTPS push subscription endpoint + VAPID triplet:

```bash
# Generate a local/dev VAPID triplet (store only in private env; do not commit):
node --input-type=module -e 'import { generateKeyPairSync } from "node:crypto";
const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const pub = publicKey.export({ format: "jwk" });
const priv = privateKey.export({ format: "jwk" });
const b64u = (buf) => Buffer.from(buf).toString("base64url");
const x=Buffer.from(pub.x,"base64url"), y=Buffer.from(pub.y,"base64url");
console.log("WEB_PUSH_VAPID_PUBLIC_KEY="+b64u(Buffer.concat([Buffer.from([0x04]),x,y])));
console.log("WEB_PUSH_VAPID_PRIVATE_KEY="+priv.d);
console.log("WEB_PUSH_VAPID_SUBJECT=mailto:ops@example.invalid");'

NEXUS_WEB_PUSH_SOAK_ACK=YES NEXUS_WEB_PUSH_SOAK_DURATION_MS=60000 pnpm push:soak
pnpm push:soak:verify

NEXUS_WEB_PUSH_PROVIDER_PROBE_ACK=YES \
  NEXUS_WEB_PUSH_PROBE_ENDPOINT='https://…' \
  NEXUS_WEB_PUSH_PROBE_P256DH='…' \
  NEXUS_WEB_PUSH_PROBE_AUTH='…' \
  pnpm push:provider:probe
pnpm push:provider:verify
```

### Acceptance evidence

Select one exact `main` commit and wait for **CI**, **Resource browser**,
**Account browser**, and **Directory browser** to succeed on that commit.
Keep these CI artifacts outside the runner before their 14-day retention expires:

| Evidence                                | What it proves                                                                                                                                                         |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core-release-evidence-<sha>-<attempt>` | Repository identity, migrations, lint, types, tests, default production build                                                                                          |
| `release-upgrade-<sha>-<attempt>`       | Drizzle upgrade from the configured baseline to the current migration target; failed DDL and ledger rollback; retry, idempotency and preservation checks               |
| `backup-restore-<sha>-<attempt>`        | Destroyed synthetic source restored into new owned volumes; schema, migration ledger, author, resource, trusted build, entitlement, notification and uploads preserved |

Require `status: "PASS"`, the intended `sha`, and all verification/cleanup flags
to be true in the upgrade and restore reports. A downloaded report alone is not
success. These reports extend the core release evidence; they are separate required
workflow steps, not additional gates silently inferred by the core JSON summary.

The upgrade fixture pins its baseline and latest target in [`release-upgrade-contract.mjs`](../packages/db/scripts/release-upgrade-contract.mjs) and fails when another migration
is added without updating that contract. It verifies the Support tables, Web Push subscriptions, durable outbox
tables/indexes, queue-gate seed, legacy-row preservation, rollback/retry and
idempotent rerun. Review and extend it with the next release's old-schema fixtures
and data-changing effects. Its injected failure is synthetic and is appended to
migration 0027 after that migration's real SQL, within Drizzle's transaction.
It proves database rollback/retry,
not recovery from host failure or compatibility of an older application image.
Backup acceptance uses synthetic data and the production PostgreSQL/storage
topology; rehearse separately against a protected copy of the target dataset.

### Before maintenance

1. Record the target hostname, current project name, application image ID/digest,
   deployed commit, PostgreSQL major version and actual volume names/mount targets.
   Keep the old application image and its original checkout/Compose/proxy files.
   Save the image with `docker image save` if it is not available from a registry.
2. Record `SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id`
   from the target database. Review pending SQL against this inventory. Do not edit
   applied SQL or its journal. Migration 0025 adds nullable structured notification JSON; migrations 0028-0030
   then add Support storage, session-bound Web Push subscriptions and the durable
   Web Push outbox/queue gate. Existing notification title/message/read state
   remain the fallback.
3. Review older pending migrations too: 0020 retires unsafe legacy builds and can
   return products to draft; 0024 normalizes `tool` and rejects unknown types.
   This runbook does not cover a PostgreSQL major-version or storage-layout change.
4. Build the candidate from the selected commit before downtime, using an immutable
   image tag/digest. Retain the matching configuration privately, including recovery
   mail encryption keys needed to read any existing outbox. Do not rotate secrets
   as part of a routine update or put them in release artifacts.
5. Restore a recent database dump and uploads archive to an isolated installation,
   apply the candidate, and check real representative accounts/resources there.
   Disable real outbound mail and keep it away from public traffic.

### Consistent backup and update

Schedule a maintenance window. Stop public ingress, the app, and every enabled
writer (including the optional account-mail worker and external jobs). Keep
PostgreSQL running for the dump. Capture the app container ID before stopping it;
the stopped container must remain available for its uploads mount.

Example backup commands below require operator-selected values. `PRODUCTION_ENV`
is an absolute protected environment-file path; `RELEASE_DIR` is the existing
deployment checkout; `PROJECT` is its unchanged Compose project name.
`BACKUP_DIR` must be a new private directory outside the upload/database volumes.

```bash
set -eu
umask 077
dc() {
  docker compose --env-file "$PRODUCTION_ENV" --project-name "$PROJECT" \
    --file "$RELEASE_DIR/compose.production.yaml" "$@"
}
app_id=$(dc ps --quiet app)
postgres_id=$(dc ps --quiet postgres)
test -n "$app_id"
test -n "$postgres_id"
old_image=$(docker inspect --format '{{.Image}}' "$app_id")
postgres_image=$(docker inspect --format '{{.Image}}' "$postgres_id")
mkdir -m 700 "$BACKUP_DIR"
dc stop caddy push-worker app
# Stop any additional enabled writer services/jobs (for example the optional
# account-mail worker override) using their actual configured names too.
# Proceed only after every writer is stopped.
docker exec "$postgres_id" sh -eu -c \
  'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-privileges' \
  > "$BACKUP_DIR/database.dump"
docker run --rm --network none --entrypoint tar \
  --volumes-from "$app_id:ro" "$postgres_image" \
  -C /data/uploads -czf - . > "$BACKUP_DIR/uploads.tar.gz"
test -s "$BACKUP_DIR/database.dump"
test -s "$BACKUP_DIR/uploads.tar.gz"
printf '%s\n' "$old_image" > "$BACKUP_DIR/previous-app-image.txt"
(cd "$BACKUP_DIR" && sha256sum database.dump uploads.tar.gz > SHA256SUMS)
```

Retain the dump, uploads, image and matching protected configuration together.
Checksums detect accidental changes; they do not replace a successful restore.
If any backup command fails, do not start the candidate. A `pg_dump` alone cannot
keep database build records and files consistent while uploads continue writing.

Use a reviewed Compose override that sets the candidate `app.image` to its retained
immutable image. Start it with `up --detach --no-build --pull never --wait
--wait-timeout 300 app` while ingress stays stopped. Include the same override in
every command. The image entrypoint applies migrations before starting HTTP;
an app restart can retry migrations, so stop a repeatedly failing candidate before
investigating. Do not use `down --volumes`, `volume prune` or `db:seed` on this host.

After app readiness succeeds, check `node scripts/check-local-readiness.mjs`
inside the app, compare the migration ledger to the candidate journal, and verify
the expected resource/build/entitlement/notification counts and upload checksums.
Start the production push worker with the same candidate and retained VAPID
configuration, then require its liveness probe to pass. If Web Push is configured,
also run the queue probe and resolve any alert before restoring ingress:

```bash
dc up --detach --no-build --pull never --wait --wait-timeout 300 push-worker
dc exec -T push-worker node /app/scripts/check-web-push-worker-health.mjs
dc exec -T push-worker node /app/scripts/check-web-push-worker-queue.mjs
```

Start any additional enabled workers (for example account mail) with the same
candidate and retained secrets. Restore ingress only after these checks, then
verify through HTTPS:

- login, session revocation and the configured recovery-mail path;
- catalog, existing free acquisition and a downloaded file's length/SHA-256;
- author metadata edit, new upload, trusted scan and moderation notification;
- RU/EN workspace and inbox, plus the official server-directory path.

An unconfigured email provider is not successful delivery. If a critical flow
fails, return to maintenance and select recovery before allowing new writes.

### Recovery decision

For an additive migration, returning to the old image may be possible only after
checking that image against the upgraded schema and current data in isolation.
The CI upgrade fixture does not prove old-image compatibility. Never delete a
migration-ledger row or drop the new column merely to make the old version start.

When image-only rollback is unverified or the migration changed data, recover
the **paired pre-update database and uploads**, with their matching old image and
configuration, into **new empty volumes** under a separate recovery project.
Keep the failed installation stopped and retain its volumes for investigation.

1. Verify `SHA256SUMS` and the backup identity. Start only the recovery PostgreSQL
   service on its empty volume, using the original PostgreSQL major version.
2. Restore the custom dump with `pg_restore --exit-on-error --no-owner
   --no-privileges` into that empty database. Stop on any error; do not use
   `--clean` against the failed or an unknown database.
3. Extract the paired archive into the recovery project's empty uploads volume,
   preserving file ownership. Confirm storage keys, lengths and hashes against
   restored build rows and compare the restored migration ledger to the backup.
4. Start the retained old app/worker with that restored database and storage and
   the old configuration; repeat readiness and HTTPS critical journeys. Route
   ingress to the recovery installation only after verification.
5. Document any writes made after the backup: restoring a snapshot loses them.
   Keep that interval empty through maintenance, or plan explicit reconciliation.

Do not copy a raw PostgreSQL volume between major versions. Preserve both the
failed volumes and the backup until the recovered installation is confirmed stable.


### Worker liveness vs progress

Production delivery workers distinguish process heartbeat from dispatcher progress.
A fresh health-file heartbeat is not sufficient if the main dispatch loop has
stopped completing batches. Web Push uses a 180-second progress watchdog.
Account mail uses a minimum 180-second watchdog that scales with configured
batch size and SMTP timeout. If progress exceeds that budget, the worker exits
non-zero so the container restart policy can recover it; durable leases/outbox
rows remain authoritative and are reclaimed after expiry.


### Push worker container hardening

The production Web Push worker uses the same approved runtime image as the web
application but runs as an isolated non-root service with a read-only root
filesystem, a small noexec/nosuid/nodev tmpfs for health state, all Linux
capabilities dropped, no-new-privileges, a bounded PID limit, SIGTERM and a
75-second graceful-stop window. CI production smoke renders the real Compose
configuration, pins the push worker to the exact prebuilt commit image, disables
restart only for the disposable test project, and asserts these runtime
isolation properties before acceptance continues.
