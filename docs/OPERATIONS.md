# MTA NEXUS Operations / Эксплуатация

This document covers development startup, verification and production boundaries.  
Документ описывает запуск разработки, проверки и эксплуатационные ограничения.

## 1. Supported DEV startup

Use the root `compose.yaml` directly when you want a Docker-only startup:

```bash
docker compose -p nexus-local -f compose.yaml up --build --detach --wait --wait-timeout 600
```

When Node.js 26+ and the pinned pnpm are installed, the supported convenience entrypoint is:

```bash
pnpm dev
```

It runs `pnpm dev:preflight` first and then starts the same full Compose development stack. The preflight checks required repository files, Docker/Compose availability, Linux containers, the selected local port and whether `compose.yaml` renders without implicitly importing application secrets.

`pnpm dev:host` is intentionally different: it starts only the Next.js development server. Use it only when PostgreSQL, storage and scanner dependencies are already configured externally.

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

For changes to the official MTA directory and search, run `pnpm test:directory` first. It checks parser boundaries, stale data, API filtering and pagination, RU/EN surfaces, and balanced cross-category search without a local database. The API checks call the real route handler with a controlled directory response; the full `pnpm check` still requires PostgreSQL and is the release gate. A focused pass is not a release acceptance result.

For review and build-moderation changes, `pnpm test:resource` checks resource review HTTP boundaries, safe published-build selection and the moderation contract without PostgreSQL. It checks neither database transaction execution nor scanner integration; those remain in the full CI suite.

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

The version `1.2.0-beta.3` represents the consolidated mainline hardening, RU/EN UI completion, free-resource acquisition cleanup, accessibility pass and deterministic DEV startup contract; it is not a statement that public production rollout has occurred.

## 7. Codex handoff / Передача разработки Codex

### 7.1 Ownership transition

From this point forward, Codex is the implementation owner for subsequent MTA NEXUS development.

Baseline before the documentation-only handoff commit:

- branch: `main`;
- implementation SHA: `b864076582a8f3b3dfad77798a97580d2b2500bf`;
- repository version: `1.2.0-beta.3`;
- development policy: work directly on `main`; do not create new long-lived development branches;
- production deployment remains a separate explicit decision.

Codex must treat this section as the canonical continuation plan. Do not restart architecture from scratch and do not reintroduce features intentionally removed or disabled by the closed-beta policy.

### 7.2 Current implemented state

The current mainline already includes the following consolidated work:

- shared RU/EN application dictionary across the main public, workspace, auth, admin, legal, server, resource and recovery surfaces;
- semantic light/dark UI tokens across the main user journeys;
- accessible global shell with skip-to-content, keyboard focus states, compact mobile header controls and mobile navigation;
- development-only sanitized `/dev` diagnostics;
- deterministic development startup: `pnpm dev` runs the preflighted full Docker Compose development stack, while `pnpm dev:host` starts only Next.js;
- PostgreSQL, ClamAV and private storage readiness in local development;
- production runtime readiness gated on HTTP/database readiness plus real private-storage read/write capability;
- fail-closed resource publication and download rules requiring a trusted clean published build with scanner provenance;
- free-resource acquisition through `/acquire`; the historical `/checkout` route is compatibility-only and paid commerce is disabled;
- active paid-order/license primitives removed from the runtime service while historical schema/repository compatibility remains intact;
- resource build provenance, dependency resolution, reverse dependency display and static `meta.xml` inspection;
- server directory, follow flow, control challenge, ownership management, history and server-linked updates;
- account recovery, recovery-email verification, password reset and session management;
- community/articles, content comments and moderation actions;
- admin build/content/verification moderation with explicit server-confirmed mutations;
- notification center/preferences and authenticated mutation responses hardened with private/no-store semantics where applicable;
- mutation UI generally requires confirmed response payloads rather than treating an arbitrary HTTP 2xx as success;
- only two long-form project documents remain: `docs/ARCHITECTURE.md` and this `docs/OPERATIONS.md`.

### 7.3 Known release blockers at handoff

Codex must not mark the project release-ready until these blockers are closed.

#### A. Remote branch cleanup

GitHub currently exposes 60 branches: `main` plus 59 historical development/release/audit branches.

Required action:

1. enumerate all remote branches other than `main`;
2. verify whether any branch contains a required change that is not already represented on `main`;
3. if a required change exists, port the minimal justified change to `main` first;
4. delete every non-`main` remote branch;
5. confirm the repository branch list contains exactly one branch: `main`;
6. do not rewrite or force-reset `main` merely to make branch cleanup easier.

This cleanup was not executable through the previous GitHub connector because it did not expose branch/ref deletion.

#### B. GitHub Actions execution failure

Recent exact-SHA workflow runs create jobs but execute zero steps: the jobs report `steps: []`. Checkout, lint, typecheck, tests and builds therefore never begin.

Required action:

1. inspect repository and organization Actions settings;
2. inspect hosted/self-hosted runner availability, permissions, billing/quota and policy restrictions;
3. inspect workflow-level concurrency, environment and permission configuration;
4. restore actual job execution;
5. rerun CI against the exact current `main` SHA;
6. treat only executed successful steps as application verification.

A workflow object that exists but ran zero steps is not release evidence.

### 7.4 Mandatory next-development stages

Codex should execute the stages below in order. Each stage must leave `main` better than it found it and should finish with tests or executable evidence.

#### Stage 1 — Repository hygiene and single-main enforcement

- delete all non-`main` remote branches after the safety check above;
- verify no temporary planning, generated-debug or abandoned artifact files remain;
- keep only `README.md`, `docs/ARCHITECTURE.md` and `docs/OPERATIONS.md` as maintained prose documentation;
- verify package manifests and workspace metadata remain consistent with the current beta version;
- do not create replacement planning documents for this handoff.

Acceptance: GitHub shows exactly one branch, `main`, and the repository documentation policy remains satisfied.

#### Stage 2 — Restore deterministic verification

Run from a clean clone of the exact `main` SHA:

```bash
pnpm install --frozen-lockfile
pnpm nexus:doctor
pnpm db:migrate
pnpm check
pnpm release:verify
```

Also execute the repository's Node/Vitest/integration suites that are part of the check/release scripts.

Fix real failures. Do not weaken production guards or delete meaningful tests merely to obtain green output. Source-contract tests may be updated only when the underlying user/security contract legitimately changed.

Acceptance: all host-side verification passes on a named exact SHA.

#### Stage 3 — Full local Docker runtime verification

Run the supported development stack:

```bash
pnpm dev:docker:up
docker compose -p nexus-local -f compose.yaml exec app node scripts/check-local-readiness.mjs
```

Verify:

- app health;
- PostgreSQL persistence across container restart;
- writable/readable private storage;
- ClamAV connectivity and scanner behavior;
- migrations on a clean database;
- restart without data loss;
- `/dev` visible only outside production.

Acceptance: full local stack is healthy and reproducible from a clean environment.

#### Stage 4 — Browser acceptance in RU/EN and light/dark themes

Use an actual browser against the running application. Test desktop and narrow mobile viewports.

Minimum journeys:

1. landing/home and global navigation;
2. locale switch RU ↔ EN;
3. light ↔ dark theme;
4. command palette with Ctrl/Cmd+K;
5. register/login/logout/session refresh;
6. forgot-password/reset-password/recovery-email flows using test delivery infrastructure;
7. settings preferences, password change and session revocation;
8. server directory/search/filter/detail;
9. server follow/unfollow;
10. server control challenge and management flow;
11. server history and server-linked updates;
12. free-resource catalog/detail;
13. free resource acquisition into the library;
14. authorized latest-build download;
15. resource publishing/build submission and `meta.xml` inspection;
16. community topic creation/comment flow;
17. articles and linked content;
18. notifications and mark-all-read;
19. admin verification/content/build moderation;
20. accessibility keyboard traversal, focus visibility and skip-to-content.

Acceptance: no blocking console errors, hydration errors, broken layouts, untranslated core controls or false-success mutation states.

#### Stage 5 — Complete mutation-integrity audit

Audit every authenticated POST/PATCH/PUT/DELETE client flow.

For each mutation:

- use `credentials: "same-origin"` where session cookies are required;
- use `cache: "no-store"` for private/mutable data;
- use bounded request timeouts or explicit abort control;
- validate the response structure before updating local success state;
- preserve server-authoritative state on ambiguous responses;
- return private/no-store response headers from authenticated route handlers where appropriate;
- never interpret arbitrary HTTP 2xx as proof that the intended state transition happened.

Pay special attention to settings, follows, comments, content publishing, admin moderation, server updates/management, notification preferences and auth/session mutations.

Acceptance: contract tests cover confirmation payloads and cache privacy for all sensitive mutation families.

#### Stage 6 — Security and authorization audit

Recheck all authority boundaries, especially:

- organization membership and resource management;
- server ownership/control challenge;
- content target authorization;
- admin/moderator permissions;
- product/build publication authority;
- authenticated download authorization;
- session creation/revocation;
- recovery tokens and URL-fragment handling;
- trusted request IP handling;
- rate limits on abuse-sensitive endpoints;
- production security headers and proxy configuration;
- no wildcard remote-image trust policy merely to enable image optimization.

Do not replace server-side authorization with hidden buttons or client-only checks.

Acceptance: security tests pass and each privileged action has an explicit server-side authority check.

#### Stage 7 — Data, migration and backup rehearsal

Use an isolated restored copy of representative data.

Required:

1. take PostgreSQL and upload-storage backups;
2. restore into an isolated environment;
3. run all migrations, including build-safety invariants;
4. verify unsafe legacy builds are handled exactly as documented;
5. verify entitlement compatibility for historical records;
6. run critical user journeys against the restored/migrated dataset;
7. perform a second backup and restore after migration.

Never troubleshoot by deleting unknown volumes or production-like data.

Acceptance: backup → restore → migrate → verify → backup → restore is documented by executable evidence.

#### Stage 8 — Resource/media performance pass

Only after correctness and security are green:

- measure server/client bundle and route performance;
- review unnecessary client boundaries and request waterfalls;
- keep parallel reads with `Promise.all` where safe;
- review image delivery without granting arbitrary external hosts to Next.js image optimization;
- prefer a controlled media/storage policy or explicit allowlist before migrating user-controlled remote images to `next/image`;
- validate responsive image sizing, lazy loading and LCP behavior;
- check expensive directory/search queries and database indexes with real plans/data.

Acceptance: measurable improvements with no relaxation of content or network trust boundaries.

#### Stage 9 — Final UI consistency and accessibility pass

Verify every maintained route, not only the home page:

- semantic design tokens only;
- no legacy hard-coded palette regressions;
- RU/EN parity;
- dark/light parity;
- mobile overflow;
- minimum touch targets;
- keyboard reachability;
- visible focus;
- accessible names for icon-only controls;
- dialogs/popovers Escape behavior and focus behavior;
- meaningful empty/loading/error states;
- no fake checkout/payment terminology in closed beta.

Acceptance: browser acceptance passes for both locales, both themes and representative mobile/desktop sizes.

#### Stage 10 — Production Compose and startup verification

Validate production configuration without deploying publicly:

- production Compose renders with required secret/config inputs;
- placeholder/dev secrets are rejected;
- app startup performs migrations as designed;
- app health requires HTTP/database/private-storage readiness;
- PostgreSQL and ClamAV are not publicly exposed;
- Caddy/TLS edge headers remain fail-closed;
- backup and restore tooling works against production-shaped configuration;
- recovery/email configuration is explicit before claiming delivery is operational.

Acceptance: production startup/restart test passes in an isolated production-shaped environment.

#### Stage 11 — Exact-SHA release candidate verification

Only after Stages 1–10 pass:

1. choose the exact `main` SHA;
2. run all CI jobs successfully on that SHA;
3. run browser journeys on the same SHA;
4. collect release evidence;
5. verify branch count is exactly one;
6. verify documentation and version consistency;
7. review migration and backup impact;
8. review known issues and ensure none are silent blockers.

Do not bump the version merely because code was committed. Bump from `1.2.0-beta.3` only when a real verified release candidate exists.

#### Stage 12 — Release freeze and explicit deployment decision

Once a release candidate is verified:

- stop unrelated feature changes;
- create the release/tag only from the verified `main` SHA;
- record migration and rollback steps;
- record exact artifacts/images used;
- perform deployment only after an explicit human decision;
- run post-deployment health and critical-journey verification;
- keep rollback available until stability is confirmed.

A tag, merge or green local build alone does not authorize production rollout.

### 7.5 Non-negotiable product constraints

Codex must preserve these decisions unless the human owner explicitly changes them:

- `main` is the only maintained development branch;
- RU and EN are first-class interfaces;
- closed beta has no simulated paid checkout, balance, payout or crypto settlement;
- free acquisition must never silently bypass safe-build requirements;
- latest published trusted clean build is the downloadable artifact;
- scanner provenance is separate from cryptographic signing;
- MTA live server state comes from the official directory observation path, not stale editorial fields;
- server-control proof and moderator ownership approval remain separate concepts;
- authenticated/private data should not become publicly cacheable;
- production defaults remain fail-closed;
- no secret values are exposed by diagnostics;
- no arbitrary remote-image wildcard should be added just for convenience;
- schema/migration history should not be destructively rewritten merely to simplify current code;
- browser/client success state must remain server-authoritative.

### 7.6 Working style expected from Codex

For every substantial stage:

1. inspect the current `main` before editing;
2. identify the concrete defect or acceptance gap;
3. make the smallest coherent set of changes that closes the gap;
4. add or update stable tests;
5. execute the relevant verification when execution infrastructure exists;
6. commit directly to `main` with a descriptive message;
7. re-read the resulting exact SHA rather than assuming the ref moved correctly;
8. keep this document updated only when operational truth or the handoff plan materially changes.

Prefer one coherent finished update over dozens of cosmetic commits. Do not report a check as passed unless it actually executed.

### 7.7 Handoff completion definition

The handoff is complete when this documentation is committed to `main`.

At that point:

- the previous agent should make no further implementation decisions unless explicitly asked again by the human owner;
- Codex should begin at Stage 1 above;
- Codex owns continuation, debugging, verification and release preparation;
- the human owner retains the final decision for destructive data operations and production deployment.


### 7.8 Social-state verification slice

The follow and notification-read routes now return the server-confirmed target and resulting state. The server-follow control checks the target identity and state before showing a successful change; it does not treat HTTP 409 alone as proof. Notification read requests reject ambiguous bodies before any bulk update. The notification surfaces reload the inbox after a confirmed bulk change and discard older in-flight responses, so a concurrent notification is not silently marked read in the UI.

The verification approach for this slice is a small state matrix plus HTTP route tests: malformed bodies must not trigger bulk writes, an unrelated conflict must not confirm a follow, delivery failure after a committed follow must not report that follow as failed, and another user's notification must remain inaccessible. These checks cover observable behavior and are additive to browser acceptance. They are **not** release evidence until executed successfully against an exact current `main` SHA.

Next: restore executed CI jobs (the zero-step runner blocker), run the focused HTTP/state tests and then the full verification commands from Stage 2 on the same SHA. Validate desktop/mobile RU/EN follow and inbox flows in Stage 4. Branch cleanup in Stage 1 remains open until remote refs can be safely deleted after comparison.

### 7.9 Session revocation command integrity

Session revocation now accepts exactly one command: `{ "sessionId": "..." }` for a single owned non-current session, or `{ "allOther": true }` for every other session. Mixed, malformed and extra-key requests return 400 without a revocation. Responses identify the completed scope, and the Settings page verifies that scope and the exact session ID before showing success. The current session remains protected by the server-side check; use logout for it.

The focused HTTP tests cover the request matrix, ownership, current-session protection, anonymous and rate-limited calls, and private response headers. Execute them with the full account/browser and database verification on an exact `main` SHA before release acceptance.
