# MTA NEXUS Operations / Эксплуатация

This document covers development startup, verification and production boundaries.  
Документ описывает запуск разработки, проверки и эксплуатационные ограничения.

## 1. Supported DEV startup

Use the root `compose.yaml`:

```bash
docker compose -p nexus-local -f compose.yaml up --build --detach --wait --wait-timeout 600
```

The stack contains:

- PostgreSQL 18;
- ClamAV;
- the Next.js development container;
- persistent database, ClamAV and upload volumes.

Only the application port is published to the host and it is bound to loopback. PostgreSQL and ClamAV stay on the Compose network.

Source directories are bind-mounted read-only. Next.js uses polling in Docker so edits under `apps/web/src` and workspace `src` directories hot-reload. Package/dependency and image changes still require a rebuild.

Readiness:

```bash
docker compose -p nexus-local -f compose.yaml exec app node scripts/check-local-readiness.mjs
```

The check requires HTTP health, database reachability and writable private storage.

## 2. Verification

When a functioning execution environment is available, the expected project verification path is:

```bash
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm check
pnpm release:verify
```

CI also owns disposable PostgreSQL persistence, backup/restore, local Compose, production Compose and browser journeys.

A workflow object with zero executed steps is infrastructure evidence, not an application test result. Release acceptance must name the exact tested `main` SHA.

## 3. Production boundary

Production must use explicit production Compose/configuration, not the local development stack.

Required properties include:

- HTTPS public URL;
- unique strong authentication and proxy secrets;
- persistent private storage;
- PostgreSQL backup and restore procedure;
- ClamAV enabled and reachable;
- no development placeholder secrets;
- no public database/ClamAV ports;
- explicit recovery/email configuration before claiming email delivery is operational.

Paid commerce remains disabled.

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

The version `1.2.0-beta.1` represents this repository consolidation and hardening update; it is not a statement that public production rollout has occurred.
