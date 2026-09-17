# Nexus Foundation Audit

Status: baseline approved for development  
Branch: dev  
Baseline commit: 60f61cf186ee9b23af8ad613cc8a80ed6383bde1  
Audit date: 2026-09-16

## Purpose

This document is the source of truth for the transition from the current prototype to a trustworthy player-first MTA:SA platform.

The current repository is a promising foundation, but it is not production-ready and must not be represented as a finished commercial platform. Existing plan completion labels describe implementation breadth, not verified release readiness.

No feature is considered complete because a page, route, table, or service exists. Completion requires a real user journey, persisted state, authorization, failure handling, and automated verification.

## Product decision

The primary user is the MTA:SA player.

The primary product question is:

> What is happening in MTA right now, and where should I go next?

The initial product pillars are:

1. Player discovery and identity.
2. Server directory, live state, news, follows, and verified reviews.
3. Community activity connected to servers and resources.
4. Free resource publishing and secure delivery.
5. Paid commerce only after the free end-to-end flow is proven.

## Architecture decision

Keep:

- Next.js App Router and React.
- TypeScript.
- PostgreSQL.
- Drizzle.
- pnpm workspace monorepo.
- Modular monolith.
- Tailwind and the existing design-system direction.

Do not introduce without measured need:

- Microservices.
- Kafka.
- Elasticsearch.
- GraphQL.
- Kubernetes.
- A separate API service.
- Redis as a general-purpose dependency.

The main problem is not the selected stack. The main problem is correctness and the gap between documentation and executable behavior.

## Critical findings

### FND-001: database failures are converted into success

Multiple repositories catch database errors and return fabricated entities, empty arrays, false, or zero.

Evidence includes:

- packages/db/src/repositories/orders.ts
- packages/db/src/repositories/payments.ts
- packages/db/src/repositories/ledger.ts
- packages/db/src/repositories/sessions.ts
- packages/db/src/repositories/entitlements.ts

Impact:

- an order can appear created when no row exists;
- a payment can appear completed when persistence failed;
- ledger entries can appear appended when they were not;
- tests can produce misleading results;
- operational failures are hidden.

Decision:

- write operations must fail loudly;
- expected absence and infrastructure failure must be distinct;
- errors must use a canonical application error model;
- no repository may fabricate a successful write result.

Release gate:

- database-unavailable tests prove that mutations fail and never issue licenses or success responses.

### FND-002: checkout is a sandbox simulator exposed as commerce

The checkout service creates an order, immediately records a completed mock payment, marks the order completed, posts ledger rows, and provisions licenses in one request.

Impact:

- paid products can be acquired without a real provider confirmation;
- duplicate requests can create duplicate orders and licenses;
- provider-supplied payment state is not authoritative;
- there is no durable idempotency key.

Decision:

- sandbox payment completion must be development-only;
- production checkout creates a pending order and provider payment intent;
- entitlement is granted only after a verified, idempotent provider event;
- free products use a separate explicit free-acquisition flow.

### FND-003: commerce is not atomic

Order creation, items, payment, order completion, ledger postings, product counters, licenses, entitlements, audit events, and domain events do not share a transaction.

Impact:

- partial purchases;
- licenses without correct settlement;
- completed orders without entitlements;
- inconsistent counters and ledger.

Decision:

- define explicit transaction boundaries;
- use database transactions for state transitions;
- use durable idempotency for financial mutations;
- use an outbox only when post-commit work becomes necessary.

### FND-004: multi-seller accounting is incorrect

The current checkout credits seller earnings to the author of the first product, even when an order contains products from multiple authors.

Decision for MVP:

- one resource per checkout;
- one seller per order;
- multi-seller cart is postponed until settlement is designed per immutable order line.

### FND-005: ledger claims exceed implementation

The current ledger stores caller-provided balanceAfter values and does not enforce double-entry groups, account ownership, balanced transactions, append-only behavior, or idempotency at the database level.

Decision:

- do not expose a buyer stored-value wallet in the MVP;
- seller earnings are platform liabilities derived from settled order lines;
- ledger redesign must use transaction identifiers, accounts, entries, directions, unique constraints, and balanced posting validation;
- payout requests are introduced only with a real payout policy.

### FND-006: S3 configuration silently falls back to local storage

Selecting STORAGE_PROVIDER=s3 instantiates LocalStorageProvider.

Impact:

- production may start with a false configuration;
- files may be written to ephemeral application storage;
- documentation promises behavior that does not exist.

Decision:

- unsupported provider configuration must stop startup;
- implement a real S3-compatible provider;
- local storage remains development-only;
- production uses private object storage and short-lived authorized delivery.

### FND-007: binary delivery is incomplete

The download route returns metadata and an unpersisted deliveryToken. It does not stream the archive or issue a real signed URL.

Decision:

- delivery tokens must be durable, scoped, expiring, and single-purpose, or replaced by provider-signed URLs;
- entitlement, product status, build status, license status, and revocation are checked at delivery time;
- private storage keys are never returned to the client.

### FND-008: upload security is incomplete

Current validation trusts extensions and accepts the whole file in memory.

Decision:

- stream uploads with strict byte limits;
- use opaque object keys;
- verify magic bytes where applicable;
- inspect archive structure and impose decompression limits;
- separate media and executable/resource artifact policies;
- persist upload state and checksum before publication.

### FND-009: configuration is not fail-closed

Production-sensitive values have development defaults, including database and authentication configuration.

Decision:

- defaults are allowed only in development and test;
- production startup must reject placeholder secrets, local storage, invalid public URLs, and incomplete provider configuration;
- configuration documentation must be generated from or checked against the runtime schema.

### FND-010: authentication is only a foundation

The custom authentication implementation has password login and database sessions, but lacks verified email, password reset, session management UI, session rotation policy, account recovery, and provider identities.

Decision:

- evaluate migration to a maintained authentication framework before public beta;
- preserve Nexus domain roles and organization permissions outside the auth library;
- store only hashed session credentials when practical;
- record device/session metadata and allow revocation.

### FND-011: rate limiting trusts deployment assumptions

The in-memory limiter is process-local, resets on restart, and uses forwarded IP data without a documented trusted-proxy policy.

Decision:

- single-instance beta may use a memory limiter only behind a correctly configured trusted proxy;
- security-critical rate limits must have an explicit production implementation before public registration;
- Redis is not required until deployment topology demands it.

### FND-012: database invariants are insufficient

Many statuses and types are unrestricted text. Important uniqueness and range constraints are missing.

Examples:

- duplicate entitlement grants;
- duplicate product versions;
- duplicate provider transaction identifiers;
- duplicate reviews;
- negative prices or sizes;
- invalid rating and player counts;
- impossible state values.

Decision:

- enforce business invariants in both application and database;
- prefer check constraints and unique indexes for correctness-critical rules;
- migration tests must start from an empty database.

### FND-013: automated tests do not prove release readiness

Current tests are useful foundations but do not cover complete HTTP and browser journeys. Several tests assert repository facts while comments claim API behavior.

Decision:

Testing layers:

1. unit tests for pure policies and state machines;
2. integration tests against an isolated PostgreSQL database;
3. API tests through route handlers or HTTP;
4. Playwright journeys for player, server owner, creator, moderator, and later buyer;
5. concurrency tests for idempotency and financial transitions.

Tests must clean up their own data and fail when required infrastructure is unavailable.

### FND-014: creator and server-owner workflows are incomplete

The repository has read surfaces but lacks complete production workflows for:

- creator onboarding;
- product creation and editing;
- build upload and publication;
- server creation and ownership verification;
- organization/team management;
- profile management.

Decision:

Do not add more read-only showcase pages before the core write journeys exist.

### FND-015: documentation is not evidence

STACK.md, DEPLOYMENT.md, STORAGE.md, README.md, and plan status documents contain claims not supported by dependencies or runtime behavior.

Decision:

- documentation describes only verified behavior;
- planned behavior is marked planned;
- every release claim links to code and an automated verification path.

## Financial boundary

The platform distinguishes:

1. Seller receivable: money owed to a seller after settlement.
2. Non-withdrawable promotional credit: optional future bonus value.
3. Buyer stored-value wallet: postponed.

The MVP does not accept general wallet top-ups and does not allow user-to-user balance transfer.

Crypto payments, if enabled, are handled by an external invoice provider. Nexus does not operate a hot wallet.

The jurisdiction, provider contracts, tax treatment, seller onboarding, refunds, disputes, and payout eligibility must be decided before production commerce.

## Budget boundary

Target infrastructure budget: USD 20-30 per month before meaningful revenue.

Initial topology:

- one application deployment;
- one PostgreSQL instance;
- private S3-compatible object storage;
- transactional email provider;
- CDN/edge proxy where available;
- no Redis unless required;
- no separate analytics stack;
- structured logs and basic uptime monitoring.

## Release phases

### Phase 0: Truth and safety

- make CI deterministic;
- remove fabricated repository success;
- introduce canonical errors;
- make production configuration fail-closed;
- reconcile documentation with code;
- add clean-database verification.

### Phase 1: Player foundation

- useful home activity;
- server discovery;
- player profiles;
- follows and notifications;
- public browsing without registration;
- English and Russian localization foundation.

### Phase 2: Server platform

- server creation;
- ownership claim;
- official MTA master-list observations;
- news and updates;
- follow notifications;
- verified review eligibility.

### Phase 3: Free resource platform

- creator onboarding;
- resource CRUD;
- build upload and validation;
- version publication;
- compatibility metadata;
- secure free acquisition and download.

### Phase 4: Closed beta

- real servers;
- real creators;
- real players;
- feedback and observability;
- performance and abuse review.

### Phase 5: Commerce

- provider adapters;
- crypto invoices where legally and operationally valid;
- webhook verification;
- idempotent settlement;
- refunds;
- seller receivables;
- controlled payouts.

### Phase 6: External server integration (deferred)

NEXUS does not require Lua, C++, config.lua, heartbeat agents, or runtime code on third-party servers. Future integrations may be evaluated separately only after the player-first platform and operational model prove themselves.

## Definition of foundation complete

The foundation phase is complete only when:

- main remains untouched;
- dev CI is green from a clean environment;
- database write failures cannot report success;
- all critical state transitions are transactional;
- production configuration rejects unsafe defaults;
- documentation matches the runtime;
- an anonymous player can browse useful real data;
- automated tests cover at least one real player journey;
- no paid entitlement can be issued without an explicit free flow or verified provider event.
