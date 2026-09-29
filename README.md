# MTA NEXUS

MTA NEXUS is a player-first Multi Theft Auto: San Andreas platform for live server discovery, community updates, and safe free-resource distribution.

**Current repository version:** `1.2.0-beta.3`  
**Active development branch:** `main` only.

Русский интерфейс и English interface use the same application. Change the language with the language button in the top navigation; the preference is stored in the `nexus_locale` cookie. The global shell, home, resource catalog/cards, workspace, server directory, authentication, errors and metadata now use the shared dictionary.

## Local development / Локальная разработка

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

If Node.js 26+ and the pinned pnpm are installed, `pnpm dev` now starts the same full Docker development stack after running the repository doctor:

```bash
pnpm dev
```

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
docker compose -p nexus-local -f compose.yaml exec app node scripts/check-local-readiness.mjs

# logs
docker compose -p nexus-local -f compose.yaml logs --tail 100 --follow app postgres clamav

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

# project verification
pnpm check
pnpm nexus:doctor

# focused public catalog, saved/library and admin-count checks (no local database)
pnpm test:catalog

# report privacy, audit transaction and moderator notification checks
pnpm test:reports
```

## Demo data / Демонстрационные данные

After migrations, populate a **fresh development database**:

```bash
docker compose -p nexus-local -f compose.yaml exec app pnpm db:seed
```

Seed creates a small ZIP for the inventory demo in the shared local storage,
with its actual byte length and SHA-256 recorded in the build. The archive
contains README.txt and meta.xml only; it is a download fixture, not the
advertised inventory implementation. Production seed is rejected.

For host execution, set `STORAGE_PROVIDER=local` and an **absolute**
`STORAGE_LOCAL_PATH` shared by the app and seed. Relative paths are rejected
because workspace commands run from different directories.

File creation is repeatable and never replaces a different existing file.
The database seed itself still inserts fixed IDs: do not rerun it over an
already populated database. Existing databases and manually created placeholder
files are not automatically repaired. Verify the full claim/download flow in
your development stack after seeding.

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

Only three long-form documents are maintained:

- [Architecture / Архитектура](docs/ARCHITECTURE.md)
- [Operations / Эксплуатация](docs/OPERATIONS.md)
- [Problems / Реестр проблем](docs/PROBLEMS.md) — the single open-problem registry

Everything else should be represented by executable code, migrations, tests, commit history, or issues instead of additional standalone planning documents.

**Development handoff:** subsequent implementation ownership and the ordered Codex continuation plan are recorded in [Operations / Эксплуатация](docs/OPERATIONS.md#7-codex-handoff--передача-разработки-codex).

## Release state

This repository is a closed-beta codebase. Production deployment is a separate operational decision and requires successful verification of the exact `main` SHA, backup/restore readiness, configured production secrets, TLS, storage, malware scanning and recovery delivery.

MTA NEXUS is not affiliated with Rockstar Games, Take-Two Interactive, or the Multi Theft Auto project.

