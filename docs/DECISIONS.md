# MTA NEXUS — Architectural Decision Records (ADR)

## ADR-001: Modular Monolith vs. Microservices
- **Decision:** Adopt a modular monorepo monolith (Next.js App Router + domain modules in `packages/*` and `apps/web`).
- **Rationale:** Avoids network overhead, distributed transactions, and deployment sprawl for the closed beta. Allows clear domain boundaries that can be split into separate services in future phases if scaling requires it.

## ADR-002: PostgreSQL as Universal Relational Foundation
- **Decision:** All core domains (identity, organizations, catalog, builds, entitlements, community, and moderation) reside in PostgreSQL 16.
- **Rationale:** Provides referential integrity, ACID transactions, and built-in query capability without prematurely adding Elasticsearch or Redis.

## ADR-003: Drizzle ORM for Data Access
- **Decision:** Use Drizzle ORM with explicit SQL schema definitions and migrations.
- **Rationale:** Maintains end-to-end TypeScript type safety while keeping query behavior visible.

## ADR-004: Paid Commerce Is a Separate Release Gate
- **Decision:** The closed beta permits only free resource claims. Payment, wallet, payout, refund, and crypto flows return an explicit unavailable response.
- **Rationale:** External provider, jurisdiction, dispute, reconciliation, and seller-onboarding decisions are not safely approximated in code.

## ADR-005: Authorization via Server Policies
- **Decision:** Authorization is centralized with granular policy rules instead of inline role checks.
- **Rationale:** Supports ownership, moderation, and organization membership without duplicating rules across routes.

## ADR-006: Private Build Storage and Entitlement-Gated Delivery
- **Decision:** Builds remain private in local storage and are streamed only after an entitlement check.
- **Rationale:** A public URL must never be treated as a license.

## ADR-007: Closed-Beta Infrastructure
- **Decision:** Target one Hetzner Cloud instance in Finland or Germany with 4 GB RAM, a single application process, PostgreSQL 16, and provider-managed daily backups. Primary production name is `nexus-mta.com`; `nexus-mta.pro` is the fallback.
- **Rationale:** It fits the $30/month ceiling and keeps operations simple. Hetzner backups retain seven daily disk copies, but attached volumes are excluded, so closed-beta uploads remain on the backed-up system disk and database/resource archives are created daily.

## ADR-008: Email Deferred, Not Faked
- **Decision:** Production email may be explicitly disabled for the free closed beta. SMTP, email verification, and password recovery are deferred.
- **Rationale:** Sending no email is safer and more honest than pretending an unconfigured mail channel works. Users will be told about the limitation before public launch.
