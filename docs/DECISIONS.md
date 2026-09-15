# MTA NEXUS — Architectural Decision Records (ADR)

## ADR-001: Modular Monolith vs. Microservices
- **Decision:** Adopt a modular monorepo monolith (Next.js App Router + domain modules in `packages/*` and `apps/web`).
- **Rationale:** Avoids network overhead, distributed transactions, and deployment sprawl for Nexus 1.0. Allows clear domain boundaries that can be split into separate services in future phases if scaling requires it.

## ADR-002: PostgreSQL as Universal Relational Foundation
- **Decision:** All core domains (Identity, Organizations, Catalog, Builds, Licenses, Commerce, Ledger, Feed, Search) reside in PostgreSQL 18.
- **Rationale:** Provides strict referential integrity, check constraints, ACID transactions for financial ledgers, and built-in full-text search without prematurely adding Elasticsearch or Redis.

## ADR-003: Drizzle ORM for Data Access
- **Decision:** Use Drizzle ORM with explicit SQL schema definitions and migrations.
- **Rationale:** Avoids magic abstractions and runtime query overhead of heavier ORMs while maintaining end-to-end TypeScript type safety.

## ADR-004: State Machine for Payments & Uploads
- **Decision:** Payments and file uploads must follow strict finite state machines rather than raw boolean flags (e.g. `isPaid: boolean` is forbidden).
- **Rationale:** Guarantees idempotency, auditability, dispute tracking, and resilient handling of async callbacks/webhooks.

## ADR-005: Double-Entry Immutable Ledger
- **Decision:** Financial balances are calculated from append-only ledger entries (`LedgerEntry`).
- **Rationale:** Prevents race conditions, balance tampering, and enables complete fiscal auditing.

## ADR-006: Unified Content and Event-Driven Feed
- **Decision:** A single content engine (`Content`) powers articles, devlogs, announcements, and updates. Feeds are constructed from domain events rather than querying multiple fragmented tables.
- **Rationale:** Enables coherent discovery, subscriptions, notifications, and social timeline updates across all entities (servers, products, developers).

## ADR-007: Authorization via Server Policies (`can()`)
- **Decision:** Authorization is centralized using granular policy rules (`can(user, action, resource)`) instead of inline role checks.
- **Rationale:** Supports fine-grained permissions, team delegation, organization memberships, and resource ownership.

## ADR-008: Pluggable Storage Abstraction
- **Decision:** Application code interacts with storage through a `StorageProvider` abstraction with checksum validation (SHA-256) and signed URL generation.
- **Rationale:** Decouples file uploads from cloud vendors, facilitating local development, MinIO testing, and enterprise S3 deployments.
