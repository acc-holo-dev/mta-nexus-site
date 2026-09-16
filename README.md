# MTA NEXUS 1.4

> **Resource Marketplace, Licensing Platform & Server Ecosystem for Multi Theft Auto: San Andreas**

MTA Nexus is a production-oriented platform connecting MTA:SA players, server owners, scripters, 3D artists, and studios. All data is persisted in PostgreSQL — there are no in-memory mock stores in the runtime.

---

## What actually works

- **Real database core** — PostgreSQL + Drizzle ORM, 26 tables, SQL migrations (`pnpm db:migrate`) and a development seed (`pnpm db:seed`).
- **Real authentication** — registration, login with scrypt password hashing, DB-backed sessions, httpOnly cookies, logout, session invalidation.
- **Marketplace** — products, categories, sorting, immutable build history with SHA-256, verified purchase reviews with rating recalculation.
- **Commerce** — orders, payment state machine, append-only double-entry ledger, automatic license provisioning, server-bound entitlements.
- **Server ecosystem** — server directory, ownership, API-key installation, heartbeat telemetry updating live player statistics.
- **Trust layer** — verification requests with admin approve/reject workflow, reports, moderation actions, audit trail.
- **User platform** — profiles, organizations, workspace (private by design), purchases, licenses, saved items, notifications, follow system.
- **Design system** — light & dark themes on a shared token system, collapsible sidebar, command palette (`Ctrl+K`), global cross-domain search.

An honest status audit of every implementation plan (what was claimed vs. what is real) is kept in [`docs/PLAN-STATUS.md`](docs/PLAN-STATUS.md).

---

## Repository Map

```text
mta-nexus-site/
│
├── apps/
│   └── web/                # Next.js 16 App Router application, pages & API routes
│
├── packages/
│   ├── domain/             # Entities, typed event bus, domain errors
│   ├── validation/         # Zod schemas for all inputs
│   ├── security/           # can() policy engine, opaque IDs, password hashing, rate limiter
│   ├── storage/            # StorageProvider abstraction, SHA-256 integrity, upload service
│   ├── db/                 # Drizzle schema, migrations, 18 repositories, seed
│   ├── ui/                 # Design system: tokens, primitives, StatCard, TrustBadge, DataTable
│   └── config/             # Type-safe environment validation
│
├── docs/
│   ├── PLAN/               # Original implementation plans (PLAN-001 … PLAN-005)
│   ├── PLAN-STATUS.md      # Audit: plan claims vs actual implementation
│   ├── STACK.md            # Verified dependency matrix
│   ├── DECISIONS.md        # Architecture Decision Records
│   ├── ARCHITECTURE.md     # System design & bounded contexts
│   ├── SECURITY.md         # Security model, rate limits, IDOR protections
│   ├── DATA_MODEL.md       # Database schema & entity tables
│   ├── API.md              # HTTP API reference
│   ├── STORAGE.md          # Storage abstraction & integrity
│   ├── AUTH.md             # Identity, sessions, authorization
│   ├── DEPLOYMENT.md       # Production deployment
│   └── DEVELOPMENT.md      # Local development & design system guide
│
├── tests/                  # Vitest suites (31 tests: auth, commerce, entitlements, security)
├── compose.yaml            # Local infrastructure (PostgreSQL)
└── package.json            # Workspace scripts
```

---

## Quick Start

```bash
# 1. Start infrastructure
docker compose up -d

# 2. Apply database migrations
pnpm db:migrate

# 3. (Optional) seed development data
pnpm db:seed

# 4. Quality gates — must all pass
pnpm check        # typecheck + 31 tests + production build

# 5. Run
pnpm dev          # development — http://localhost:3000
pnpm build && pnpm start   # production
```

## Development Accounts (seeded, password `password123`)

| Role | Email |
|---|---|
| Master Admin | `admin@mta-nexus.com` |
| Developer | `horizon@mta-nexus.com` |
| Server Owner | `owner@sadrift.com` |
| Player | `player@example.com` |

## Known Limitations

Honest list — see [`docs/PLAN-STATUS.md`](docs/PLAN-STATUS.md) for the full audit:
- Rate limiter is in-memory (single-process); Redis deliberately deferred.
- Payment provider is a sandbox implementation; external providers not yet connected.
- Build delivery returns authorized metadata + token; binary delivery requires an S3 provider.
- Email flows (verification, reset) are not implemented yet.
- 2FA is a schema foundation only.

Not affiliated with Rockstar Games or Take-Two Interactive.
