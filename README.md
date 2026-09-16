# MTA Nexus

MTA Nexus is a player-first discovery and resource platform for Multi Theft Auto: San Andreas.

The product answers one primary question: **what is happening in MTA right now?** Fresh server activity comes first, followed by community updates and a free resource library. Paid commerce is deliberately disabled until a real payment provider and legal operating model are ready.

## Current closed-beta scope

- PostgreSQL-backed registration, login, sessions, and authorization
- live server directory driven by authenticated heartbeat telemetry
- owner-scoped server registration and one-time installation API keys
- free resource creation, private build storage, SHA-256 integrity, library claims, and entitlement-gated binary downloads
- articles, profiles, follows, notifications, reports, and moderation foundations
- fail-closed production configuration
- CI on a clean PostgreSQL 16 database: migrations, typecheck, tests, and production build

## Explicitly not available

- paid checkout, seller balances, payouts, refunds, or cryptocurrency settlement
- S3 storage adapter (configuration fails loudly instead of falling back)
- production email until SMTP is configured
- multi-instance rate limiting
- malware scanning of uploaded archives

## Stack

- Node.js 22+
- pnpm 9
- Next.js 16 / React 19 / TypeScript
- PostgreSQL 16 / Drizzle ORM
- Vitest

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

- `main`: stable release history
- `dev`: active development and the source branch for the draft release PR

Do not merge `dev` until the closed-beta checklist in [docs/RELEASE-READINESS.md](docs/RELEASE-READINESS.md) is complete.

## Documentation

- [Foundation audit](docs/FOUNDATION-AUDIT.md)
- [Legacy migration map](docs/LEGACY-MIGRATION-MAP.md)
- [Deployment guide](docs/DEPLOYMENT.md)
- [Release readiness](docs/RELEASE-READINESS.md)

MTA Nexus is not affiliated with Rockstar Games, Take-Two Interactive, or the Multi Theft Auto project.
