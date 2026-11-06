# Production boundary, overlays and migration authoring

**Статус:** living · ops module (D4).  
**Канон:** якоря в [`docs/OPERATIONS.md`](../OPERATIONS.md) (§3 + subsections).

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

### Compose overlay matrix

Compose merge order is significant. Do not combine the development base with the
production base. Supported scenarios (OPS-04 / ARC09):

| Scenario                                  | Files (left → right merge order)                                                                | Expected roles                                                                                                                      |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Dev                                       | `compose.yaml`                                                                                  | `postgres`, `clamav`, `app`, `push-worker`, `license-worker`, `resource-release-worker` (host source mounts + loopback app port)    |
| Dev + local mail capture                  | `compose.yaml` + `compose.mailpit.yaml`                                                         | Dev roles + Mailpit + durable account-mail worker (capture only)                                                                    |
| Isolated verify                           | `compose.verify.yaml`                                                                           | Disposable `postgres` + `verify` (no production ports; not a deploy)                                                                |
| Production                                | `compose.production.yaml`                                                                       | `postgres`, `clamav`, `app`, `push-worker`, `license-worker`, `resource-release-worker`, `caddy`                                    |
| Production + recovery mail                | `compose.production.yaml` + `compose.recovery.yaml` + `compose.mail-worker.yaml`                | Production roles + optional `mail-worker`; recovery env on `app`                                                                    |
| Production + recovery mail + file secrets | …previous… + `compose.recovery-file-secrets.yaml` (and optional auth/CA/rotation file overlays) | Same roles; secrets via `/run/secrets` — do not mix conflicting env+file values for the same key                                    |
| Production CI                             | `compose.production.yaml` + `compose.production-ci.yaml`                                        | Same production service set; Compose ≥ 2.24.4 for `!override`; Caddy published only on loopback `127.0.0.1:8080` / `127.0.0.1:8443` |

**Inventory (production base writers and edge):**

| Role                     | Service                   | Notes                                                           |
| ------------------------ | ------------------------- | --------------------------------------------------------------- |
| HTTP + migration phase   | `app`                     | Entrypoint migrates before HTTP (`scripts/start-production.sh`) |
| Web Push                 | `push-worker`             | Always in production base                                       |
| License maintenance      | `license-worker`          | Always in production base                                       |
| Resource release notices | `resource-release-worker` | Always in production base                                       |
| Optional account mail    | `mail-worker`             | Only when mail overlays are enabled                             |
| Ingress                  | `caddy`                   | Stop during maintenance; not a DB writer                        |
| Database                 | `postgres`                | Keep running for `pg_dump`                                      |
| Scanner                  | `clamav`                  | Keep available; not an application writer                       |

Production rendered config must not carry development source bind-mounts
(`./apps/...`, `./packages/...`). CI must not publish non-loopback host ports.
Static `docker compose config` with synthetic values confirms shape; it does not
prove live readiness. Contract tests: `scripts/tests/compose-overlay-matrix.node-test.mjs`
plus recovery/mail fixtures under `scripts/tests/*compose*`.

### Same-digest promotion across runtime origins

OPS-05 / ARC10: one prebuilt `runtime` app image is promoted under different
allowed HTTPS origins **without rebuild**. Build-stage `NEXT_PUBLIC_APP_URL`,
`AUTH_SECRET` and `DATABASE_URL` in the Dockerfile are compile placeholders only;
`@nexus/config` rejects those build-placeholder secrets if they reach a production
process. Prefer canonical runtime `APP_URL`; Compose may still set the historical
server name `NEXT_PUBLIC_APP_URL` (entrypoint keeps them aligned). Client bundles
must not read `NEXT_PUBLIC_APP_URL` for links or CSRF. Caddy uses runtime
`{$DOMAIN}`; production Compose templates
`NEXT_PUBLIC_APP_URL=https://${DOMAIN}` while the disposable CI overlay uses
`https://nexus-ci.test:8443` against `${NEXUS_CI_IMAGE}` (prebuilt).

**Local contract (does not claim production PASS):**

```bash
node --test scripts/tests/production-entrypoint.node-test.mjs
pnpm test:focus tests/config.test.ts tests/production-runtime-readiness.test.ts \
  tests/production-tracing-bounds.test.ts tests/production-edge-security.test.ts
```

Full disposable image rehearse remains `scripts/check-production-startup.sh` on a
GitHub-hosted runner with its existing guards (`NEXUS_CI_PREBUILT_IMAGE` when
reusing one digest). That check is external to local development and is not
asserted PASS here.

### Forward-only migration authoring

Schema history is forward-only ([ARCHITECTURE](../ARCHITECTURE.md)): new changes are
new SQL migrations; rolling back an image does not roll back the database. Applied
SQL files and `packages/db/migrations/meta/_journal.json` are not rewritten.

**Current generator risk (OPS-06 / ARC14):** the journal contains migrations through
the latest `0087_*` tag, while Drizzle meta snapshots still stop at `0000` /
`0001`. Plain `pnpm db:generate` / `drizzle-kit generate` against that lag is
unsafe in the main checkout and is refused by
`packages/db/scripts/guard-db-generate.mjs`.

**Supported authoring path (manual/custom + guards):**

1. Work only in a disposable checkout or temporary branch. Do not run generate
   against the live main working tree as a “fix”.
2. Create an empty custom migration:
   `NEXUS_ALLOW_DB_GENERATE=1 pnpm --filter @nexus/db generate:custom -- --name <descriptive_tag>`
3. Hand-author only the expected forward-only delta in the new SQL file. Keep
   retries/idempotency compatible with existing upgrade rehearsal.
4. Update the release-upgrade contract target when the journal advances
   (`packages/db/scripts/release-upgrade-contract.mjs` and
   `scripts/tests/release-upgrade.node-test.mjs`).
5. On hosted CI, run the existing disposable upgrade path
   (`packages/db/scripts/check-release-upgrade.mjs`). Do not point tooling at a
   working production database.

Plain generate remains unsupported while snapshots lag. A disposable experiment
requires the explicit double opt-in `NEXUS_ALLOW_UNSAFE_DB_GENERATE=1` and must
never be used to “align” applied history by rewriting journal/SQL. Domain/data
model context for schema work lives in [ARCHITECTURE](../ARCHITECTURE.md) (handbook
`08-DOMAIN…` was removed; do not revive that path).
