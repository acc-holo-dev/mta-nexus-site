# NEXUS MTA — Capability Audit

Capability matrix last reviewed: 2026-09-18
Verification snapshot refreshed: 2026-09-29
Target branch: `main`
Authority: `PRODUCT-BLUEPRINT.md` → executable behavior → historical plans

## Executive conclusion

The repository is a useful modular-monolith foundation, but it is not a complete
closed beta and is much further from product 1.0 than the historical
`PLAN-STATUS.md` wording suggests. The strongest implemented vertical is free
resource delivery. Server discovery, identity, moderation and content have
working foundations, while player retention, server ownership, creator
operations, community depth, localization and production operations remain
partial.

The audit uses four capability states:

- **working** — a coherent path exists with persisted data, authorization,
  failure handling and meaningful automated evidence;
- **partial** — useful behavior exists, but the documented user journey is not
  complete;
- **schema-only** — types/tables or isolated services exist without a complete
  supported user path;
- **absent/deferred** — intentionally unavailable or not implemented.

## Verification snapshot

| Check | Result | Meaning |
|---|---|---|
| TypeScript project build | Pass | `tsc -b` succeeds |
| Production Next.js build with Docker-equivalent env | Pass | Webpack production build compiles and generates the route table |
| Non-database test suite | Pass | 56 files and 124 tests passed on 2026-09-29; database integration suites are excluded |
| ClamAV protocol contract | Pass | 7 tests exercise INSTREAM framing, clean/malicious/error replies, scan-limit alerts, malformed replies and timeout against a local mock daemon |
| PostgreSQL integration tests | Not run on 2026-09-29 | PostgreSQL is unavailable locally; the database-backed suite still needs CI or a PostgreSQL environment |
| Docker image / Compose smoke | Not verified locally | Docker is not installed in the audit environment |
| Clean migration from empty PostgreSQL | Not verified locally | Must remain a CI/release gate |
| GitHub branch synchronization | Not verified locally | Origin requires credentials; local history is older than the last reported remote HEAD |

The local build and protocol tests ran with Node 24.19.0 and pnpm 11.25.0 while
the repository requires Node 26 and pnpm 12.4.2. Passing compilation is not
evidence that runtime database, real ClamAV or Docker journeys work. The blocked
checks must not be converted into `Pass` in release documents.

## Capability matrix

| Product area | State | Evidence in current tree | Missing for the Blueprint outcome |
|---|---|---|---|
| Account registration/login/session | working foundation | Auth routes, scrypt passwords, DB sessions, revocation, password change | Email verification/recovery, privacy controls, maintained-auth-framework decision, browser E2E |
| Authorization/context switching | partial | Capability policy and organization context checks | Inline role checks still exist; organization management is incomplete |
| Official MTA directory | working foundation | Bounded parser, cache, directory API and directory UI | Real fixture corpus, scheduled persistence, operational freshness monitoring |
| Editorial server profiles | partial | CRUD foundation, observation overlay, claimant UI, transactional moderator approval, report action and save/follow controls | Server news, review model, historical charts and browser E2E |
| Server observation persistence | partial | `server_observations`, endpoint matching and migration | Scheduled ingestion/retention and 24h/7d/30d aggregates |
| Free resource catalogue | working foundation | Published-only catalogue/detail, creator pages, recoverable drafts, protected metadata editing and saved-resource controls | Pagination depth, creator analytics and update center |
| Build upload/moderation | partial-to-working | Creator build history, private storage, early authorization, signature checks, scan state, pending review and retirement; local INSTREAM contract tests; production ClamAV configured to alert when scan limits are exceeded | Archive structure/decompression controls, operational proof against the deployed ClamAV daemon and immutable release contract |
| Free claim/download | working foundation | Transactional claim, entitlement check, private binary stream | Production storage/restore drill and browser E2E |
| Product reviews | working foundation | Entitlement gate, self-review prevention, DB uniqueness, atomic rating update | Moderation/edit/delete policy and user-facing report journey |
| Articles/content | partial | Draft/publish/archive, public-safe reads, comments/replies, moderation | Author editing, categories, richer discovery, complete linked-entity publishing |
| Community | partial | Topic creation/listing and comment foundation | Memberships, reactions, mentions, subscriptions, pin/lock, categories and moderation UX |
| Follows/notifications | partial | Follow graph, in-app notifications and preferences | Event coverage, deduplication policy, digests and useful “My MTA” return loop |
| Search/explore/home | partial | Bounded cross-domain search and public pages | Player-first activity read model, RU/EN copy boundaries, ranking evidence |
| Reports/verification/admin | partial | Queues, moderation actions and audit records | Appeals, evidence handling, full operator screens and immutable audit guarantees |
| Localization | absent | English strings are embedded in components | RU/EN routing, dictionaries, locale persistence and translated metadata |
| Accessibility/browser QA | absent as gate | Semantic components exist | Playwright journeys, keyboard/focus audit and accessibility checks |
| Paid commerce | intentionally disabled | Explicit free-only policy and disabled checkout | Legal/provider decision, webhooks, idempotency, reconciliation, refunds, payouts |
| Financial ledger | schema-only legacy foundation | `ledger_entries` and repositories exist | It is not a proven immutable balanced ledger; no user-facing money claims are allowed |
| Production operations | partial | Dockerfile, Compose, Caddy, health route and fail-closed env | Image/Compose smoke in CI, backup restore proof, rollback drill, structured incident runbook |

## Critical findings

### CAP-001 — Documentation overstates verified behavior

`ARCHITECTURE.md`, `STACK.md`, `SECURITY.md`, `PLAN-STATUS.md` and
`RELEASE-READINESS.md` contain claims that exceed the current implementation.
Examples include cryptographic license keys, hardware/server binding,
tamper-proof audit logs, a strictly append-only double-entry ledger, S3 support,
Argon2, installed ESLint/Prettier and completed Docker verification.

Action: treat this audit and the Blueprint as authoritative until the older
documents are rewritten or marked historical.

### CAP-002 — Database invariants lag behind TypeScript validation

Core statuses, roles, ranges and target relationships were unrestricted text or
unchecked integers. Application validation alone cannot protect migrations,
scripts or future repository callers.

Action in this wave: migration `0012_core_integrity_constraints.sql` adds role,
state, range, comment-target and perpetual-entitlement constraints. It fails on
invalid existing data instead of silently rewriting it.

### CAP-003 — Production auth UI exposed seed credentials

The login page prefilled an administrator address/password and rendered quick
demo personas in the production bundle.

Action in this wave: remove credential prefills and the demo switcher. Seed
credentials belong only in local development documentation, never public UI.

### CAP-004 — Release evidence is environment-dependent

The application build needs explicit production configuration and correctly
fails without it. Database tests need PostgreSQL. Docker behavior cannot be
claimed from a source inspection alone.

Action: CI must remain the clean-environment source of evidence and add a real
Compose smoke test, not only `docker build`.

### CAP-005 — Active roadmap labels are too optimistic

Wave 0 is not complete while documentation contradicts runtime behavior and
Docker smoke is absent. Waves 3–5 contain useful slices but do not meet their own
exit criteria. Wave 6 already has several completed items and should be tracked
as active rather than planned.

## Prioritized development order

### P0 — Truth and integrity

1. Keep all work on `main`; reconcile remote history before publishing.
2. Apply and verify migration 0012 against a copy of current data and an empty DB.
3. Rewrite overstated architecture/security/stack/release documents.
4. Add Compose smoke, migration-from-empty and two-run database verification.
5. Remove remaining public demo/prototype language and fake trust indicators.

### P1 — Complete vertical journeys

1. Prove observed server → claim request → moderator decision → owner editing through browser E2E.
2. Prove creator draft → metadata update → validated build → moderation → claim/download through browser E2E.
3. Topic/article → reply/follow → notification → moderation/report.
4. Player “My MTA” return surface driven by real followed-entity activity.

### P2 — Product breadth required by the Blueprint

1. RU/EN localization foundation.
2. Server news, observation history and honest freshness UX.
3. Community categories, subscriptions, reactions, mentions, pin/lock.
4. Creator editing, analytics and update notifications.
5. Browser E2E, accessibility and production recovery drills.

### Deferred gate

Paid commerce remains closed. Existing order/payment/ledger tables must not be
presented as a production financial system until provider, legal, webhook,
idempotency, reconciliation and payout requirements are independently proven.

## Definition of the next auditable milestone

The next milestone is complete only when:

- migration 0012 succeeds from empty and against current development data;
- the full database-backed test suite succeeds twice consecutively;
- Docker image and Compose smoke pass in CI;
- documentation no longer claims unsupported authentication, storage, ledger or
  deployment behavior;
- one server-owner claim journey and one creator publication journey pass through
  HTTP/browser tests without manual database edits.
