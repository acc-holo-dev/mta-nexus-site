# MTA NEXUS 1.1 — Local Development Guide

## 1. Quick Start

```bash
# 1. Start database container
docker compose up -d

# 2. Run migrations
pnpm db:migrate

# 3. Seed baseline records
pnpm db:seed

# 4. Run quality checks
pnpm check

# 5. Start development server
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000) to view the application.

## 2. Testing Credentials
- **Master Admin:** `admin@mta-nexus.com` (password: `password123`)
- **Developer:** `horizon@mta-nexus.com` (password: `password123`)
- **Server Owner:** `owner@sadrift.com` (password: `password123`)
- **Player:** `player@example.com` (password: `password123`)

## 3. Quality Gate Commands
```bash
pnpm check      # Runs typecheck, tests, and production build
pnpm test       # Runs Vitest unit & integration test suites
pnpm db:migrate # Applies Drizzle SQL migrations
pnpm db:seed    # Populates test baseline data
```
