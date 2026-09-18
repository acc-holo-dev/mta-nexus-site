# NEXUS MTA — Autonomous Execution Roadmap

> Status: active  
> Branch: `dev` only  
> Delivery model: Docker on a budget VDS; no deploy is performed from this repository.  
> Core boundary: NEXUS discovers public MTA activity from the official MTA master-list. It does not require an in-game resource, `config.lua`, heartbeat agent, or runtime DRM on third-party servers.

## Product outcome

NEXUS MTA becomes a player-first MTA ecosystem with five connected surfaces:

1. **Discover** — the public MTA network, reliable live availability, editorial server profiles and direct join links.
2. **Belong** — player profiles, creators, communities, discussions, follows and notifications.
3. **Create** — developer and server-owner workspaces for listings, content, resources and moderation workflows.
4. **Acquire** — initially free resource delivery; later compliant paid checkout, external providers, crypto invoices, balance and payouts.
5. **Trust** — explicit verification, moderation, audit records, integrity checks and transparent states.

A listing, a live master-list observation, a resource build, a purchase entitlement and a payout are separate concepts. The roadmap avoids shortcuts that merge them.

## Non-negotiable constraints

- Work only on `dev`; `main` is untouched.
- Docker is the sole supported runtime model.
- No production deployment, payment-provider activation, crypto wallet, payout, or legal representation is assumed before the explicit release gate.
- No MTA server-side software is installed or required.
- The initial VDS budget is approximately $20–30/month; PostgreSQL, the app and edge proxy must remain operationally simple.
- Free resources are the closed-beta commerce model. Paid resources remain disabled until legal, provider and operational gates are passed.
- “Published” does not imply “cryptographically signed.” User uploads are unsigned until a trusted signing pipeline exists.

## Progress ledger

| Wave | Scope | Status | Definition of done |
| --- | --- | --- | --- |
| 0 | Product boundary and legacy removal | complete | Blueprint exists; heartbeat/agent flow removed from active surface |
| 1 | Official MTA live directory | complete | Parser, cache, bounds, public API and paginated UI exist |
| 2 | Free resource delivery hardening | complete | Safe upload, build lifecycle, entitlement delivery and moderation-ready states |
| 3 | Identity, access and trust | active | Capability checks, profile verification, audit and abuse controls |
| 4 | Communities and content | active | Community spaces, posts, discussions, notifications and discovery; public reads are bounded and publication-safe |
| 5 | Editorial server profiles | active | Owner-managed profile data safely linked to official observations |
| 6 | Marketplace quality | planned | Review rules, build scanning/signing-ready workflow, compatibility and creator operations |
| 7 | Financial domain foundation | planned | Immutable ledger and provider-neutral payment/payout contracts, disabled by default |
| 8 | Docker/VDS release operations | planned | Runbooks, secrets model, health checks, migrations, backups and recovery |
| 9 | Closed-beta release gate | planned | E2E journeys, accessibility, security review and explicit owner approval |

## Wave 2 — free resource delivery

### Goal

Let a player safely claim and download free MTA resources while keeping the system ready for future moderation and paid commerce.

### Work items

- [x] Reject paid resource creation and release in closed beta.
- [x] Validate build size, extension and archive signatures before storage.
- [x] Keep uploaded builds unsigned until a real signing pipeline exists.
- [x] Restrict downloads to the author, administrators or valid entitlement holders.
- [x] Add a distinct build review state and moderator approval/rejection path.
- [x] Preserve sanitized build filename and server-derived media type as trusted metadata.
- [x] Add deterministic build retirement semantics with owner/admin authorization and audit records.
- [x] Add safe antivirus/scanner adapter contract; it remains explicitly disabled until infrastructure exists.
- [x] Add resource compatibility validation and dependency declarations.
- [x] Surface release notes, checksum and compatibility on resource pages.

### Exit criteria

- A free resource can be authored, uploaded, reviewed, claimed and downloaded.
- A non-owner cannot retrieve private asset keys or a build without entitlement.
- Moderators can approve, suspend and retire releases with an audit record.
- No code path represents an unchecked upload as signed or verified.

## Wave 3 — identity, access and trust

### Goal

Replace role-string assumptions with durable, auditable authorization decisions.

### Work items

- [x] Introduce a capability matrix for player, developer, server owner, moderator and administrator contexts.
- [x] Add owner-context switching only where an organization relationship permits it; expose bounded personal/org contexts and audit transitions.
- [x] Complete verification request workflow with ownership checks, duplicate protection, reviewer notes, audit events and moderator notifications.
- [x] Add rate limits per risk category: authentication, resource upload, content creation, comment creation, follow, report, download, verification, moderation and public search.
- [x] Add abuse-report entities, validation, moderator notifications and a queue.
- [x] Add notification preferences; privacy-safe profile controls remain planned.
- [x] Add account security checks: session revocation and password changes. Email verification and recovery readiness remain planned.

### Exit criteria

- Every privileged operation has one service-layer authorization gate.
- Moderation actions are attributable and reproducible through audit logs.
- User-facing role labels never grant an action by themselves.

## Wave 4 — communities and content

### Goal

Create the social layer that gives players a reason to return when they are not downloading a resource.

### Work items

- Community profile, ownership and membership roles.
- News, guides, updates and creator posts with draft/published/moderated states.
- [x] Discussions/comments with report and moderation controls.
- Follow graph for users, communities, servers and resources.
- Notification center and digest-ready events.
- Tags, search and ranking based on real activity rather than vanity counters.
- SEO metadata and stable public URLs.
- [x] Enforce published-only article list/detail reads and keep metadata from double-counting views.
- [x] Bound public search, catalog, editorial-server and home-feed reads; keep search rate limited per client IP.
- [x] Route player/creator drafts through an audited moderator publish/archive transition and queue.
- [x] Add authenticated article comments/replies with same-article parent checks, author notifications and transactional counters.

### Exit criteria

- A player can follow a creator/community/server, receive relevant updates and report abuse.
- Content is not publicly exposed before its intended state allows it.
- A moderator can resolve reports without direct database edits.

## Wave 5 — editorial server profiles

### Goal

Make server pages useful without pretending NEXUS controls the server runtime.

### Data separation

| Data | Source | Authority |
| --- | --- | --- |
| Address, port, current players, map/mode snapshot | Official MTA master-list | Live observation |
| Name, description, images, links, rules, community association | Verified owner/editorial workflow | Profile data |
| Verified ownership | Moderator decision | Trust state |
| Availability | Latest official observation | Never an owner heartbeat |

### Work items

- [x] Match editorial profiles to observations by normalized address/port.
- [x] Expose editorial listings with an explicit `liveObservation`/`liveStatus` layer; missing directory data remains neutral.
- [x] Ensure new listings are editorially active without implying live availability.
- Add claim/verification workflow instead of automatic ownership claims.
- [x] Add bounded profile links, media, language, region and gameplay taxonomy without overwriting live observations.
- Add favorites/follows and player-safe reporting.
- [x] Add bounded search type facets and keep server telemetry sourced transparently from official observations.
- [x] Keep owner workspace live counters sourced from the official directory; missing observations remain neutral.
- Keep missing observations neutral: “no current observation,” never “offline” unless official data says so.

### Exit criteria

- Joining a server always uses the observed/declared public endpoint.
- Editing a profile cannot fabricate live player counts.
- A player can distinguish verified ownership, editorial content and live status.

## Wave 6 — marketplace quality

### Goal

Turn free resource delivery into a trusted catalogue before money enters the system.

### Work items

- [x] Creator public pages with bounded reads and honest identity status; no synthetic seller or reputation claims.
- [x] Gate reviews on real entitlement and published state; enforce one review per user/resource atomically.
- Resource versions, compatibility, dependencies, deprecation and changelogs.
- Moderator review queue for product and build states.
- Malware/scanner adapter and manual-review fallback.
- Signing pipeline design: detached signature, public verification key, signer identity and revocation.
- Download integrity display: checksum, size, release date, compatibility.
- Optional reproducible build metadata where authors can provide it.

### Exit criteria

- A player sees why a resource is trusted and whether it is compatible.
- A moderator can stop or retire a compromised build without deleting audit evidence.
- Future signatures can be added without changing the public build identity.

## Wave 7 — financial domain foundation

### Goal

Prepare the financial data model without activating money movement.

### Work items

- Provider-neutral payment intent, provider event and reconciliation entities.
- Immutable double-entry ledger entries and balances derived from them.
- Idempotency keys for every financial mutation.
- Refund, dispute, reserve and payout state machines.
- Currency/asset precision rules and exchange-rate boundaries.
- Provider webhook verification and replay protection.
- Compliance/availability feature gates by jurisdiction and account state.
- Admin reconciliation and export views.

### Explicitly not activated in this wave

- No card processor or crypto provider credentials.
- No on-chain wallets or custody.
- No user-facing balance that can be spent.
- No seller payout execution.

### Exit criteria

- The domain can record a simulated intent and provider event idempotently.
- No balance is editable as a mutable number.
- Provider implementation is replaceable behind a narrow interface.

## Wave 8 — Docker/VDS release operations

### Goal

Make the future deployment boring, observable and recoverable on one modest VDS.

### Work items

- Production compose review: app, PostgreSQL and Caddy only.
- Required secrets inventory and validation at startup.
- Docker health endpoints and container health checks.
- Migration runbook with backup/rollback decision points.
- VDS backup verification checklist and restore drill.
- Structured logs, error boundaries and minimum operational metrics.
- Dependency update policy and image rebuild cadence.
- Separate staging/production configuration without code forks.

### Exit criteria

- A fresh VDS can be provisioned from documented Docker steps.
- Restore of database and uploaded files has been rehearsed.
- A failed migration or image can be rolled back through documented steps.

## Wave 9 — closed-beta release gate

### Goal

Open a controlled beta only after the core player and creator journeys are reliable.

### Required journeys

1. Player discovers a live MTA server, searches it and joins it.
2. Server owner creates an editorial listing, requests verification and updates public profile data.
3. Developer creates a free resource, uploads a build, reaches approved state and releases notes.
4. Player claims a resource and downloads an authorized build.
5. Player follows a community or creator and receives a notification.
6. Moderator resolves a report, a verification request and a compromised build.
7. Operator restores the environment using documented Docker/VDS procedures.

### Release gates

- Typecheck, automated tests and Docker production build are green.
- Security and permission review passes.
- No active “fake” trust indicators: signed, verified, paid or live.
- Legal/provider gate remains closed until explicitly approved.
- Owner approves the beta scope and environment.

## Execution cadence

Each autonomous development cycle will:

1. Select a coherent set of items from the active wave.
2. Implement code, schema changes, tests and documentation together.
3. Avoid merging into `main` or deploying.
4. Run verification at the end of the wave or before a destructive/risky change.
5. Record material scope or product-boundary decisions in this document.

## Deferred ideas

These are valuable but not release blockers: 3D showcase/studio, live demo radar, creator ads, game-integrated DRM, full analytics warehouse, multi-region hosting, mobile apps, and on-chain settlement. They remain out of scope until the core player ecosystem and operational model prove themselves.
