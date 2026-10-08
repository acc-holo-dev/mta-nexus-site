# MTA NEXUS Operations / Эксплуатация

This document covers development startup, verification and production boundaries.  
Документ описывает запуск разработки, проверки и эксплуатационные ограничения.

## 1. Supported DEV startup

Use the root `compose.yaml` directly when you want a Docker-only startup:

```bash
docker compose -p nexus-local -f compose.yaml up --build --detach --wait --wait-timeout 600
```

When Node.js 26+ and the pinned pnpm are installed, the supported convenience entrypoint is shown below. Host tooling is explicit: `.nvmrc` and `.node-version` pin Node 26.10.0, and `package.json#packageManager` pins pnpm 12.4.2. Use the repository version files before running host-side commands:

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

Both supported Compose stacks set `CLAMD_CONF_AlertExceedsMax=yes`. ClamAV otherwise treats some files skipped because of archive scan limits as clean. With this setting, NEXUS rejects incomplete scans before storage; deployments that provide their own ClamAV daemon must enable the same `AlertExceedsMax` directive. The build upload route counts streamed multipart bytes, so omitting `Content-Length` does not bypass its request-body limit. The file cap is shared by the API, storage, and browser UI; its multipart headroom is checked against the production proxy limit. If the initial build is rejected, the publishing form keeps the saved draft and retries the build against it instead of creating duplicate resources. If the resource-creation response is lost, retrying the same slug recovers the draft only when its metadata matches and the current author owns it. The retry identity survives a page refresh in the same tab; only the generated resource ID, slug and compatibility version target are stored in session storage. MTA sortable release targets such as `1.6.0-9.22279.0` are accepted consistently for resource compatibility and build metadata; the manifest inspector only copies a minimum into the shared form when its client/server scope is unambiguous, and warns in Russian and English when the declaration is missing, malformed, repeated, or conflicting. Its ACL and export previews show up to 20 manifest declarations as written without judging their policy or security. Run `pnpm test:scanner` to exercise INSTREAM framing, real TCP request/response handling, timeout and response limits, RU/EN resource creation and scan errors, duplicate-slug privacy, draft recovery and retry, scan-limit rejection, multipart size enforcement with and without `Content-Length`, proxy-limit alignment, manifest structure and localized version diagnostics, ACL/export previews, and version suggestions, plus accepted uploads without a running ClamAV database or PostgreSQL.

Source directories are bind-mounted read-only. Next.js uses polling in Docker so edits under `apps/web/src` and workspace `src` directories hot-reload. Package/dependency and image changes still require a rebuild.

Readiness:

```bash
docker compose -p nexus-local -f compose.yaml exec app node scripts/check-local-readiness.mjs
```

`pnpm dev:docker:check` requires both app readiness and push-worker liveness.
The app half checks HTTP health, database reachability and writable private storage;
the worker half validates heartbeat/progress and queue counters. With no VAPID triplet it remains
healthy-idle and performs queue maintenance; with all three VAPID values set it
dispatches durable Web Push jobs.

## 2. Verification

Moderators review complaints in `/admin`, under **Reports & moderation**. The default queue shows unresolved cases oldest first; **Decision history** shows completed cases newest first. Both views are paged (30 items). A decision requires at least three characters of review context. The report status and audit event commit together; a stale second decision returns HTTP 409. The private `GET /api/reports?view=pending&page=1` endpoint uses the same bounded queue, with `view=history` for completed cases. Run `pnpm test:reports` for focused checks. Do not interpret a notification delivery failure as a failed report submission: a stored complaint remains in the queue.

Модератор обрабатывает жалобы в `/admin` → **Жалобы и модерация**. По умолчанию открытые жалобы идут от старых к новым; история решений показывает последние закрытые случаи. В каждой странице 30 записей. Для решения необходим комментарий от трёх символов; статус и аудит сохраняются одной транзакцией. При повторном решении уже закрытой жалобы API возвращает 409. Быстрая проверка: `pnpm test:reports`.

The **Verification queue** on `/admin` follows the same 30 item paging model, oldest pending requests first and completed decisions in a separate history. Its count covers every pending request, including those beyond the current page. Moderators can open a submitted HTTP(S) proof link before deciding. Concurrent applications for the same target are serialized in the creation transaction; a second pending application receives 409. Submission queries moderator IDs directly for notifications; notification failure after a successful insert does not turn a saved application into a failed response. Run `pnpm test:verification` for focused checks without a database; run `pnpm test:verification:integration` with PostgreSQL available to verify the stale-target transaction behavior.

Очередь верификации в `/admin` показывает все ожидающие заявки постранично, от старых к новым; решения вынесены в историю. Счётчик учитывает все ожидающие заявки. Ссылка на доказательство доступна модератору. Одновременные заявки на один объект сериализуются в транзакции, повторная заявка получает 409. После сохранения заявки сбой уведомлений не превращает успешную подачу в ошибку. Быстрая проверка без базы: `pnpm test:verification`; DB-интеграционная проверка: `pnpm test:verification:integration`.

Resource builds awaiting review and community drafts on `/admin` also show the oldest work first in 30 item pages. Their totals come from dedicated count queries, so the moderator can tell when additional pages exist. Navigating one queue preserves the selected pages and views of the other queues. A draft card exposes its full text in an expandable section before a moderator publishes it. `pnpm test:moderation-queues` checks these read paths and the existing moderation controls. A draft is visible to moderators as soon as it is created; do not use the draft state to store private, unfinished work.

Build cards include the product title and publisher account from the same joined query as the review queue. Published products link to their public resource page; pending products remain labeled as unpublished. The reviewer can compare the full stored SHA-256 with the downloaded artifact response.

Сборки на проверке и черновики сообщества в `/admin` тоже идут от старых к новым, по 30 на страницу. Счётчики показывают общее количество, переход между страницами сохраняет положение в остальных очередях. Перед публикацией модератор может раскрыть полный текст черновика. Проверка: `pnpm test:moderation-queues`. Черновик сразу доступен модераторам; это состояние не подходит для личных незаконченных материалов.

Карточка сборки показывает название ресурса и аккаунт издателя из того же запроса очереди. Опубликованный ресурс открывается по ссылке; неопубликованный явно помечается. Полный SHA-256 можно сверить с заголовком скачанного файла.

When a functioning execution environment is available, the expected project verification path is:

```bash
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm check
pnpm release:verify
```

### Test and CI scopes

- `pnpm test:unit`: isolated unit/mock suites, at most four parallel workers; no database required.
- `pnpm test:database`: real DB/integration suites, sequential files against a disposable PostgreSQL database.
- `pnpm test:tooling`: standalone Node suites. Compose validators that require rendered JSON remain owned by their infrastructure harnesses.
- `pnpm test`: both Vitest projects; `pnpm check` and `pnpm release:verify` retain the full local release path.

Only `CI` starts on push/PR. Ordinary code changes run lint, types, both test projects,
one cached production-image build and a short registration/logout/directory browser smoke.
Browser and infrastructure consumers load the exact same SHA-labelled image; a missing
or mismatched transfer fails instead of rebuilding or pulling an unverified image.
The producer stores the one-run production tar in GitHub Actions Cache under an immutable
exact-SHA key, and every consumer restores that exact key before validating the image
revision label. This keeps build-once semantics without depending on GitHub Artifact
Storage quota or publishing a registry image. Ordinary code commits use six jobs,
including scope selection and the aggregate result. Full acceptance remains broader
and is intentionally reserved for infrastructure/release verification.

Full acceptance runs on `v*` tags, the manual **Run workflow → full=true** input, and
infrastructure/migration/database-tooling/dependency changes. Database migration helpers
under `packages/db/scripts/` are infrastructure because they can change upgrade or
recovery evidence even when no SQL file changes. It additionally runs SMTP/worker,
upgrade, persistence, backup/restore, DEV/production Compose and complete reusable
account/directory/resource browser suites. Each browser job retains its own fresh DB
and volumes. Browser startup skips repeated infrastructure-failure rehearsals; the
production infrastructure job owns those checks. Expensive production Compose waits for
the core unit/database/image gates so a known core failure does not consume another
production-shaped runner. Markdown-only changes to README/docs
run scope selection and the final status without Docker. `CI result` is the single
aggregate status: missing, failed, cancelled or skipped required jobs cannot pass.

Fast success is **not** full release acceptance. Evidence records `fast_ci`,
`full_acceptance` or `documentation` and the exact SHA; unit/database JSON reports
retain execution timings. Artifact uploads for diagnostics are best-effort on normal
branch/PR runs because external artifact-storage quota is not application correctness;
the same upload steps remain strict on release tags. Mandatory assertions and the
GitHub step summary remain authoritative even when optional artifact persistence is
unavailable. A release needs a successful full run for its exact SHA.


A workflow object with zero executed steps is infrastructure evidence, not an application test result. Release acceptance must name the exact tested `main` SHA.

For changes to the official MTA directory and search, run `pnpm test:directory` first. It checks parser boundaries, stale data, API filtering and pagination, RU/EN result labels, and balanced cross-category search without a local database. The API checks call the real route handler with a controlled directory response; the full `pnpm check` still requires PostgreSQL and is the release gate. A focused pass is not a release acceptance result.

For review and build-moderation changes, `pnpm test:resource` checks resource review HTTP boundaries, safe published-build selection and the moderation contract without PostgreSQL. It checks neither database transaction execution nor scanner integration; those remain in the full CI suite.

For changes to the free resource catalog and personal library, run `pnpm test:catalog`. It exercises RU/EN rendered navigation, HTTP parameters, safe-public SQL predicates, pagination bounds, saved ID batching, legacy-license access selection, scoped library reads and scalar admin counters with a controlled query layer. These tests do not execute PostgreSQL; use the full `pnpm check` and browser journeys against the exact `main` SHA before accepting a release. At the 1000-page navigation limit, deeper catalog browsing needs a later cursor-based path backed by live query plans and representative data.

For report and moderation intake, run `pnpm test:reports`. It calls the real route for private caching on allowed and denied reads, verifies that a report and its audit share a transaction, checks the duplicate lock and conflict response with a controlled query layer, and ensures notification failure after commit still returns the committed result. Complaint target IDs and evidence URL lists are bounded; notification recipient selection fetches moderator IDs only. Follow with database-backed concurrency and browser checks before release acceptance.

### Author editing recovery

The author resource editor preserves text in sessionStorage for the current actor and
resource, for up to 24 hours in the same tab. Archives are never persisted; a reload
requires selecting the file again. Malformed or mismatched mutation responses keep
the pending text and selected file. Metadata PATCH sends a quoted millisecond ISO
`If-Match` revision: the database checks management scope and revision atomically,
and stale writes return `409 PRODUCT_METADATA_CONFLICT` without an audit entry.
Refreshed metadata is adopted by a clean form; pending changes require an explicit
Restore/Discard choice. Successful metadata and build submissions clear only their
corresponding pending text. Full resource browser acceptance exercises this behavior.

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

Baseline for the owner-confirmed handbook integration:

- branch: `main`;
- implementation parent SHA: `b46905faae2385fb7dd3c58a6f8f9943fb84b554`;
- repository version: `1.2.0-beta.3`;
- development policy: work directly on `main`; do not create new long-lived development branches;
- production deployment remains a separate explicit human decision.

Product intent is now governed by `docs/handbook/13-DECISION-REGISTER.md` and
`docs/handbook/58-SOURCE-OF-TRUTH-AND-REPO-HANDOFF.md`. This Operations section
remains the canonical operational continuation/release plan. When approved target
product behavior differs from current closed-beta code, design a safe migration;
do not pretend the target is already implemented and do not silently discard the
owner-confirmed decision.

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
- the root `docs/` keeps Architecture, Operations and Problems as operational documents, while the owner-confirmed target specification is versioned under `docs/handbook/`.

### 7.3 Known release blockers at handoff

Codex must not mark the project release-ready until these blockers are closed.

#### A. Remote branch cleanup — RESOLVED 2026-09-29

~~GitHub currently exposes 61 branches~~ All non-`main` branches were deleted on 2026-09-29.

Executed cleanup (2026-09-29):

1. all 61 non-`main` remote branches were enumerated and verified against `main` (every branch was 4+ days stale and behind `main` by 175–409 commits);
2. a full recovery bundle of every branch was archived before deletion: `mta-nexus-site-all-branches-20260929-044934.bundle` (kept outside the repository, ~2.7 MB);
3. every non-`main` remote branch was deleted in batches (GitHub rejects single pushes with too many ref updates);
4. `git ls-remote --heads origin` now shows exactly one branch: `main`.

Restore path if a deleted branch is ever needed:

```bash
git clone /path/to/mta-nexus-site-all-branches-20260929-044934.bundle restored-repo
git switch <branch>
```

#### B. GitHub Actions execution failure

Recent exact-SHA workflow runs create jobs but execute zero steps: the jobs report `steps: []`. Checkout, lint, typecheck, tests and builds therefore never begin.

The latest observed CI run is [run 36398395028](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/36398395028) for commit `1f766c6ec295cf97e1150e92d7a4860ca9cde2b8`. Its retry (attempt 2) created five jobs, all failed before a step started with `runner_id: 0` and an empty runner name. Retrying did not restore execution. The available GitHub connector cannot read the protected Actions settings endpoint, so a repository or organization maintainer must inspect runner availability, Actions policy, and usage/quota in GitHub settings.

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

#### Stage 1 — Repository hygiene and single-main enforcement — DONE 2026-09-29

- ~~delete all non-`main` remote branches after the safety check above~~ — deleted 2026-09-29 (see 7.3.A);
- workspace metadata verified: no temporary planning or abandoned artifact files remain (`packages/db/src/seed-extra.ts` is an intentionally untracked local demo seed, kept out of git);
- `README.md`, the three operational root documents and `docs/handbook/` are the maintained prose surfaces; dated ad-hoc audit evidence still does not live in the repository (enforced by `tests/mainline-repository-policy.test.ts`);
- package manifests and workspace metadata consistent with the current beta version.

Acceptance: GitHub shows exactly one branch, `main`, and the repository documentation policy remains satisfied. ✅ Verified 2026-09-29.

#### Stage 2 — Restore deterministic verification — PARTIALLY DONE 2026-09-29

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

Progress 2026-09-29 (verified inside the local Docker development stack, Node 26.10 / pnpm 12.4.2):

- `pnpm typecheck` — green (0 errors);
- `pnpm test` — green: 198 files / 767 tests, including the previously broken root-level `tests/` suite (root `package.json` now declares `next` and `drizzle-orm` devDependencies so isolated pnpm layouts resolve them) and the account-mail capacity suites (they now reset the disposable queue before capacity assertions; `vitest.config.ts` serializes test files to remove cross-file queue races);
- `pnpm build` — green with production env vars (fail-closed config validation intentionally rejects `http://`/localhost production URLs);
- `pnpm test:isolated` (new) — green: full suite against a freshly recreated disposable `mta_nexus_test` database inside the local stack;
- `pnpm lint` — still red: 34 errors / ~149 warnings are documented with locations and remediation guidance in `docs/PROBLEMS.md` (P1-1);
- remaining blocker: GitHub Actions still cannot execute jobs (see 7.3.B) — `pnpm release:verify` must be re-run on restored CI runners.

Acceptance: all host-side verification passes on a named exact SHA. ⚠️ Blocked only by lint debt (documented) and the CI runner outage.

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

#### Stage 4 — Browser acceptance in RU/EN and light/dark themes — DONE 2026-09-29

Use an actual browser against the running application. Test desktop and narrow mobile viewports.

Executed 2026-09-29 with a real (containerized Chromium + Firefox) browser:
guest → registration → claim → download → publish → ClamAV scan → admin
moderation → download of the newly approved resource, plus RU/EN, light/dark,
global search/discovery, mobile 390px and 404. Found issues are tracked in
`docs/PROBLEMS.md` (P1-2 no-h1, P2-1 external resources, P2-2 dev hostname,
P2-3 seed files); three UX defects were fixed in commit `b33371a`.

Minimum journeys:

1. landing/home and global navigation;
2. locale switch RU ↔ EN;
3. light ↔ dark theme;
4. ordinary global search and `/discover` section navigation;
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

Progress 2026-10-07: the current audit slice makes author resource metadata/build/retire writes use one enforced `same-origin` + `no-store` request policy while retaining exact metadata/build/retirement response confirmation. Build, quarantine, content, verification and report moderation clients now confirm the returned `targetId` and `action` instead of accepting a generic `success: true`. Server registration confirms exact `201 + slug + id`, and server edits confirm the same server plus core returned name/IP/port/visibility before showing success. The reviewed mutation routes already return private/no-store responses. Stage 5 remains open for the remaining client families; do not interpret this slice as a complete mutation inventory.

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
- recovery/email configuration is explicit before claiming delivery is operational;
- optional `MTA_MASTER_MIRROR_URLS` contains at most three comma-separated public HTTPS FQDN endpoints; the official MTA master remains first, mirrors are fallback-only, and the full cascade shares one 10-second budget while retaining the same 8 MiB/parser/EOF safety contract;
- optional Web Push VAPID configuration is either fully absent or contains a valid public P-256 key, private P-256 scalar and `mailto:`/HTTPS subject together; production Compose passes the triplet to both web and `push-worker` without exposing the private key in logs or client payloads;
- migration `0030_web_push_outbox.sql` is applied before `push-worker` starts; inbox notifications enqueue one job per active subscription, with a global queue gate/capacity;
- `push-worker` is a separate production process with lease ownership, max 5 attempts, deterministic backoff, terminal 404/410 subscription cleanup, 24-hour job TTL and graceful shutdown;
- worker liveness is checked through `scripts/check-web-push-worker-health.mjs`; a stale/malformed heartbeat, impossible queue counters or hard saturation fail closed, while a fully unconfigured VAPID setup remains healthy-idle and continues expired-job maintenance;
- operational backlog alerting is separate from liveness: the heartbeat contains only aggregate `queueAlert`, reasons and thresholds, and `scripts/check-web-push-worker-queue.mjs` returns exit 0 for OK, 2 for an alert and 1 for an invalid/stale heartbeat;
- if an inbox notification commits but its outbox savepoint is saturated or fails, the server emits an aggregate `notification.push_outbox_degraded` warning containing counts and a non-user producer name only; it never logs recipient IDs, notification text, links, subscription endpoints or VAPID material; build-review recipients use independent savepoints so one queue-local failure cannot erase another recipient's durable job;
- default alert thresholds are 80% queue capacity, 100 due jobs and 900 seconds oldest active job; production can override them with `WEB_PUSH_QUEUE_ALERT_PENDING_PERCENT`, `WEB_PUSH_QUEUE_ALERT_DUE_JOBS` and `WEB_PUSH_QUEUE_ALERT_OLDEST_AGE_SECONDS`;
- queue operations never expose endpoint capability URLs or notification bodies in worker health/log events.

Acceptance: production startup/restart test passes in an isolated production-shaped environment.

Web Push operational checks for a production-shaped host:

Run the aggregate queue probe from the worker container and wire any non-zero exit into the external monitor:

```bash
docker compose -f compose.production.yaml exec -T push-worker \
  node /app/scripts/check-web-push-worker-queue.mjs
```

Exit 0 means the queue is within policy, exit 2 is an operational alert, and exit 1 means the heartbeat/configuration itself is invalid or stale. The worker emits one `queue-alert` event when the reason set changes and one `queue-recovered` event after recovery, so log-based alerting does not spam every poll.

1. Confirm `push-worker` liveness separately from the HTTP app; do not use backlog pressure as a reason to restart the HTTP service.
2. Inspect only aggregate heartbeat fields: `configured`, `queuePending`, `queueDue`, `queueLeased`, `queueCapacity`, `queueOldestAgeSeconds`, `queueAlert` and reasons.
3. If VAPID is intentionally disabled, `configured=false` is valid only while no active jobs remain; pending durable jobs produce `delivery_disabled_with_pending_jobs`.
4. `capacity_pressure`, `due_backlog` or `oldest_job_age` means the provider/DNS/network/configuration path needs investigation. Thresholds are explicit configuration, not automatic restart triggers.
5. A 404/410 from a push provider removes the stale subscription and cascades its queued job. Transient transport failures and 408/425/429/5xx are retried; other 4xx are discarded without deleting the subscription.
6. Do not manually replay accepted jobs: successful settlement deletes the endpoint-specific row. One notification with multiple browser subscriptions intentionally creates independent jobs.

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
8. keep this document updated when operational truth or the release plan materially changes; update the handbook Decision Register/source-of-truth chapters when owner-confirmed product truth changes.

Prefer one coherent finished update over dozens of cosmetic commits. Do not report a check as passed unless it actually executed.

### 7.7 Handoff completion definition

The handoff is complete when the owner-confirmed handbook and this operational
documentation are committed to `main`.

At that point:

- AI implementation work starts by reading the handbook Decision Register and source-of-truth rules, then inspecting current `main`;
- the operational stages in this document remain the release/verification sequence;
- AI agents may make reversible `PROVISIONAL` technical choices within the handbook boundaries;
- the human owner retains final control over destructive data operations, real payment activation and production deployment.


### 7.8 Social-state verification slice

The follow and notification-read routes now return the server-confirmed target and resulting state. The server-follow control checks the target identity and state before showing a successful change; it does not treat HTTP 409 alone as proof. Notification read requests reject ambiguous bodies before any bulk update. The notification surfaces reload the inbox after a confirmed bulk change and discard older in-flight responses, so a concurrent notification is not silently marked read in the UI.

The verification approach for this slice is a small state matrix plus HTTP route tests: malformed bodies must not trigger bulk writes, an unrelated conflict must not confirm a follow, delivery failure after a committed follow must not report that follow as failed, and another user's notification must remain inaccessible. These checks cover observable behavior and are additive to browser acceptance. They are **not** release evidence until executed successfully against an exact current `main` SHA.

Next: restore executed CI jobs (the zero-step runner blocker), run the focused HTTP/state tests and then the full verification commands from Stage 2 on the same SHA. Validate desktop/mobile RU/EN follow and inbox flows in Stage 4. Branch cleanup in Stage 1 remains open until remote refs can be safely deleted after comparison.

### 7.9 Session revocation command integrity

Session revocation now accepts exactly one command: `{ "sessionId": "..." }` for a single owned non-current session, or `{ "allOther": true }` for every other session. Mixed, malformed and extra-key requests return 400 without a revocation. Responses identify the completed scope, and the Settings page verifies that scope and the exact session ID before showing success. The current session remains protected by the server-side check; use logout for it.

The focused HTTP tests cover the request matrix, ownership, current-session protection, anonymous and rate-limited calls, and private response headers. Execute them with the full account/browser and database verification on an exact `main` SHA before release acceptance.

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
docker compose -p nexus-local -f compose.yaml exec app pnpm db:seed
docker compose -p nexus-local -f compose.yaml exec app pnpm db:seed
# Only after inspecting a reported legacy demo metadata mismatch:
docker compose -p nexus-local -f compose.yaml exec app pnpm db:seed:repair
# Optional cleanup for exact old Unsplash/DiceBear values written by the seed:
docker compose -p nexus-local -f compose.yaml exec app pnpm db:seed:repair-media
```

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
remain in [PROBLEMS.md](PROBLEMS.md).

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
service connectivity or runtime/browser acceptance. On 2026-10-03 the explicit
Webpack build passed locally using test-only configuration and no live database.

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

### Acceptance evidence

Select one exact `main` commit and wait for **CI**, **Resource browser**,
**Account browser**, and **Directory browser** to succeed on that commit.
Keep these CI artifacts outside the runner before their 14-day retention expires:

| Evidence | What it proves |
| --- | --- |
| `core-release-evidence-<sha>-<attempt>` | Repository identity, migrations, lint, types, tests, default production build |
| `release-upgrade-<sha>-<attempt>` | Real Drizzle upgrade from schema 0024 to 0030; failed DDL and ledger rollback; retry; idempotency; legacy rows and new structured notifications |
| `backup-restore-<sha>-<attempt>` | Destroyed synthetic source restored into new owned volumes; schema, migration ledger, author, resource, trusted build, entitlement, notification and uploads preserved |

Require `status: "PASS"`, the intended `sha`, and all verification/cleanup flags
to be true in the upgrade and restore reports. A downloaded report alone is not
success. These reports extend the core release evidence; they are separate required
workflow steps, not additional gates silently inferred by the core JSON summary.

The upgrade fixture intentionally pins 0024 → 0030 and fails when another migration
is added. It verifies the Support tables, Web Push subscriptions, durable outbox
tables/indexes, queue-gate seed, legacy-row preservation, rollback/retry and
idempotent rerun. Review and extend it with the next release's old-schema fixtures
and data-changing effects. Its injected failure is synthetic and is appended to
migration 0027 after that migration's real SQL, within Drizzle's transaction.
It proves database rollback/retry,
not recovery from host failure or compatibility of an older application image.
Backup acceptance uses synthetic data and the production PostgreSQL/storage
topology; rehearse separately against a protected copy of the target dataset.

### Before maintenance

1. Record the target hostname, current project name, application image ID/digest,
   deployed commit, PostgreSQL major version and actual volume names/mount targets.
   Keep the old application image and its original checkout/Compose/proxy files.
   Save the image with `docker image save` if it is not available from a registry.
2. Record `SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id`
   from the target database. Review pending SQL against this inventory. Do not edit
   applied SQL or its journal. Migration 0025 adds nullable structured notification JSON; migrations 0028-0030
   then add Support storage, session-bound Web Push subscriptions and the durable
   Web Push outbox/queue gate. Existing notification title/message/read state
   remain the fallback.
3. Review older pending migrations too: 0020 retires unsafe legacy builds and can
   return products to draft; 0024 normalizes `tool` and rejects unknown types.
   This runbook does not cover a PostgreSQL major-version or storage-layout change.
4. Build the candidate from the selected commit before downtime, using an immutable
   image tag/digest. Retain the matching configuration privately, including recovery
   mail encryption keys needed to read any existing outbox. Do not rotate secrets
   as part of a routine update or put them in release artifacts.
5. Restore a recent database dump and uploads archive to an isolated installation,
   apply the candidate, and check real representative accounts/resources there.
   Disable real outbound mail and keep it away from public traffic.

### Consistent backup and update

Schedule a maintenance window. Stop public ingress, the app, and every enabled
writer (including the optional account-mail worker and external jobs). Keep
PostgreSQL running for the dump. Capture the app container ID before stopping it;
the stopped container must remain available for its uploads mount.

Example backup commands below require operator-selected values. `PRODUCTION_ENV`
is an absolute protected environment-file path; `RELEASE_DIR` is the existing
deployment checkout; `PROJECT` is its unchanged Compose project name.
`BACKUP_DIR` must be a new private directory outside the upload/database volumes.

```bash
set -eu
umask 077
dc() {
  docker compose --env-file "$PRODUCTION_ENV" --project-name "$PROJECT" \
    --file "$RELEASE_DIR/compose.production.yaml" "$@"
}
app_id=$(dc ps --quiet app)
postgres_id=$(dc ps --quiet postgres)
test -n "$app_id"
test -n "$postgres_id"
old_image=$(docker inspect --format '{{.Image}}' "$app_id")
postgres_image=$(docker inspect --format '{{.Image}}' "$postgres_id")
mkdir -m 700 "$BACKUP_DIR"
dc stop caddy push-worker app
# Stop any additional enabled writer services/jobs (for example the optional
# account-mail worker override) using their actual configured names too.
# Proceed only after every writer is stopped.
docker exec "$postgres_id" sh -eu -c \
  'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-privileges' \
  > "$BACKUP_DIR/database.dump"
docker run --rm --network none --entrypoint tar \
  --volumes-from "$app_id:ro" "$postgres_image" \
  -C /data/uploads -czf - . > "$BACKUP_DIR/uploads.tar.gz"
test -s "$BACKUP_DIR/database.dump"
test -s "$BACKUP_DIR/uploads.tar.gz"
printf '%s\n' "$old_image" > "$BACKUP_DIR/previous-app-image.txt"
(cd "$BACKUP_DIR" && sha256sum database.dump uploads.tar.gz > SHA256SUMS)
```

Retain the dump, uploads, image and matching protected configuration together.
Checksums detect accidental changes; they do not replace a successful restore.
If any backup command fails, do not start the candidate. A `pg_dump` alone cannot
keep database build records and files consistent while uploads continue writing.

Use a reviewed Compose override that sets the candidate `app.image` to its retained
immutable image. Start it with `up --detach --no-build --pull never --wait
--wait-timeout 300 app` while ingress stays stopped. Include the same override in
every command. The image entrypoint applies migrations before starting HTTP;
an app restart can retry migrations, so stop a repeatedly failing candidate before
investigating. Do not use `down --volumes`, `volume prune` or `db:seed` on this host.

After app readiness succeeds, check `node scripts/check-local-readiness.mjs`
inside the app, compare the migration ledger to the candidate journal, and verify
the expected resource/build/entitlement/notification counts and upload checksums.
Start the production push worker with the same candidate and retained VAPID
configuration, then require its liveness probe to pass. If Web Push is configured,
also run the queue probe and resolve any alert before restoring ingress:

```bash
dc up --detach --no-build --pull never --wait --wait-timeout 300 push-worker
dc exec -T push-worker node /app/scripts/check-web-push-worker-health.mjs
dc exec -T push-worker node /app/scripts/check-web-push-worker-queue.mjs
```

Start any additional enabled workers (for example account mail) with the same
candidate and retained secrets. Restore ingress only after these checks, then
verify through HTTPS:

- login, session revocation and the configured recovery-mail path;
- catalog, existing free acquisition and a downloaded file's length/SHA-256;
- author metadata edit, new upload, trusted scan and moderation notification;
- RU/EN workspace and inbox, plus the official server-directory path.

An unconfigured email provider is not successful delivery. If a critical flow
fails, return to maintenance and select recovery before allowing new writes.

### Recovery decision

For an additive migration, returning to the old image may be possible only after
checking that image against the upgraded schema and current data in isolation.
The CI upgrade fixture does not prove old-image compatibility. Never delete a
migration-ledger row or drop the new column merely to make the old version start.

When image-only rollback is unverified or the migration changed data, recover
the **paired pre-update database and uploads**, with their matching old image and
configuration, into **new empty volumes** under a separate recovery project.
Keep the failed installation stopped and retain its volumes for investigation.

1. Verify `SHA256SUMS` and the backup identity. Start only the recovery PostgreSQL
   service on its empty volume, using the original PostgreSQL major version.
2. Restore the custom dump with `pg_restore --exit-on-error --no-owner
   --no-privileges` into that empty database. Stop on any error; do not use
   `--clean` against the failed or an unknown database.
3. Extract the paired archive into the recovery project's empty uploads volume,
   preserving file ownership. Confirm storage keys, lengths and hashes against
   restored build rows and compare the restored migration ledger to the backup.
4. Start the retained old app/worker with that restored database and storage and
   the old configuration; repeat readiness and HTTPS critical journeys. Route
   ingress to the recovery installation only after verification.
5. Document any writes made after the backup: restoring a snapshot loses them.
   Keep that interval empty through maintenance, or plan explicit reconciliation.

Do not copy a raw PostgreSQL volume between major versions. Preserve both the
failed volumes and the backup until the recovered installation is confirmed stable.


## Large portfolios and streaming download acceptance

Migration `0026_public_portfolio_indexes` adds partial author/organization resource
indexes and a published organization-content index with the same ordering as the
public pages. It changes no rows. Index creation runs in the migration transaction
and can block writers; include it in the maintenance window and rehearse on a
restored target dataset before deployment. The upgrade rehearsal still starts from 0024, injects a rollback failure in
0027, and then verifies a clean retry through the current 0030 target, including
the 0025-0026 portfolio/notification changes and the 0028-0030 Support/Web Push
schema additions.

The Verify job executes the real portfolio repositories against temporary tables
with 10,128 resources, 10,127 builds and 10,025 articles. It captures representative
EXPLAIN ANALYZE/BUFFERS plans before and after the new indexes. Retrieve
`portfolio-query-plans-<sha>-<attempt>` within 14 days; timings are synthetic,
warm-cache observations, not a production latency guarantee. The test does not
force planner settings. Public filtering, deterministic equal-date ordering and
deep/stale pages are verified independently through the repository methods.

Resource browser acceptance covers guest RU/EN developer, user and organization
portfolios with 125 safe resources and 25 articles at 390 and 1280 pixels, including
resource/article page preservation and excluded draft/paid/unsafe/foreign rows.
Its report includes screenshots and portfolio JSON. After the browser journeys,
a Node HTTPS client creates a real account and claim, breaks three actual TLS/TCP
connections during delivery, retries with exact byte/hash verification, and runs
four throttled 64 MiB downloads concurrently. The report records HTTP-process
RSS baseline/peak and enforces a 128 MiB growth regression budget. It does not
measure browser memory, total container page cache, interruption during hashing,
or production capacity. Browser evidence is retained for three days.

Both public and reviewer downloads now count the Web Stream queue in bytes with
a 64 KiB high-water mark. This preserves backpressure for slow clients rather
than allowing thousands of binary chunks to accumulate. Source cancellation
still closes the underlying stream. Full pre-response hashing remains required;
measure its disk/latency cost on the deployment host.

### Author creation recovery and response confirmation

The new resource page authenticates on the server and scopes the client form to
the current actor. It confirms a draft creation response against the submitted
metadata and actor; recovery of an identical existing draft requires the explicit
`200`/`reusedDraft: true` contract. A build is successful only on a confirmed `201`,
or an explicit `200`/`reusedBuild: true` recovery response, for the same resource,
version and `pending_review` status. Ambiguous responses retain the selected file,
version and notes for a retry.

If an upload committed but its response was lost, repeating the same upload can
recover the original pending build. The server rechecks release permission and
compares the stored SHA-256, size, safe filename, canonical MIME type, notes and
MTA target version. Recovery requires a clean scan with scanner identity and time;
reviewed versions and different uploads still return `409 BUILD_VERSION_EXISTS`.
The new upload asset is removed before the recovery lookup. Recovery adds no build,
audit event or notification and returns only build identity, version and status.
The browser acceptance test hides real committed creation and upload responses
and verifies both retries against the real database and storage. Slug and build
version conflicts recognize PostgreSQL errors wrapped by Drizzle and only the
corresponding named unique constraints; unrelated persistence errors remain failures.

Pending resource identity uses actor-scoped session storage with a 24-hour TTL.
Legacy records without an actor are discarded. Switching accounts in the same tab
does not restore another author's record; returning to the original account can
resume its unexpired attempt. Reloads require selecting the archive again.
Only the already-created resource identity and MTA target version are persisted,
not the archive or the complete form. Successful submission opens the private
workspace resource page, where pending review resources remain accessible.


### Worker liveness vs progress

Production delivery workers distinguish process heartbeat from dispatcher progress.
A fresh health-file heartbeat is not sufficient if the main dispatch loop has
stopped completing batches. Web Push uses a 180-second progress watchdog.
Account mail uses a minimum 180-second watchdog that scales with configured
batch size and SMTP timeout. If progress exceeds that budget, the worker exits
non-zero so the container restart policy can recover it; durable leases/outbox
rows remain authoritative and are reclaimed after expiry.


### Push worker container hardening

The production Web Push worker uses the same approved runtime image as the web
application but runs as an isolated non-root service with a read-only root
filesystem, a small noexec/nosuid/nodev tmpfs for health state, all Linux
capabilities dropped, no-new-privileges, a bounded PID limit, SIGTERM and a
75-second graceful-stop window. CI production smoke renders the real Compose
configuration, pins the push worker to the exact prebuilt commit image, disables
restart only for the disposable test project, and asserts these runtime
isolation properties before acceptance continues.
