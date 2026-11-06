# MTA NEXUS Operations / Эксплуатация

**Статус:** living · authoritative runbook (канонический путь `docs/OPERATIONS.md` для scripts/CI).  
**Split:** подробный текст — [ops/](ops/README.md); здесь stubs + обязательные markers для scripts/CI.

This document is the pinned operator entrypoint.  
Документ — канонический вход оператора; детали в модулях `docs/ops/*`.

Компактная карта: [PROJECT-MAP.md](PROJECT-MAP.md). Стиль: [DOCS-STYLE.md](DOCS-STYLE.md). Storage/scanner: [ARCHITECTURE](ARCHITECTURE.md).

### Contents / Содержание

1. [Supported DEV startup](#1-supported-dev-startup) → [ops/dev-startup.md](ops/dev-startup.md)
2. [Verification](#2-verification) → [ops/verification.md](ops/verification.md)
3. [Production boundary](#3-production-boundary) → [ops/production-boundary.md](ops/production-boundary.md)
4. Inbox recovery stubs → [ops/inbox-recovery.md](ops/inbox-recovery.md)
5. [Backup and recovery](#4-backup-and-recovery) → [ops/backup-recovery.md](ops/backup-recovery.md)
6. [Resource safety](#5-resource-safety-operations) → [ops/resource-safety.md](ops/resource-safety.md)
7. [Branch and release](#6-branch-and-release-operations) → [ops/release.md](ops/release.md)
8. Workers → [ops/workers.md](ops/workers.md)

## 1. Supported DEV startup

Full: [ops/dev-startup.md](ops/dev-startup.md)
([Optional local mail capture](ops/dev-startup.md#optional-local-mail-capture)).

Supported convenience entrypoint is `pnpm dev` (preflight + full Compose stack).
`pnpm dev:host` is intentionally different: it starts only the Next.js development server.
Use it only when PostgreSQL, storage and scanner dependencies are already configured
externally.

```bash
pnpm dev
pnpm dev:docker:check   # app + license-worker and resource-release-worker liveness
pnpm dev:docker:down
```

Workers distinguish process heartbeat from dispatcher progress
(see [Worker liveness vs progress](#worker-liveness-vs-progress)).
ClamAV stacks set `CLAMD_CONF_AlertExceedsMax=yes`. Optional Mailpit:
`pnpm dev:mail` / `pnpm dev:mail:check` via `compose.mailpit.yaml`.

Host pins: major-ok `engines.node` vs exact `.nvmrc` / `packageManager` — details in the module.

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

Supported bases (do not mix dev+production): `compose.yaml`,
`compose.verify.yaml`, `compose.production.yaml`,
`compose.production-ci.yaml`, `compose.recovery.yaml`,
`compose.mail-worker.yaml` (optional `mail-worker`). Writer stop inventory for
maintenance (PostgreSQL stays up for `pg_dump`):

```bash
dc stop caddy push-worker license-worker resource-release-worker app
# …dump…
dc up --detach --no-build --pull never --wait --wait-timeout 300 \
  push-worker license-worker resource-release-worker
# optional: dc up … mail-worker
```

### Same-digest promotion across runtime origins

See [ops/production-boundary.md#same-digest-promotion-across-runtime-origins](ops/production-boundary.md#same-digest-promotion-across-runtime-origins).

### Forward-only migration authoring

See [ops/production-boundary.md#forward-only-migration-authoring](ops/production-boundary.md#forward-only-migration-authoring)
and [ARCHITECTURE](ARCHITECTURE.md). Applied SQL files are not rewritten.
Plain `drizzle-kit generate` is unsafe in the main checkout and is refused by
`packages/db/scripts/guard-db-generate.mjs` (do not run generate against live
main). Supported path:

`NEXUS_ALLOW_DB_GENERATE=1 pnpm --filter @nexus/db generate:custom -- --name <tag>`

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
Canonical stop line (also under Compose overlay matrix):

```bash
dc stop caddy push-worker license-worker resource-release-worker app
```

Optional `mail-worker` when mail overlays are enabled; PostgreSQL stays up.

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
