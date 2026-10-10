# MTA NEXUS

MTA NEXUS is a player-first Multi Theft Auto: San Andreas platform for live server discovery, community updates, and safe free-resource distribution.

**Current repository version:** `1.2.0-beta.3`  
**Active development branch:** `main` only.

Русский интерфейс и English interface use the same application. Change the language with the language button in the top navigation; the preference is stored in the `nexus_locale` cookie. The global shell, home, resource catalog/cards, workspace, server directory, authentication, errors and metadata now use the shared dictionary.

## Local development / Локальная разработка

Authors manage articles, news and discussions at `/workspace/content`: creation,
version-checked edits, status/search/type filters and archival. Editorial edits
return to moderator review; archived entries remain read-only. `/articles` and
`/community` support URL-preserving search, type filters and bounded pagination.
Public name, biography and avatar are editable in `/settings` in both RU/EN.

Recommended zero-host-dependency path: Docker Compose. Host Node.js, pnpm and PostgreSQL are not required.

```bash
git clone https://github.com/acc-holo-dev/mta-nexus-site.git
cd mta-nexus-site
docker compose -p nexus-local -f compose.yaml up --build --detach --wait --wait-timeout 600
```

Open `http://localhost:3000`.

Inside the Compose network, browser checks may use `http://nexus-local-app-1:3000`.
This hostname is explicitly allowed by Next.js development origin checks. The
published host port stays bound to loopback; use `localhost` from the host.
Changes to `apps/web/next.config.mjs` require rebuilding the app image.

If Node.js 26+ and the pinned pnpm are installed, `pnpm dev` now starts the same full Docker development stack after running the repository doctor. The repository pins the verified host Node release in both `.nvmrc` and `.node-version` (26.10.0), while `package.json#packageManager` pins pnpm 12.4.2. Version managers should use those files instead of a machine-global Node installation:

```bash
pnpm dev
```

Web Push is optional in DEV. Leave the three `WEB_PUSH_VAPID_*` values unset for a healthy-idle worker, or set the public/private/subject triplet together to exercise real durable push dispatch. Never commit the private key.

For local recovery-email testing, enable the optional Mailpit capture stack:

```bash
pnpm dev:mail
pnpm dev:mail:check
```

Docker-only equivalent: add `-f compose.mailpit.yaml` after `-f compose.yaml`
in the startup command above. Open `http://localhost:8025` to view captured
messages. No SMTP account or manually generated keys are needed: the initializer
persists independent recovery keys and a local TLS certificate in a named volume.
`pnpm dev:mail:check` verifies worker health and sends/removes one synthetic TLS
probe; it does not trigger a real account recovery. Use the account security
settings to verify a recovery address before testing password reset.
`pnpm dev:mail:logs` shows the app, mail-worker and capture logs;
`pnpm dev:mail:down` stops this stack while preserving data. To return to basic
development, run that stop command before `pnpm dev:docker:up`.
Mailpit never relays captured mail externally. Details: [Operations](docs/OPERATIONS.md#optional-local-mail-capture).

Use `pnpm dev:host` only when PostgreSQL, storage, scanner settings and the rest of the development environment are already configured outside Compose. It starts only the Next.js app and intentionally does not provision dependencies.

In development, `/dev` shows a sanitized runtime status panel for the application, database, storage, scanner and email mode. The route is intentionally unavailable when `NODE_ENV=production`.

The development stack starts PostgreSQL, ClamAV and the Next.js application. Database migrations run before Next.js starts. Application and workspace `src` directories are bind-mounted read-only into the container, so normal source edits hot-reload without rebuilding the image.

If port 3000 is busy:

```bash
NEXUS_DEV_PORT=3001 docker compose -p nexus-local -f compose.yaml up --build --detach --wait --wait-timeout 600
```

Useful commands:

```bash
# health/readiness
pnpm dev:docker:check

# logs
docker compose -p nexus-local -f compose.yaml logs --tail 100 --follow app push-worker postgres clamav

# stop, preserving data volumes
docker compose -p nexus-local -f compose.yaml down
```

Changes to package manifests, Dockerfile, installed dependencies or image-level tooling still require `up --build`. Migration changes require the app startup path to run again; do not point this stack at production data.

Useful host-side commands when Node 26 and pnpm 12 are installed:

```bash
# preflight: Docker, Compose, port, required files and local compose rendering
pnpm dev:preflight

# full foreground development stack
pnpm dev

# detached full development stack
pnpm dev:docker:up

# Next.js only; external dependencies must already be configured
pnpm dev:host

# code checks without Docker or PostgreSQL
pnpm check:code

# full project verification with configured dependencies
pnpm check
pnpm nexus:doctor

# dependency boundaries, unused-code report and production bundle report
pnpm analyze:architecture
pnpm analyze:unused
pnpm analyze:bundle

# focused public catalog, saved/library and admin-count checks (no local database)
pnpm test:catalog

# report privacy, audit transaction and moderator notification checks
pnpm test:reports

# generated trusted-proxy/IP cases, with a reproducible seed
pnpm test:properties
```

Browser acceptance also runs axe-core WCAG checks for account forms in RU/EN,
light and dark themes, plus open dialogs and authenticated screens. Rule and
element diagnostics are retained with the CI browser reports. See
[Operations](docs/OPERATIONS.md#automated-browser-accessibility) for coverage and limitations.

## Demo data / Демонстрационные данные

After migrations, populate or safely repeat the development baseline:

```bash
docker compose -p nexus-local -f compose.yaml exec app pnpm db:seed
```

Seed creates real ZIP fixtures for both inventory and drift resources, recording
actual byte lengths and SHA-256 hashes. Each archive contains README.txt and
meta.xml only; neither implements the advertised game system. New demo resource
descriptions explicitly say so. Fresh baseline data contains no remote avatar,
banner, thumbnail or article-cover URLs; the UI exercises its built-in fallbacks
instead of depending on Unsplash/DiceBear. Production seed is rejected.

The database baseline is transactional and serialized between seed processes.
Reruns insert missing records and preserve existing passwords, roles, content
edits and moderation states. Reserved IDs or unique slugs belonging to other
records cause an error, not an overwrite. A missing demo build is not recreated
for a product whose current version or publication state has changed.

Legacy demo metadata is detected rather than silently repaired. After inspecting
the conflict, repair only the known demo builds with:

```bash
docker compose -p nexus-local -f compose.yaml exec app pnpm db:seed:repair
```

This updates only size/hash metadata after fixture identity checks. It never
replaces a different existing file or resets moderation status. Older development
volumes that still contain the exact legacy CDN media values can be cleaned
separately:

```bash
docker compose -p nexus-local -f compose.yaml exec app pnpm db:seed:repair-media
```

Media repair clears only exact URLs previously written by the NEXUS demo seed;
custom replacements are preserved. For host execution, use
`STORAGE_PROVIDER=local` and an **absolute** `STORAGE_LOCAL_PATH` shared by
the app and seed. Prepared ZIPs may remain after a database rollback;
reruns reuse identical files. Verify claim/download in your development stack.

## Development rules / Правила разработки

- `main` is the only maintained development branch.
- Do not interpret a merged commit as production acceptance.
- Paid checkout, stored-value balances, payouts and crypto settlement stay disabled.
- A resource build is publicly usable only when it is published and has a trusted clean scan with scanner identity and scan timestamp.
- Free-resource claims require an actually downloadable safe build.
- Production configuration stays fail-closed; development defaults must never be reused as production secrets.
- Do not force production data into local migrations or test flows.

## Project map

```text
apps/web/          Next.js application, routes and UI
packages/db/       PostgreSQL schema, migrations and repositories
packages/domain/   domain types, errors and events
packages/security/ authorization, IDs and rate limiting
packages/storage/  private local storage abstraction
packages/ui/       shared UI primitives
packages/config/   environment validation
packages/validation/ request schemas
scripts/           operational and verification tooling
tests/             unit, integration and contract tests
```

The free resource library at `/market` supports category and text search, three sort modes and bounded pages. `/api/products` accepts `type`, `sort`, `q`, `page` and `limit` and returns `products`, `limit`, `page` and `hasMore`. Published resources must still have a trusted clean build. Saved items, personal libraries and public profiles query their own IDs or owners, so older resources are not lost behind the catalog's first page. The personal library also shows active, unexpired legacy licenses without exposing their keys or repeating resources already claimed through newer access records.

## Documentation

The repository keeps three operational long-form documents at the root of `docs/`:

- [Architecture / Архитектура](docs/ARCHITECTURE.md)
- [Operations / Эксплуатация](docs/OPERATIONS.md)
- [Problems / Реестр проблем](docs/PROBLEMS.md) — the single open-problem registry

The owner-confirmed product specification and AI development handbook lives in
[docs/handbook/](docs/handbook/00-README.md). Start with the
[Decision Register](docs/handbook/13-DECISION-REGISTER.md), then read
[Source of Truth and Repository Handoff](docs/handbook/58-SOURCE-OF-TRUTH-AND-REPO-HANDOFF.md)
and the relevant domain chapters.

The handbook describes the approved target product. It does **not** imply that
future commerce, DRM, subscriptions or other target features are already active
in the current closed-beta runtime. Current operational truth, release gates and
verified implementation state remain in Architecture, Operations, Problems,
executable code, migrations and tests.

**Development handoff:** product intent and precedence are defined by the handbook;
the ordered operational continuation and release procedure remain in
[Operations / Эксплуатация](docs/OPERATIONS.md#7-codex-handoff--передача-разработки-codex).

## Release state

This repository is a closed-beta codebase. Production deployment is a separate operational decision and requires successful verification of the exact `main` SHA, backup/restore readiness, configured production secrets, TLS, storage, malware scanning and recovery delivery.

MTA NEXUS is not affiliated with Rockstar Games, Take-Two Interactive, or the Multi Theft Auto project.

