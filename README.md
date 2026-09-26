# MTA NEXUS

MTA NEXUS is a player-first Multi Theft Auto: San Andreas platform for live server discovery, community updates, and safe free-resource distribution.

**Current repository version:** `1.2.0-beta.2`  
**Active development branch:** `main` only.

Русский интерфейс и English interface use the same application. Change the language with the language button in the top navigation; the preference is stored in the `nexus_locale` cookie. The global shell, home, resource catalog/cards, workspace, server directory, authentication, errors and metadata now use the shared dictionary.

## Local development / Локальная разработка

Recommended path: Docker Compose. Host Node.js, pnpm and PostgreSQL are not required.

```bash
git clone https://github.com/acc-holo-dev/mta-nexus-site.git
cd mta-nexus-site
docker compose -p nexus-local -f compose.yaml up --build --detach --wait --wait-timeout 600
```

Open `http://localhost:3000`.

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

Host-side commands are also available when Node 26 and pnpm 12 are installed:

```bash
pnpm dev
pnpm check
pnpm nexus:doctor
```

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

## Documentation

Only two long-form documents are maintained:

- [Architecture / Архитектура](docs/ARCHITECTURE.md)
- [Operations / Эксплуатация](docs/OPERATIONS.md)

Everything else should be represented by executable code, migrations, tests, commit history, or issues instead of additional standalone planning documents.

## Release state

This repository is a closed-beta codebase. Production deployment is a separate operational decision and requires successful verification of the exact `main` SHA, backup/restore readiness, configured production secrets, TLS, storage, malware scanning and recovery delivery.

MTA NEXUS is not affiliated with Rockstar Games, Take-Two Interactive, or the Multi Theft Auto project.
