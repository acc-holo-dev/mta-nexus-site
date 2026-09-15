# MTA NEXUS — Architecture Specification

## 1. Modular Monolith Architecture

MTA Nexus is architected as a modular monolith. Rather than deploying disparate microservices with distributed transaction complexity, Nexus encapsulates clear bounded contexts within a unified repository and application runtime.

```text
                                  Browser / Client
                                         ↓
                     Next.js 16 App Router (apps/web)
                      Server Components & Route Handlers
                                         ↓
                       Application & Domain Services
                (@nexus/domain, @nexus/security, @nexus/storage)
                                         ↓
                        Database & Persistence Layer
                         (@nexus/db / Drizzle ORM)
                                         ↓
                               PostgreSQL 18
```

## 2. Bounded Contexts

1. **Identity & Organizations (`identity`, `organizations`):** Handles user identities, studio/team organizations, membership RBAC, and contextual switching.
2. **Catalog & Builds (`catalog`, `products`, `builds`, `assets`):** Universal resource management (scripts, models, vehicles, maps, UI), immutable build releases with SHA-256 hashes.
3. **Servers & Runtime (`servers`, `installations`):** Game server registrations, live telemetry tracking, and Nexus Module runtime connectivity.
4. **Commerce & Licensing (`commerce`, `licensing`, `ledger`):** Multi-step payment state machine, double-entry append-only financial ledger, and hardware/IP bound cryptographic licenses.
5. **Content Engine (`content`, `feed`, `social`):** Unified engine powering technical articles, devlogs, announcements, comments, and reactions.
6. **Discovery Engine (`discovery`, `search`):** Universal search and relevance ranking across products, servers, articles, and developers.
7. **Administration & Moderation (`admin`, `moderation`, `audit`):** Central control plane, report investigations, copyright claim history, and tamper-proof audit trails.

## 3. Event-Driven Architecture

All aggregate mutations emit typed, versioned domain events (`DomainEvent<T>`) onto the Nexus Event Bus. Listeners handle:
- Activity feeds
- Notifications
- Webhook notifications
- Telemetry aggregation
- Audit log persistence
