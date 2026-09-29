# MTA Nexus

MTA Nexus is a player-first discovery and resource platform for Multi Theft Auto: San Andreas.

The product answers one primary question: **what is happening in MTA right now?** Fresh server activity comes first, followed by community updates and a free resource library. Paid commerce is deliberately disabled until a real payment provider and legal operating model are ready.

## Current closed-beta scope

- PostgreSQL-backed registration, login, sessions, and authorization
- live server directory driven by the official MTA master-list
- owner-scoped editorial server profiles and verification workflow (no server agent required)
- free resource creation, private build storage, SHA-256 integrity, library claims, and entitlement-gated binary downloads
- articles, profiles, follows, notifications, reports, and moderation foundations
- fail-closed production configuration
- CI workflow for clean PostgreSQL 18 migrations, typecheck, tests, application build, and image build

## Explicitly not available

- paid checkout, seller balances, payouts, refunds, or cryptocurrency settlement
- S3 storage adapter (configuration fails loudly instead of falling back)
- production email until SMTP is configured
- multi-instance rate limiting
- MTA server-side installation, heartbeat agents, or runtime scripts

## Stack

- Node.js 26+
- pnpm 12
- Next.js 16 / React 19 / TypeScript 7
- PostgreSQL 18 / Drizzle ORM
- Vitest 5

## Local development

```bash
cp .env.example .env
docker compose up -d
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm db:seed
pnpm check
pnpm dev
```

The local site runs at `http://localhost:3000`.

## Branch policy

- `main`: active development and release history

Keep development on `main`. Treat a release as ready only after the dependency audit, migrations, typecheck, tests, application build, and production image build are green.

## Documentation

- [Current capability audit](docs/CAPABILITY-AUDIT.md)
- [Product blueprint](docs/PRODUCT-BLUEPRINT.md)
- [Foundation audit](docs/FOUNDATION-AUDIT.md)
- [Legacy migration map](docs/LEGACY-MIGRATION-MAP.md)
- [Deployment guide](docs/DEPLOYMENT.md)
- [Release readiness](docs/RELEASE-READINESS.md)

MTA Nexus is not affiliated with Rockstar Games, Take-Two Interactive, or the Multi Theft Auto project.
