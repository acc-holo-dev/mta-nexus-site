# MTA NEXUS 1.0

> **Unified Infrastructure & Resource Ecosystem for Multi Theft Auto: San Andreas**

MTA Nexus is an end-to-end production platform connecting MTA:SA players, server owners, scripters, 3D artists, and studios into a cohesive, high-performance ecosystem.

---

## Key Highlights

- **Modular Monolith Architecture:** App Router + Domain modules in `packages/*`.
- **Relational PostgreSQL 18 & Drizzle ORM:** Comprehensive schema with constraints, indexes, and full-text search.
- **Cryptographic Licensing & Entitlements:** Server IP & hardware-bound licenses with automated provisioning.
- **Double-Entry Financial Ledger:** Append-only ledger entries for transparent, tamper-proof transaction audits.
- **Nexus Runtime Module Support:** Dedicated entity models and API handshake foundation for native MTA C++ runtime modules.
- **Universal Content & Discovery Engine:** Event-driven social feeds, articles, devlogs, verified reviews, and instant cross-domain search (`Ctrl+K`).
- **Production UI System:** Built with Tailwind CSS v4, accessible UI components, dark-mode first, desktop-responsive layout.

---

## Repository Map

```text
mta-nexus-site/
│
├── apps/
│   └── web/                # Next.js 16 App Router application & API routes
│
├── packages/
│   ├── domain/             # Core entity models, event bus, and domain errors
│   ├── validation/         # Zod schemas for forms, APIs, and entities
│   ├── security/           # can() policy engine, prefixed IDs, password hashing
│   ├── storage/            # StorageProvider abstraction, local & S3 adapters, SHA-256
│   ├── db/                 # Drizzle ORM PostgreSQL schema & client
│   ├── ui/                 # Nexus design system primitives
│   └── config/             # Type-safe environment configuration
│
├── docs/                   # Complete architectural and operations documentation
│   ├── STACK.md            # Verified dependency matrix
│   ├── DECISIONS.md        # Architecture Decision Records (ADRs)
│   ├── ARCHITECTURE.md     # System design & bounded contexts
│   ├── SECURITY.md         # Threat model, policies & controls
│   ├── DATA_MODEL.md       # Database schema & entity tables
│   ├── API.md              # HTTP API documentation
│   ├── STORAGE.md          # Storage abstraction & integrity
│   ├── AUTH.md             # Identity, roles & permissions
│   ├── DEPLOYMENT.md       # Production deployment instructions
│   └── DEVELOPMENT.md      # Local engineering workflow
│
├── tests/                  # Vitest unit & integration test suites
├── compose.yaml            # Local Docker infrastructure (PostgreSQL, MinIO, Mailpit)
├── .env.example            # Environment variables template
└── package.json            # Root workspace scripts
```

---

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Run test suite
pnpm test

# 3. Build production bundle
pnpm build

# 4. Start local development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.
