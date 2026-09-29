# MTA NEXUS 1.4 — Local Development Guide

## 1. Quick Start

```bash
# 1. Start database container
docker compose up -d

# 2. Run migrations
pnpm db:migrate

# 3. Seed baseline records (development only; uses your temporary password)
export NODE_ENV=development
read -rsp "Choose a local seed password (12+ characters): " DEV_SEED_PASSWORD; echo
export DEV_SEED_PASSWORD
pnpm db:seed
unset DEV_SEED_PASSWORD

# 4. Run quality checks
pnpm check

# 5. Start development server
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000) to view the application.

## 2. Seeded Development Accounts

Seeded accounts use the temporary password you supply through `DEV_SEED_PASSWORD`.
There is no committed default password, and the seed command refuses to run unless
`NODE_ENV=development` is set. Never reuse a production or personal password.

## 3. Quality Gate Commands
```bash
pnpm check      # typecheck + tests + production build
pnpm test:verification # fast tests that do not require PostgreSQL
pnpm test:verification:integration # database-backed tests; requires migrated PostgreSQL
pnpm test       # complete Vitest suite
pnpm db:migrate # Apply Drizzle SQL migrations
pnpm db:seed    # Populate development baseline data
```

## 4. Design System (Nexus 1.4)

All UI is built on the design token system in `apps/web/src/app/globals.css`:

- **Themes:** Light theme is the reference design; dark theme shares the same tokens. Toggle via the topbar control; preference persists in `localStorage` (`nexus-theme`) and is applied pre-paint to avoid flashes.
- **Semantic utilities:** `bg-page`, `bg-surface`, `bg-elevated`, `bg-inset`, `border-base`, `text-primary`, `text-secondary`, `text-muted`, `text-faint`, `bg-accent-soft`, `bg-success-soft`, etc. Never hardcode hex colors in components.
- **Typography:** `font-display`, `font-heading`, `font-body`, `font-label`, `font-caption`, `font-numeric`, `font-code`.
- **Shared primitives** (`@nexus/ui/src/platform.tsx`): `StatCard`, `SectionHeader`, `TrustBadge` (verified / verified purchase / verified developer / verified server / official / sponsored / featured), `StatusBadge`, `DataTable` primitives.
- **Shell:** `NexusShell` = collapsible `Sidebar` (state persisted in `localStorage`) + `Navbar` (global search, theme toggle, notifications, auth) + content area + `Footer`.

## 5. Rules for New UI
1. Use semantic token utilities, never hardcoded hex values.
2. Reuse `TrustBadge`/`StatusBadge` for trust and status language.
3. Every screen must handle loading, empty, error and not-found states (`loading.tsx`, `error.tsx`, `not-found.tsx` are global defaults).
4. Desktop-first: verify 1280px / 1440px / 1600px / 1920px widths; avoid meaningless full-screen whitespace.
