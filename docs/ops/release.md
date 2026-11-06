# Branch, release, integrity and beta evidence

**Статус:** living · ops module (D4).  
**Канон:** якоря в [`docs/OPERATIONS.md`](../OPERATIONS.md) (§6 + related).

## 6. Branch and release operations

The maintained branch is `main`.

A release is not accepted merely because code exists on `main`. Acceptance requires:

- exact-SHA checks executed successfully;
- migration review;
- browser/runtime checks appropriate to the change;
- backup/restore confidence for data-changing releases;
- explicit deployment decision.

Current package version: `1.2.0-beta.3`. Confirm the candidate version in `package.json`; a version string alone does not demonstrate production acceptance.

### Base and infra image digests

OPS-03 keeps Dockerfile/Compose on mutable tags (`node:26-alpine`,
`postgres:18-alpine`, `caddy:2-alpine`, `clamav/clamav:1.5`) so Dependabot docker
updates remain reviewable security PRs. The three Node stages
(`development` / `build` / `runtime`) all follow that major-branch Node policy;
the exact host/CI pin stays in `.nvmrc` / `.node-version`.

PostgreSQL stays on major **18** with volume mount `/var/lib/postgresql`. An
engine major upgrade is a separate operator procedure from application schema
migrations.

Release candidates record exact digests and platform in
[`deploy/infra-image-pins.json`](../../deploy/infra-image-pins.json). Resolve them
when preparing a candidate (does not publish images or authorize production):

```bash
node scripts/resolve-infra-image-digests.mjs --platform linux/amd64
# dry-run only:
node scripts/resolve-infra-image-digests.mjs --dry-run
```

Updating digests is a reviewable file change. Unresolved pins are honest
`status: "unresolved"` entries — do not invent production locks from tag strings
alone. Mutable tags are never production deploy inputs; the approved digest from
the release manifest is.

### Release manifest and retention

OPS-08 extends core release evidence with a versioned `releaseManifest`
(`scripts/release-evidence-lib.mjs`). Required fields include:

- `appVersion`, exact repository SHA, lockfile hash, toolchain evaluation;
- app image digest/platform (may stay `unresolved` until trusted GHCR publish);
- selected infra image pins, PostgreSQL major 18, schema baseline/target, migration hashes;
- redacted role/overlay inventory and links to CI / upgrade / restore evidence;
- `productionAuthorized: false` and `openBetaLive: false` always from the builder.

Missing or mismatched digest/SHA/schema, or an unknown `schemaVersion`, blocks
technical acceptance. CI artifact retention remains **14 days** and is not the
durable release archive. Durable release-bundle/image retention stays
`owner_decision_required` until the owner approves duration and store (OPS-16).
Do not place secrets or working backups in release assets.

### Trusted GHCR publish prep

OPS-10 prepares a `ghcr-publish` job in `.github/workflows/ci.yml` that:

- never runs on `pull_request`;
- accepts only `push` or `workflow_dispatch` on `refs/heads/main` or a `refs/tags/v*` release ref;
- requires `plan.outputs.full == true` and a successful summary for the exact SHA;
- restores the already-built `production.tar` (`fail-on-cache-miss: true`) and
  validates `org.opencontainers.image.revision` — no rebuild under the same identity;
- elevates `packages: write` only on that job (workflow default stays `contents: read`).

Actual push stays gated on repository variable `NEXUS_GHCR_PUBLISH_ENABLED=true`
after OPS-11 visibility/access acceptance. Until then the job is skipped and no
GHCR package is published. Mutable tags such as `:latest` are not production
inputs; consumers use the recorded digest.

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
docker compose -p nexus-local -f compose.yaml exec \
  -e NEXUS_DEMO_SEED_ACK=development-only app pnpm db:seed
docker compose -p nexus-local -f compose.yaml exec \
  -e NEXUS_DEMO_SEED_ACK=development-only app pnpm db:seed
# Only after inspecting a reported legacy demo metadata mismatch:
docker compose -p nexus-local -f compose.yaml exec \
  -e NEXUS_DEMO_SEED_ACK=development-only app pnpm db:seed:repair
# Optional cleanup for exact old Unsplash/DiceBear values written by the seed:
docker compose -p nexus-local -f compose.yaml exec \
  -e NEXUS_DEMO_SEED_ACK=development-only app pnpm db:seed:repair-media
# Optional additive one-year history for local UI testing:
docker compose -p nexus-local -f compose.yaml exec \
  -e NEXUS_DEMO_SEED_ACK=development-only app pnpm db:seed:historical
```

Every seed command fails before storage or database mutation when `NODE_ENV=production` or
when the exact development-only acknowledgement is absent. Do not persist this acknowledgement
in production configuration.

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
remain in [PROBLEMS.md](../PROBLEMS.md).

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
   `pnpm beta:fetch <sha>`). A 7–64 character hexadecimal prefix must resolve
   to one local commit; missing or ambiguous commits are refused before contacting
   GitHub. The resolved full SHA is used to find the CI run. It uses `gh` to download retained
   `ci-evidence-<sha>`, `release-upgrade-<sha>-<attempt>`, and
   `backup-restore-<sha>-<attempt>` into local `artifacts/ci-evidence.json`,
   `artifacts/release-upgrade.json`, and `artifacts/backup-restore-evidence.json`.
   The fetch never invents PASS JSON; missing/expired artifacts fail honestly.
3. Run `pnpm beta:candidate`. ROADMAP 19 backup-restore evidence must report
   `status: "PASS"`, matching SHA, and every disposable-rehearsal flag true
   (`sourceDestroyedBeforeRestore`, checksum/row/schema/ledger/upload restores,
   `cleanupComplete`). Incomplete flags block the candidate—they do not pass.

The report writes `artifacts/beta-candidate-evidence.json`. Interpret it as:

| Field                                    | Meaning                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `checkableCandidate: true`               | Required technical proofs for that SHA passed; only owner deploy authorization remains                                                                                                                                                                                                                                                                                                                      |
| `status: awaiting_owner_deploy_decision` | Same as checkable; still not live and not authorized                                                                                                                                                                                                                                                                                                                                                        |
| `openBetaLive` / `productionAuthorized`  | Always `false` in this harness                                                                                                                                                                                                                                                                                                                                                                              |
| `technicalBlockers`                      | Named gaps (often missing backup-restore CI evidence for ROADMAP 19)                                                                                                                                                                                                                                                                                                                                        |
| `residuals`                              | Optional proofs only: `legal_surfaces` passes from in-repo Terms/Privacy/Community rules (counsel review stays human); `observability` clears only when `artifacts/observability-readiness-evidence.json` validates via `pnpm observability:verify` after `NEXUS_OBSERVABILITY_READY_ACK=YES pnpm observability:ready`; `web_push` still needs both soak + live provider JSON (presence alone never clears) |

`ci-evidence.json` from the CI summary job now includes `requiredJobs` and
`jobResults` so browser/mail/runtime categories can be checked per job.

Legal product surfaces: `pnpm legal:check` (Terms `/terms`, Privacy `/privacy`,
Community rules `/community-rules`, footer links, RU/EN substance). This is not
counsel approval.

Operator observability readiness (alert thresholds + in-repo probes/runbooks):

Configure queue alert thresholds before `observability:ready` (values must be positive
numbers; `.env` is read for missing keys only):

| Env key                                   | Role                                |
| ----------------------------------------- | ----------------------------------- |
| `WEB_PUSH_QUEUE_ALERT_PENDING_PERCENT`    | Pending jobs as % of queue capacity |
| `WEB_PUSH_QUEUE_ALERT_DUE_JOBS`           | Due (ready) job count               |
| `WEB_PUSH_QUEUE_ALERT_OLDEST_AGE_SECONDS` | Oldest pending job age              |

```bash
NEXUS_OBSERVABILITY_READY_ACK=YES pnpm observability:ready
pnpm observability:verify
```

`observability:ready` and `observability:verify` prove in-repo probe scripts, threshold
env keys, and OPERATIONS runbook needles—including delivery-failure alert names such as
`publication_delivery_failed` and `build_incident_delivery_failed`. They do **not** prove
production host alert routing to humans or any third-party monitoring vendor contract.
**Operator readiness ≠ live routing proof (F03 / OPS-14):** validated
`artifacts/observability-readiness-evidence.json` never closes the operational gate; only
owner-filled `observability_live_drill` evidence with real owner/channel/thresholds and
`signalAt → alertAt → humanReceivedAt → recoveryAt` timestamps on the target environment
does. Validate with
[`validateObservabilityLiveDrillEvidence`](../../scripts/observability-evidence-lib.mjs) /
`pnpm observability:live-drill:verify` (or
`node scripts/check-observability-live-drill-evidence.mjs`); fixture shape in
[`scripts/fixtures/observability-live-drill-accept.json`](../../scripts/fixtures/observability-live-drill-accept.json).
Mis-submitting readiness JSON to the live-drill validator is rejected.
The validator allows up to five minutes of clock skew for `recoveryAt`; it rejects a
later future timestamp and does not impose an expiration on older evidence.

Offline queue-probe drill (disposable fixture; exit code 2 means alert, same pattern as
[`scripts/tests/web-push-worker-queue.node-test.mjs`](../../scripts/tests/web-push-worker-queue.node-test.mjs)):

```bash
DRILL_DIR="$(mktemp -d)"
trap 'rm -rf "$DRILL_DIR"' EXIT
HEALTH_FILE="$DRILL_DIR/web-push-health.json"
DRILL_NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
cat >"$HEALTH_FILE" <<EOF
{"status":"ready","configured":true,"pid":1,"batch":8,"heartbeatAt":"${DRILL_NOW}","staleAfterMs":60000,"progressAt":"${DRILL_NOW}","progressStaleAfterMs":180000,"queuePending":0,"queueDue":0,"queueLeased":0,"queueCapacity":10000,"queueOldestAgeSeconds":0,"reportPending":0,"reportFailed":0,"reportOldestAgeSeconds":0,"supportPending":0,"supportFailed":0,"supportOldestAgeSeconds":0,"verificationPending":0,"verificationFailed":0,"verificationOldestAgeSeconds":0,"discussionPending":0,"discussionFailed":0,"discussionOldestAgeSeconds":0,"publicationPending":1,"publicationFailed":1,"publicationOldestAgeSeconds":0,"buildIncidentPending":0,"buildIncidentFailed":0,"buildIncidentOldestAgeSeconds":0,"admissionPending":0,"admissionFailed":0,"admissionOldestAgeSeconds":0,"queueAlert":"alert","queueAlertReasons":["publication_delivery_failed"],"queueAlertThresholds":{"pendingPercent":80,"dueJobs":100,"oldestAgeSeconds":900}}
EOF
NEXUS_WEB_PUSH_HEALTH_FILE="$HEALTH_FILE" node scripts/check-web-push-worker-queue.mjs
echo "expect exit code 2 (alert); got $?"
```

Optional Web Push residual (both artifacts required; never invent PASS). Soak uses
a fixture sender against a migrated database. Local Compose does **not** publish
Postgres to the host, so prefer the compose-network soak entrypoint (stops
`push-worker` for the run so it cannot race the soak dispatcher):

```bash
# Dev VAPID into the protected env file only (never commit private keys):
node scripts/generate-web-push-vapid.mjs 'mailto:push-dev@example.invalid'

# Soak via Compose network → artifacts/web-push-soak-evidence.json
NEXUS_WEB_PUSH_SOAK_ACK=YES NEXUS_WEB_PUSH_SOAK_DURATION_MS=60000 pnpm push:soak:compose
# equivalent host-only path when DATABASE_URL already reaches a migrated DB:
# NEXUS_WEB_PUSH_SOAK_ACK=YES NEXUS_WEB_PUSH_SOAK_DURATION_MS=60000 pnpm push:soak && pnpm push:soak:verify

# Provider probe needs a real browser Push subscription (HTTPS FCM/Mozilla/… endpoint).
# Enable Web Push while signed in on the local app, then copy endpoint/p256dh/auth
# from that session — do not invent endpoints. Automation browsers without
# Notification/PushManager permission cannot clear this half of the residual.
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

**F04 / OPS-13 production recovery acceptance (not CI disposable rehearsal):** retained
`backup-restore-<sha>` JSON with `status: "PASS"` proves ROADMAP 19 synthetic restore on a
GitHub-hosted disposable runner only. It is **not** operational backup/recovery acceptance.
Owner acceptance uses `production_recovery_acceptance` evidence
([`production-recovery-acceptance-evidence.mjs`](../../scripts/production-recovery-acceptance-evidence.mjs))
with agreed RPO/RTO (minutes), retention + verified off-host location, restore access/break-glass,
and measured restore timestamps/data loss checked against those targets. Validate with
`pnpm recovery:acceptance:verify` (or
`node scripts/check-production-recovery-acceptance-evidence.mjs`). The validator allows up to
five minutes of clock skew for `completedAt`; it rejects a later future timestamp and does not
impose an expiration on older evidence. Checklist before recording acceptance:

1. Owner documents RPO/RTO, retention, off-host independence from the primary host, and who may restore.
2. Confirm fresh backup copies exist off-host; do not store dump secrets in GitHub artifacts.
3. On a separately authorized protected copy (not production volumes), measure restore duration and data loss vs targets.
4. Write `artifacts/production-recovery-acceptance-evidence.json` with `verdict.passed: true` only after the drill.
5. Keep [`check-backup-restore.mjs`](../../scripts/check-backup-restore.mjs) on disposable hosted runners only; do not retarget it at live volumes.

Require `status: "PASS"`, the intended `sha`, and all verification/cleanup flags
to be true in the upgrade and restore reports. A downloaded report alone is not
success. These reports extend the core release evidence; they are separate required
workflow steps, not additional gates silently inferred by the core JSON summary.

Upgrade evidence is versioned (`schemaVersion: 1` on newly written artifacts). The
strict validator in [`release-upgrade-contract.mjs`](../../packages/db/scripts/release-upgrade-contract.mjs)
rejects missing/mismatched SHA, wrong `baseline`/`target`, incomplete `phase`
(must be `complete`), and missing/false/wrong-type required boolean flags.
Retained full-format CI artifacts that omit `schemaVersion` remain accepted when
identity, phase, baseline/target and flags are otherwise complete; status-only
`PASS` JSON is not enough. Technical upgrade PASS never sets
`productionAuthorized` — deploy authorization stays a separate owner decision.
Beta-candidate evaluation uses the same upgrade validator.

The upgrade fixture pins its baseline and latest target in that contract and fails when another migration
is added without updating it. It verifies the Support tables, Web Push subscriptions, durable outbox
tables/indexes, queue-gate seed, legacy-row preservation, rollback/retry and
idempotent rerun. Review and extend it with the next release's old-schema fixtures
and data-changing effects. Its injected failure is synthetic and is appended to
migration 0027 after that migration's real SQL, within Drizzle's transaction.
It proves database rollback/retry,
not recovery from host failure or compatibility of an older application image.
Backup acceptance uses synthetic data and the production PostgreSQL/storage
topology; rehearse separately against a protected copy of the target dataset.
