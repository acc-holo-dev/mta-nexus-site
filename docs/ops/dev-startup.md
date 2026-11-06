# Supported DEV startup

**Статус:** living · ops module.  
**Канонический вход:** [`docs/OPERATIONS.md`](../OPERATIONS.md) (stubs + consumer markers).  
**Карта:** [ops/README.md](README.md) · стиль [DOCS-STYLE](../DOCS-STYLE.md).

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
liveness: probes also require recent dispatcher progress (see [Worker liveness vs progress](../OPERATIONS.md#worker-liveness-vs-progress)).
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

