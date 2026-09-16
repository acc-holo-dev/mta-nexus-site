# Legacy-to-Nexus Migration Map

Status: active migration reference  
Target repository: acc-holo-dev/mta-nexus-site  
Target branch: dev  
Reference repository: acc-holo-dev/mta-market-platform  
Created: 2026-09-16

## Rule

The legacy repository is a reference implementation, specification source, and test corpus. It is not merged wholesale.

Every legacy capability receives one of four decisions:

- ADAPT: reimplement the proven behavior in the Nexus architecture.
- KEEP-AS-REFERENCE: retain contracts or tests as design evidence.
- POSTPONE: valid long-term capability that is outside the current MVP.
- REJECT: unnecessary complexity or an unsuitable implementation choice.

Code is copied only after dependency, security, licensing, and architecture review. Behavior and tests are more valuable than file-for-file transfer.

## Product direction to recover

### ADAPT

From the legacy product documents:

- player-first discovery;
- the home question: what is happening in MTA right now;
- servers, community, news, and resources as the early-stage priorities;
- guest discovery before registration;
- follow to notification to return loop;
- server privacy and explicit opt-in for public technical information;
- verified server reviews;
- public high-value activity instead of noisy event feeds;
- explicit trust signals instead of a single unexplained trust score.

Primary references:

- documents/product/VISION.md
- documents/product/DAILY-EXPERIENCE.md
- documents/product/PRODUCT-ARCHITECTURE.md
- documents/product/PRODUCT-MODEL.md

Target:

- docs/PRODUCT-VISION.md
- apps/web player-facing routes
- server and activity domain services

## Migration matrix

| Legacy capability | Decision | Nexus target | MVP phase | Notes |
| --- | --- | --- | --- | --- |
| Product vision and daily experience | ADAPT | docs/product | Phase 0 | Rewrite for Nexus naming and current scope |
| Player-first home feed | ADAPT | apps/web home + activity read model | Phase 1 | Bounded public events only |
| Server directory and pages | ADAPT | server domain | Phase 1-2 | Preserve private/public boundaries |
| Heartbeat and status samples | ADAPT | server telemetry | Phase 2 | Add retention and aggregation |
| Server ownership verification | ADAPT | server access | Phase 2 | Must prove control |
| Server news and updates | ADAPT | content/server domain | Phase 2 | One source object, multiple surfaces |
| Server review tokens | ADAPT | server review eligibility | Phase 2 | Short-lived and single-use |
| Player follows and notifications | ADAPT | social/notifications | Phase 1 | Deep links and delivery deduplication |
| Resource catalog | ADAPT | product/resource domain | Phase 3 | Free resources first |
| Creator onboarding | ADAPT | creator workspace | Phase 3 | Explicit approval policy later |
| Resource version lifecycle | ADAPT | builds/releases | Phase 3 | Draft, validation, published, deprecated |
| S3 storage provider | ADAPT | packages/storage | Phase 3 | Private objects and signed delivery |
| Upload magic-byte validation | ADAPT | upload pipeline | Phase 3 | Separate media and artifacts |
| Authorized local streaming | ADAPT | development storage | Phase 3 | Never public uploads directory |
| Artifact checksums | ADAPT | build metadata | Phase 3 | Server-computed SHA-256 |
| Playwright fixtures and cleanup | ADAPT | tests/e2e | Phase 0-1 | New route locators and data model |
| Integration database reset helpers | ADAPT | tests/tools | Phase 0 | Isolated test DB only |
| Concurrency test patterns | ADAPT | tests/concurrency | Phase 0 and 5 | Required for commerce |
| CI quality gates | ADAPT | .github/workflows | Phase 0 | Begin with one small workflow |
| Canonical error model | ADAPT | domain + web responses | Phase 0 | Avoid legacy response sprawl |
| Production startup validation | ADAPT | packages/config | Phase 0 | Fail closed |
| Transactional outbox | POSTPONE | worker foundation | Phase 5 | Add only for real async side effects |
| Worker runtime | POSTPONE | apps/worker or web worker entry | Phase 5 | Not needed for initial player pages |
| Payment provider interface | KEEP-AS-REFERENCE | commerce provider contract | Phase 5 | Redesign around current providers |
| Provider webhook verification | KEEP-AS-REFERENCE | commerce adapters | Phase 5 | Reuse test cases and security rules |
| Payment idempotency records | ADAPT | commerce schema | Phase 5 | Mandatory before real payments |
| Reconciliation | ADAPT | commerce jobs | Phase 5 | Bounded scans and provider truth |
| Refund state machine | KEEP-AS-REFERENCE | commerce/refunds | Phase 5 | Introduce with real PSP |
| Seller receivable and payouts | ADAPT | finance domain | Phase 5 | No buyer stored-value wallet |
| Buyer transaction history | ADAPT | workspace | Phase 5 | After real settlement exists |
| Crypto invoice adapter | KEEP-AS-REFERENCE | crypto provider adapter | Phase 5 | External provider, no hot wallet |
| YooKassa/T-Bank adapters | POSTPONE | regional payment adapters | Phase 5 | Depends on legal jurisdiction |
| OAuth provider flows | KEEP-AS-REFERENCE | authentication | Phase 1 | Prefer maintained auth framework |
| Legacy JWT/refresh implementation | REJECT | none | none | Do not port another custom auth stack |
| Redis rate limiting | POSTPONE | infrastructure | Beta/scale | Only when multi-instance or abuse requires it |
| Activity Redis cache | REJECT for MVP | PostgreSQL bounded query | none | Complexity without measured need |
| Separate Express backend | REJECT | Next.js modular monolith | none | Current scale does not justify it |
| Prisma 8 RC contract ORM | REJECT | Drizzle | none | Keep stable current data access |
| Turborepo | POSTPONE | workspace tooling | scale | pnpm scripts are sufficient now |
| Native C++ module runtime | POSTPONE | separate future component | Phase 6+ | Lua integration first |
| DRM v2 cryptographic protocol | KEEP-AS-REFERENCE | contracts/security | Phase 6+ | Threat model required before use |
| DRM test vectors | KEEP-AS-REFERENCE | compatibility tests | Phase 6+ | Valuable when protocol resumes |
| Artifact encryption and DEK delivery | POSTPONE | protected delivery | Phase 6+ | Not part of free-resource MVP |
| Leak radar | REJECT for foreseeable MVP | none | none | High complexity and weak proof value |
| Docker execution sandbox | POSTPONE | artifact validation | later | Static inspection first |
| Live demo manager | REJECT for MVP | none | none | Cost and security exceed value |
| Deal rooms and escrow | REJECT for MVP | none | none | Legal and operational burden |
| Freelance/service marketplace | POSTPONE | separate product expansion | later | Not player-first |
| Advertising platform | POSTPONE | promotions | later | Requires real traffic |
| Premium subscriptions | POSTPONE | entitlements | later | Requires proven value |
| Price alerts | POSTPONE | notifications | later | Marketplace retention feature |
| Full forum | POSTPONE | community | later | Begin with entity discussions |
| Complex organization permissions | POSTPONE | organizations | later | Minimal creator teams first |
| Grafana/Prometheus stack | REJECT for MVP | hosted/basic monitoring | none | Outside USD 20-30 budget |
| Nine-workflow CI topology | REJECT | one consolidated CI | none | Grow only with separate components |
| startup.py orchestration | REJECT | pnpm + Docker Compose | none | Avoid a second orchestration language |

## Foundation implementation backlog

### MIG-001: repository error truth

Source lessons:

- legacy canonical errors;
- legacy database error mapping;
- legacy clean integration tests.

Nexus work:

- remove silent catches from all mutating repositories;
- distinguish not-found, conflict, validation, and infrastructure errors;
- add failure-path tests.

Acceptance:

- stopping PostgreSQL causes mutation endpoints to return an error;
- no returned entity is fabricated;
- no entitlement is issued.

### MIG-002: configuration truth

Source lessons:

- legacy startup validation;
- environment separation.

Nexus work:

- create development, test, and production validation rules;
- reject placeholder production secrets;
- reject S3 mode until a real provider is configured;
- document trusted proxy behavior.

Acceptance:

- unsafe production environment exits before serving traffic.

### MIG-003: deterministic database tests

Source lessons:

- tests/tools database reset;
- run-owned records;
- repeat-run verification.

Nexus work:

- separate test database URL;
- migration-from-empty test;
- fixture factory;
- deterministic cleanup;
- no tests against a developer database.

Acceptance:

- two complete test runs succeed consecutively;
- unavailable test database fails the suite clearly.

### MIG-004: player product specification

Source lessons:

- legacy VISION;
- DAILY-EXPERIENCE;
- server discovery E2E.

Nexus work:

- define guest, player, server owner, creator, and moderator journeys;
- define home activity types;
- define server privacy and review eligibility;
- define Russian and English copy boundaries.

Acceptance:

- each planned screen belongs to a named user journey;
- no orphan showcase pages.

### MIG-005: server vertical slice

Source lessons:

- legacy server management;
- integration heartbeat;
- review-token model.

Nexus work:

- server create;
- ownership claim;
- installation credential;
- heartbeat;
- public page;
- follow;
- update notification;
- review eligibility.

Acceptance:

- a server owner can complete the flow from an empty account;
- a player can discover and follow the server;
- private server data never appears publicly.

### MIG-006: free resource vertical slice

Source lessons:

- legacy publication pipeline;
- storage;
- download authorization;
- resource update center.

Nexus work:

- creator onboarding;
- resource CRUD;
- upload;
- validation;
- version publish;
- free acquisition;
- authorized download.

Acceptance:

- a new creator can publish a real archive;
- a player can acquire and download it;
- unpublished and private objects cannot be downloaded.

## Commerce re-entry criteria

Commerce implementation does not start until all are true:

- legal jurisdiction is recorded;
- payment and payout provider eligibility is confirmed;
- seller agreement and refund policy exist;
- free resource flow is proven in beta;
- database transaction discipline is established;
- idempotency and concurrency test infrastructure exists;
- object delivery is production-capable;
- operator can reconcile orders, provider events, entitlements, and payouts.

## Legacy code review rules

Before adapting a legacy implementation:

1. Identify the business invariant it protects.
2. Locate its unit, integration, concurrency, and E2E evidence.
3. Check whether Nexus already has a simpler equivalent.
4. Port the invariant and tests before optional features.
5. Remove legacy plan-number naming.
6. Do not carry unused compatibility layers.
7. Keep the Nexus modular monolith boundary.
8. Update this map with the resulting commit.

## First execution order

1. MIG-001 repository error truth.
2. MIG-002 production configuration truth.
3. MIG-003 deterministic database tests.
4. MIG-004 player product specification.
5. MIG-005 server vertical slice.
6. MIG-006 free resource vertical slice.
7. Closed beta.
8. Commerce decision.
