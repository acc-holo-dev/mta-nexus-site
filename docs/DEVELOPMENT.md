# MTA NEXUS — Local Development Guide

## 1. One supported local startup

Use the [Docker-only quickstart in README](../README.md#local-development--локальный-запуск-через-docker). It is the single source for startup commands; do not maintain a second host-Node recipe here. The default local stack contains the application, PostgreSQL and ClamAV. Dependencies are installed in the development image, migrations run before Next.js, and app readiness checks database access and writable file storage.

The local development target is distinct from the production image. Keep production environment validation strict. Do not publish this development server to the internet or point it at production data. Rebuild with the documented `up --build` command after source changes; host-file synchronization is not enabled yet.

## 2. Initial data

Startup does not seed demonstration users or content. Do not assume that credentials from old versions of this document exist in a fresh environment. The existing development seed in `packages/db/src/seed.ts` is a separate data-changing action; it was not part of BETA-002 acceptance. Review it before using it on a disposable development database. Never seed production or an environment with unknown data.

New-account, creator onboarding and moderator-bootstrap journeys still need their own acceptance under the release map. A working local stack does not close those tasks.

## 3. Checks and safe test boundaries

Check the running local instance without installing Node on the host:

```bash
docker compose -p nexus-local -f compose.yaml exec app node scripts/check-local-readiness.mjs
docker compose -p nexus-local -f compose.yaml exec app node --test scripts/tests/local-readiness.node-test.mjs
```

These commands check startup/storage readiness and the readiness helper; they are not a full application test suite. Typecheck, Vitest, application build and production image build remain in the `Verify` CI job using a dedicated test database. Do not direct data-changing integration tests at a populated local database or production. A convenient isolated Docker test-suite runner can be added separately; do not bypass isolation to simplify a command.

CI also runs `PostgreSQL persistence` and `Local Docker startup`. The latter uses the actual local Compose file on a disposable hosted runner with a unique project name, checks HTTP home, non-root execution and loopback-only exposure, then replaces the app container and verifies database/file probes. Its volume-deleting cleanup applies only to that disposable CI project, not to a developer's environment.

Node infrastructure tests use `*.node-test.mjs` filenames and explicit `node --test` execution so that Vitest does not collect them as its own suites.

### Disposable local verification fallback

When GitHub Actions is unavailable, the repository can run a narrower verification locally without using host Node/pnpm and without touching the normal `nexus-local` database. This fallback does **not** replace production/browser/release acceptance; it only checks migrations, TypeScript, Vitest and a production Next.js build on a fresh disposable PostgreSQL volume.

Bash / WSL / Git Bash:

```bash
NEXUS_LOCAL_VERIFY=true bash scripts/check-local-verification.sh
```

PowerShell:

```powershell
$env:NEXUS_LOCAL_VERIFY = "true"
./scripts/check-local-verification.ps1
```

Both wrappers require the default local Docker context, reject `DOCKER_HOST`/`DOCKER_CONTEXT` overrides and generate a unique `nexus-verify-*` Compose project. They render `compose.verify.yaml`, build the development tool image, create a fresh PostgreSQL volume, run migrations/typecheck/tests/build, then remove only the generated project and its volumes. The verification Compose file publishes no host ports and does not start ClamAV or an HTTP server.

Do not reinterpret a local PASS as GitHub Actions evidence, BETA acceptance, production Docker acceptance, browser acceptance or release approval.

## 4. Evidence and limitations

BETA-002 startup evidence: [CI №865, Local Docker startup](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/35940008117/job/107445602459), commit `bc048baaea71985e74d00faed4f66095dd518926`, Linux x86_64. Five readiness-helper tests passed locally on Node 22.16.0 and inside the development container in CI. The container run is the evidence for the project runtime; local helper tests do not prove Docker startup.

A healthy ClamAV service is not proof that the application handles clean/malicious/error scan verdicts correctly. HTTP home is not browser verification or a usability audit. Full production Compose/Caddy/TLS, browser journeys, backup restore, Windows/macOS and ARM remain outside this acceptance. See the [release map](RELEASE-READINESS.md) for the next task.

## 5. Design system and UI rules

The existing conventions below guide later UI work; they were not visually audited in BETA-002.

- Use the design tokens in `apps/web/src/app/globals.css`, rather than hardcoded colors: `bg-page`, `bg-surface`, `bg-elevated`, `border-base`, `text-primary`, `text-secondary` and the other semantic utilities.
- Reuse typography utilities and shared primitives in `@nexus/ui/src/platform.tsx`, including `StatCard`, `SectionHeader`, `TrustBadge`, `StatusBadge` and table primitives.
- Preserve `NexusShell`, sidebar, navbar and footer conventions. A trust badge must state what is actually verified, not imply a guarantee from its styling.
- Each screen needs loading, empty, error and not-found behavior. Verify readable narrow-screen layouts, keyboard operation and the agreed RU/EN copy as well as desktop layouts; do not count the existence of a component as browser acceptance.
