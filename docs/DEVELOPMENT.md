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

### Scenario Lab

Scenario Lab creates small, deterministic UI/backend states in the **canonical Docker-only local development database**. It is intentionally narrower than the legacy broad seed and must never be used on production, CI, a remote database or a customized database URL.

List available scenarios without touching the database:

```bash
docker compose -p nexus-local -f compose.yaml exec app pnpm scenario:list
```

Apply one scenario with an explicit opt-in:

```bash
docker compose -p nexus-local -f compose.yaml exec \\
  -e NEXUS_SCENARIO_LAB=true app \\
  pnpm scenario:create moderation-queue
```

Clean only that scenario's namespaced records:

```bash
docker compose -p nexus-local -f compose.yaml exec \\
  -e NEXUS_SCENARIO_LAB=true app \\
  pnpm scenario:cleanup moderation-queue
```

Initial scenarios are `expired-session`, `private-server-owner`, `moderation-queue` and `resource-scan-pending`. Apply is idempotent: the selected scenario's own `scn_*` records are removed and recreated inside one transaction. Cleanup addresses explicit scenario IDs; there is no blanket truncate/reset operation.

Active-session scenarios print a freshly generated local `nexus_session` token to stdout for manual browser testing. They create no password credential and persist no plaintext secret in the repository. Treat the token as a temporary credential and clean the scenario when finished.

The guard requires `NODE_ENV=development`, `NEXUS_SCENARIO_LAB=true`, disabled email delivery, the exact canonical local Compose database URL and an HTTP localhost application URL. It also refuses GitHub Actions. Scenario Lab is development convenience, not test evidence or release acceptance.

## 4. Evidence and limitations

BETA-002 startup evidence: [CI №865, Local Docker startup](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/35940008117/job/107445602459), commit `bc048baaea71985e74d00faed4f66095dd518926`, Linux x86_64. Five readiness-helper tests passed locally on Node 22.16.0 and inside the development container in CI. The container run is the evidence for the project runtime; local helper tests do not prove Docker startup.

A healthy ClamAV service is not proof that the application handles clean/malicious/error scan verdicts correctly. HTTP home is not browser verification or a usability audit. Full production Compose/Caddy/TLS, browser journeys, backup restore, Windows/macOS and ARM remain outside this acceptance. See the [release map](RELEASE-READINESS.md) for the next task.

## 5. Design system and UI rules

The existing conventions below guide later UI work; they were not visually audited in BETA-002.

- Use the design tokens in `apps/web/src/app/globals.css`, rather than hardcoded colors: `bg-page`, `bg-surface`, `bg-elevated`, `border-base`, `text-primary`, `text-secondary` and the other semantic utilities.
- Reuse typography utilities and shared primitives in `@nexus/ui/src/platform.tsx`, including `StatCard`, `SectionHeader`, `TrustBadge`, `StatusBadge` and table primitives.
- Preserve `NexusShell`, sidebar, navbar and footer conventions. A trust badge must state what is actually verified, not imply a guarantee from its styling.
- Each screen needs loading, empty, error and not-found behavior. Verify readable narrow-screen layouts, keyboard operation and the agreed RU/EN copy as well as desktop layouts; do not count the existence of a component as browser acceptance.
