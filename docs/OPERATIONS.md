# MTA NEXUS Operations / Эксплуатация

**Статус:** living · authoritative runbook (канонический путь `docs/OPERATIONS.md` для scripts/CI).  
**Split:** подробный текст — [ops/](ops/README.md); здесь stubs + обязательные markers для scripts/CI.

This document is the pinned operator entrypoint.  
Документ — канонический вход оператора; детали в модулях `docs/ops/*`.

Компактная карта: [PROJECT-MAP.md](PROJECT-MAP.md). Стиль: [DOCS-STYLE.md](DOCS-STYLE.md). Storage/scanner: [ARCHITECTURE](ARCHITECTURE.md).

### Contents / Содержание

1. [Supported DEV startup](#1-supported-dev-startup) *(полный текст пока здесь)*
2. [Verification](#2-verification) → [ops/verification.md](ops/verification.md)
3. [Production boundary](#3-production-boundary) → [ops/production-boundary.md](ops/production-boundary.md)
4. Inbox recovery stubs → [ops/inbox-recovery.md](ops/inbox-recovery.md)
5. [Backup and recovery](#4-backup-and-recovery) → [ops/backup-recovery.md](ops/backup-recovery.md)
6. [Resource safety](#5-resource-safety-operations) → [ops/resource-safety.md](ops/resource-safety.md)
7. [Branch and release](#6-branch-and-release-operations) → [ops/release.md](ops/release.md)
8. Workers → [ops/workers.md](ops/workers.md)

## 1. Supported DEV startup

Use the root `compose.yaml` directly when you want a Docker-only startup:

```bash
docker compose -p nexus-local -f compose.yaml up --build --detach --wait --wait-timeout 600
```

When Node.js 26+ and the pinned pnpm are installed, the supported convenience entrypoint is shown below. Host tooling distinguishes **major-ok** (`package.json#engines.node`: `>=26.0.0 <27`) from the **exact** host/CI pin (`.nvmrc` and `.node-version`: `26.10.0`) and exact pnpm (`package.json#packageManager`: `pnpm@12.4.2`). `pnpm nexus:doctor` passes major-ok and warns on exact drift; release evidence requires exact matches. Docker images use `node:26-alpine` for the same major branch. Use the repository version files before running host-side commands:

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

Both supported Compose stacks set `CLAMD_CONF_AlertExceedsMax=yes`. ClamAV otherwise treats some files skipped because of archive scan limits as clean. With this setting, NEXUS rejects incomplete scans before storage; deployments that provide their own ClamAV daemon must enable the same `AlertExceedsMax` directive. The build upload route counts streamed multipart bytes, so omitting `Content-Length` does not bypass its request-body limit. The file cap is shared by the API, storage, and browser UI; its multipart headroom is checked against the production proxy limit. If the initial build is rejected, the publishing form keeps the saved draft and retries the build against it instead of creating duplicate resources. If the resource-creation response is lost, retrying the same request recovers the draft only when its metadata matches and the current author owns it. For recovery, the form stores an actor-scoped original product request (including title, descriptions, tags and compatibility), build version and release notes, file name, size and SHA-256, and the confirmed product ID, slug and compatibility target when available, in the current tab’s sessionStorage. The archive itself is not stored; after reload the author must select the same file. A pending submission locks its original fields, and an unavailable recovery store prevents the initial submission. MTA sortable release targets such as `1.6.0-9.22279.0` are accepted consistently for resource compatibility and build metadata; the manifest inspector only copies a minimum into the shared form when its client/server scope is unambiguous, and warns in Russian and English when the declaration is missing, malformed, repeated, or conflicting. Its ACL and export previews show up to 20 manifest declarations as written without judging their policy or security. Run `pnpm test:scanner` to exercise INSTREAM framing, real TCP request/response handling, timeout and response limits, RU/EN resource creation and scan errors, duplicate-slug privacy, draft recovery and retry, scan-limit rejection, multipart size enforcement with and without `Content-Length`, proxy-limit alignment, manifest structure and localized version diagnostics, ACL/export previews, and version suggestions, plus accepted uploads without a running ClamAV database or PostgreSQL.

Source directories are bind-mounted read-only. Next.js uses polling in Docker so edits under `apps/web/src` and workspace `src` directories hot-reload. Package/dependency and image changes still require a rebuild.

Readiness:

```bash
docker compose -p nexus-local -f compose.yaml exec app node scripts/check-local-readiness.mjs
```

`pnpm dev:docker:check` requires app readiness plus push-worker, license-worker and
resource-release-worker liveness. The app half checks HTTP health, database reachability
and writable private storage; each worker half validates its heartbeat/progress probe.
With no VAPID triplet the push worker remains healthy-idle and performs queue maintenance;
with all three VAPID values set it dispatches durable Web Push jobs.

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

`pnpm dev:mail:check` runs `dev:docker:check` (app + push / license / resource-release
workers) then the mail-worker, sends a synthetic message through the actual SMTP
transport, verifies its captured body through the Mailpit API and deletes only that
probe. It does not verify the entire account recovery flow. For that, log into a
regular password-based development account without 2FA, verify its existing email in
security settings using the captured link, then request a password reset and follow
the captured reset link.

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

Full: [ops/verification.md](ops/verification.md)
([Test and CI scopes](ops/verification.md#test-and-ci-scopes),
[browser accessibility](ops/verification.md#automated-browser-accessibility),
[property-based](ops/verification.md#property-based-checks),
[code analysis](ops/verification.md#code-analysis-and-focused-checks)).

Use `pnpm check:code`, focused `pnpm test:focus`, database disposable suites, and
path-scoped CI (`documentation` → `unit_ci` → `fast_ci` → `full_acceptance`). Local
PASS ≠ production deploy.

### Test and CI scopes

See [ops/verification.md#test-and-ci-scopes](ops/verification.md#test-and-ci-scopes).

### Automated browser accessibility

See [ops/verification.md#automated-browser-accessibility](ops/verification.md#automated-browser-accessibility).

### Property-based checks

See [ops/verification.md#property-based-checks](ops/verification.md#property-based-checks).

### Code analysis and focused checks

See [ops/verification.md#code-analysis-and-focused-checks](ops/verification.md#code-analysis-and-focused-checks).

## 3. Production boundary

Full: [ops/production-boundary.md](ops/production-boundary.md).

Production Compose overlays, same-digest promotion, and forward-only migration
authoring live in the module. Do not merge `compose.yaml` with
`compose.production.yaml`.

### Compose overlay matrix

See [ops/production-boundary.md#compose-overlay-matrix](ops/production-boundary.md#compose-overlay-matrix).

### Same-digest promotion across runtime origins

See [ops/production-boundary.md#same-digest-promotion-across-runtime-origins](ops/production-boundary.md#same-digest-promotion-across-runtime-origins).

### Forward-only migration authoring

See [ops/production-boundary.md#forward-only-migration-authoring](ops/production-boundary.md#forward-only-migration-authoring).

### Recovering report inbox delivery

Full runbook: [ops/inbox-recovery.md#recovering-report-inbox-delivery](ops/inbox-recovery.md#recovering-report-inbox-delivery).

Probe: `node scripts/check-web-push-worker-queue.mjs`. Alerts include
`report_delivery_failed` / `report_delivery_backlog`.

```sh
pnpm notifications:delivery list --channel report
NEXUS_NOTIFICATION_DELIVERY_RESET_ACK=YES pnpm notifications:delivery reset \
  --channel report --id rpt_REPLACE_WITH_VERIFIED_ID
```

Reset **one** exhausted id only; inbox fanout ≠ external push delivery.

### Recovering support moderator inbox delivery

Full: [ops/inbox-recovery.md#recovering-support-moderator-inbox-delivery](ops/inbox-recovery.md#recovering-support-moderator-inbox-delivery).

Alerts: `support_delivery_failed` / `support_delivery_backlog`.

```sh
pnpm notifications:delivery list --channel support
NEXUS_NOTIFICATION_DELIVERY_RESET_ACK=YES pnpm notifications:delivery reset \
  --channel support --id REPLACE_WITH_VERIFIED_MESSAGE_ID
```

### Recovering verification moderator inbox delivery

Full: [ops/inbox-recovery.md#recovering-verification-moderator-inbox-delivery](ops/inbox-recovery.md#recovering-verification-moderator-inbox-delivery).

Alerts: `verification_delivery_failed` / `verification_delivery_backlog`.

```sh
pnpm notifications:delivery list --channel verification
NEXUS_NOTIFICATION_DELIVERY_RESET_ACK=YES pnpm notifications:delivery reset \
  --channel verification --id REPLACE_WITH_VERIFIED_REQUEST_ID
```

### Recovering optional push admission

Full: [ops/inbox-recovery.md#recovering-optional-push-admission](ops/inbox-recovery.md#recovering-optional-push-admission).

Uses `check-web-push-worker-queue.mjs` admission fields; reset one unexpired intent via
`pnpm notifications:delivery` channel `admission` + `NEXUS_NOTIFICATION_DELIVERY_RESET_ACK=YES`.
External push is not exactly-once.

### Recovering discussion moderator-style delivery jobs

Full: [ops/inbox-recovery.md#recovering-discussion-moderator-style-delivery-jobs](ops/inbox-recovery.md#recovering-discussion-moderator-style-delivery-jobs).

Alerts: `discussion_delivery_failed` / `discussion_delivery_backlog` and
`publication_delivery_failed` / `publication_delivery_backlog`.

```sh
pnpm notifications:delivery list --channel discussion
NEXUS_NOTIFICATION_DELIVERY_RESET_ACK=YES pnpm notifications:delivery reset \
  --channel discussion --id REPLACE_WITH_VERIFIED_COMMENT_ID

pnpm notifications:delivery list --channel publication
NEXUS_NOTIFICATION_DELIVERY_RESET_ACK=YES pnpm notifications:delivery reset \
  --channel publication --id REPLACE_WITH_VERIFIED_CONTENT_ID
```

### Recovering build-incident downloader notices (SEC-002)

Full: [ops/inbox-recovery.md#recovering-build-incident-downloader-notices-sec-002](ops/inbox-recovery.md#recovering-build-incident-downloader-notices-sec-002).

Alerts: `build_incident_delivery_failed` / `build_incident_delivery_backlog`.

```sh
pnpm notifications:delivery list --channel build_incident
NEXUS_NOTIFICATION_DELIVERY_RESET_ACK=YES pnpm notifications:delivery reset \
  --channel build_incident --id REPLACE_WITH_VERIFIED_BUILD_ID
```

### Recovering discussion inbox delivery

Full: [ops/inbox-recovery.md#recovering-discussion-inbox-delivery](ops/inbox-recovery.md#recovering-discussion-inbox-delivery)
(replay CLI, dry-run, `--repair-push`, dedicated PostgreSQL verification).

Historical windows use `pnpm --filter @nexus/web notifications:replay …` with durable
checkpoints; see the module for lock/adopt-legacy/worker semantics.

## 4. Backup and recovery

Full module: [ops/backup-recovery.md](ops/backup-recovery.md)
([Before maintenance](ops/backup-recovery.md#before-maintenance),
[Consistent backup and update](ops/backup-recovery.md#consistent-backup-and-update),
[Recovery decision](ops/backup-recovery.md#recovery-decision)).

Before a production migration: inventory DB/uploads → backup → restore isolated →
migrate copy → verify journeys → then schedule production. Do not delete unknown
Docker volumes as troubleshooting. Detailed writer stop/resume inventory and
`pg_dump`/uploads pairing live in the module (OPS-12 / F05).

### Before maintenance

See [ops/backup-recovery.md#before-maintenance](ops/backup-recovery.md#before-maintenance).
Record hostname, image digest, migration ledger, and rehearse on an isolated restore
before downtime.

### Consistent backup and update

See [ops/backup-recovery.md#consistent-backup-and-update](ops/backup-recovery.md#consistent-backup-and-update).
Stop ingress + application writers; keep PostgreSQL up for dump; resume workers then
ingress after readiness. Probe helpers include `check-web-push-worker-queue.mjs`.

### Recovery decision

See [ops/backup-recovery.md#recovery-decision](ops/backup-recovery.md#recovery-decision).
Prefer paired pre-update dump+uploads into new volumes when image-only rollback is
unverified; never drop migration-ledger rows to force an old image start.

## 5. Resource safety operations

Full: [ops/resource-safety.md](ops/resource-safety.md).

Admin storage discovery/cleanup requires `X-Nexus-Actor-Id`. Migration
`0020_build_safety_invariants.sql` fails closed (retire unsafe published builds,
reset invalid clean verdicts, draft products without safe builds). Review on an
isolated restored backup before production apply.

## 6. Branch and release operations

Full: [ops/release.md](ops/release.md)
(digests, **Release manifest and retention**, GHCR prep, integrity rollout,
beta candidate evidence, acceptance evidence).

The maintained branch is `main`. Acceptance needs exact-SHA checks, migration
review, appropriate browser/runtime checks, backup/restore confidence for
data-changing releases, and an explicit deployment decision.

Current package version: `1.2.0-beta.3`. Confirm the candidate version in
`package.json`; a version string alone does not demonstrate production acceptance.

### Base and infra image digests

See [ops/release.md#base-and-infra-image-digests](ops/release.md#base-and-infra-image-digests).

### Release manifest and retention

See [ops/release.md#release-manifest-and-retention](ops/release.md#release-manifest-and-retention).
Retention contract uses `owner_decision_required` where human gates apply.
CI artifact retention remains **14 days** unless an owner decision changes it.

### Trusted GHCR publish prep

See [ops/release.md#trusted-ghcr-publish-prep](ops/release.md#trusted-ghcr-publish-prep).

## Resource integrity rollout and seed recovery

See [ops/release.md#resource-integrity-rollout-and-seed-recovery](ops/release.md#resource-integrity-rollout-and-seed-recovery)
and [Local archive integrity](ops/release.md#local-archive-integrity-and-immutable-keys).

## Production compilation in restricted build environments

See [ops/release.md#production-compilation-in-restricted-build-environments](ops/release.md#production-compilation-in-restricted-build-environments).

## Existing-installation release and recovery

See [ops/release.md#existing-installation-release-and-recovery](ops/release.md#existing-installation-release-and-recovery).

### Open free beta candidate evidence

See [ops/release.md#open-free-beta-candidate-evidence](ops/release.md#open-free-beta-candidate-evidence).
Use `pnpm observability:live-drill:verify` (or
`node scripts/check-observability-live-drill-evidence.mjs`) — validators do
**not** close F03 without a live drill. Mentions
`publication_delivery_failed` and `build_incident_delivery_failed` as probe
reasons only.

### Acceptance evidence

See [ops/release.md#acceptance-evidence](ops/release.md#acceptance-evidence).
Use `pnpm recovery:acceptance:verify` (or
`node scripts/check-production-recovery-acceptance-evidence.mjs`) — CI restore
PASS is not F04.

### Worker liveness vs progress

Production delivery workers distinguish process heartbeat from dispatcher progress.
Full module (VAPID, hardening, writable-path limits): [ops/workers.md](ops/workers.md).

Stub keeps consumer markers: a fresh health-file heartbeat is not sufficient if the
main dispatch loop has stopped completing batches (180s Web Push / scaled mail
watchdogs; non-zero exit; durable leases remain authoritative).

### Web Push VAPID triplet generation

See [ops/workers.md#web-push-vapid-triplet-generation](ops/workers.md#web-push-vapid-triplet-generation).
Generate with `node scripts/generate-web-push-vapid.mjs`; never commit the private key.

### Push worker container hardening

See [ops/workers.md#push-worker-container-hardening](ops/workers.md#push-worker-container-hardening).
Read-only root, dropped caps, tmpfs health, SIGTERM/75s — asserted in disposable production smoke.

### Worker container limits

See [ops/workers.md#worker-container-limits](ops/workers.md#worker-container-limits) (OPS-15
writable-path profile for push/license/resource-release/mail workers).
