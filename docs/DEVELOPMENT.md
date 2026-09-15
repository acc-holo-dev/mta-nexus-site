# MTA NEXUS — Local Development Guide

## 1. Quick Start

```bash
# 1. Install dependencies across monorepo
pnpm install

# 2. Run unit and integration tests
pnpm test

# 3. Check types
pnpm typecheck

# 4. Start Next.js development server
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000) to view the application.

## 2. Testing Credentials
- **Master Admin:** `admin@mta-nexus.com`
- **Developer:** `horizon@mta-nexus.com`
- **Server Owner:** `owner@sadrift.com`
- **Player:** `player@example.com`

## 3. Project Structure
- `apps/web`: Next.js 16 App Router application
- `packages/domain`: Entities, event contracts, domain errors
- `packages/db`: Drizzle ORM schema, migrations, connection pool
- `packages/validation`: Zod schemas for all domain entities and endpoints
- `packages/security`: `can()` server policy engine, ID generation, password hashing
- `packages/storage`: Pluggable storage providers and upload integrity pipeline
- `packages/ui`: Nexus UI component design system
- `packages/config`: Type-safe environment validation
