# MTA NEXUS 1.1 — Architecture Specification

## 1. Modular Monolith Architecture

MTA Nexus 1.1 is implemented as a production-grade modular monolith. Rather than distributing services across network boundaries, all core subsystems are encapsulated into strongly-typed packages inside a unified monorepo:

```text
                                  Browser / Client
                                         ↓
                     Next.js 16 App Router (apps/web)
                      Server Components & Route Handlers
                                         ↓
                       Application & Domain Services
                (@nexus/domain, @nexus/security, @nexus/storage)
                                         ↓
                       Database Repositories Layer
                           (@nexus/db / Drizzle)
                                         ↓
                               PostgreSQL 18
```

## 2. Bounded Contexts & Repository Layer

1. **Identity & Sessions (`@nexus/db/src/repositories/users.ts`, `sessions.ts`):** Real user accounts with salted scrypt password hashing, session tokens persisted in PostgreSQL, secure `httpOnly` cookies, context switching between Personal and Organization profiles.
2. **Catalog & Builds (`@nexus/db/src/repositories/products.ts`, `builds.ts`):** Complete marketplace resources, versioned builds with SHA-256 binary validation, deterministic sorting (popular, newest, price, rating).
3. **Game Servers (`@nexus/db/src/repositories/servers.ts`):** Public MTA discovery, separately claimed editorial profiles, and sourced observation history without server-installed code.
4. **Commerce & Double-Entry Ledger (`@nexus/db/src/repositories/orders.ts`, `payments.ts`, `ledger.ts`):** Strict finite state machines, transactional append-only ledger entries for double-entry fiscal accounting.
5. **Licensing & Entitlement Engine (`@nexus/db/src/repositories/licenses.ts`, `entitlements.ts`):** Cryptographic keys, server IP/hardware binding, and server-side `hasEntitlement(subject, resource, permission)` verification.
6. **Content & Discovery (`@nexus/db/src/repositories/content.ts`):** Articles, devlogs, verified reviews, and instant cross-domain search (`Ctrl+K`).
7. **Administration & Audit (`@nexus/db/src/repositories/audit.ts`, `reports.ts`):** Moderation cases, copyright claims, and tamper-proof security audit log.

## 3. Real Persistence Model
All application services connect directly to PostgreSQL 18 via Drizzle ORM repositories. Zero runtime dependencies on mock data stores. Local development can populate baseline data via `pnpm db:seed`.
