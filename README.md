# MTA Nexus

MTA Nexus is a player-first discovery and resource platform for Multi Theft Auto: San Andreas.

The product answers one primary question: **what is happening in MTA right now?** Fresh server activity comes first, followed by community updates and a free resource library. Paid commerce is deliberately disabled until a real payment provider and legal operating model are ready.

## Start here / С чего начать

Read the [free closed-beta release map / карту бесплатной беты](docs/RELEASE-READINESS.md) first. It separates intended user journeys, existing evidence, unverified behavior, release blockers, and the next small tasks. The [Product Blueprint](docs/PRODUCT-BLUEPRINT.md) describes the broader product; a roadmap checkbox is not evidence of release readiness.

The baseline at `58ef2d452a5bd375b9f7aa7e1b7d6b46785e56ed` passed [CI #859](https://github.com/acc-holo-dev/mta-nexus-site/actions/runs/35936732240), including the production image build. BETA-001 subsequently reproduced and fixed PostgreSQL 18 startup with the old volume path; persistence on fresh named volumes is verified in an isolated CI job. See the release map for exact commits, results, and limitations. Neither result establishes that the complete Compose environment, browser journeys, scanner, or backup restore work. Closed-beta release approval is still pending.

## Implemented foundation to verify for closed beta

- PostgreSQL-backed registration, login, sessions, and authorization
- live server directory driven by the official MTA master-list
- owner-scoped editorial server profiles and verification workflow (no server agent required)
- free resource creation, private build storage, SHA-256 integrity, library claims, and entitlement-gated binary downloads
- articles, profiles, follows, notifications, reports, and moderation foundations
- fail-closed production configuration and a ClamAV adapter requiring runtime verification
- CI on a clean PostgreSQL 18 database: migrations, typecheck, tests, application build, and production image build
- an isolated PostgreSQL named-volume persistence check for both Compose storage configurations

These are implementation areas, not a claim that all end-to-end journeys have passed acceptance. Use the release map for evidence and limitations.

## Explicitly not available

- paid checkout, seller balances, payouts, refunds, or cryptocurrency settlement
- S3 storage adapter (configuration fails loudly instead of falling back)
- a verified production email/recovery flow; configuring SMTP alone does not establish one
- multi-instance rate limiting
- MTA server-side installation, heartbeat agents, or runtime scripts

## Stack

- Node.js 26+
- pnpm 12
- Next.js 16 / React 19 / TypeScript 7
- PostgreSQL 18 / Drizzle ORM
- Vitest 5

## Local development — validation required

**Do not apply a volume-layout change to an environment with existing or unknown data without inventory and a tested recovery plan.** Both Compose files now mount PostgreSQL 18 at `/var/lib/postgresql`; earlier revisions used `/var/lib/postgresql/data`. BETA-001 verifies fresh volumes only. It neither migrates existing databases nor proves their backup/restore. Never delete volumes to resolve a startup error without identifying their contents and recovery plan.

The historical workflow below runs only PostgreSQL in Docker and the application on the host. It does **not** meet the Docker-only project requirement. A verified Docker-only quickstart is the next task, BETA-002; the storage fix does not implement it.

```bash
cp .env.example .env
docker compose up -d
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm db:seed
pnpm check
pnpm dev
```

In that historical workflow the local site uses `http://localhost:3000`. Seed data is for development only. See the [deployment guide](docs/DEPLOYMENT.md) for additional warnings; it is not a release approval.

## Branch policy

- `dev`: active development in small, reviewable changes
- `main`: reviewed release history; a commit being present here does not by itself mean it was deployed or accepted for users

Promote reviewed changes from `dev` through a pull request after the applicable checks pass. Release only an explicitly approved SHA/tag from `main` after the [release gates](docs/RELEASE-READINESS.md) pass, including dependency/security review, container startup, user journeys, and restore verification. Never force-reset a branch to keep it visually synchronized.

## Documentation

- [Release map and next tasks / карта беты и ближайшие задачи](docs/RELEASE-READINESS.md)
- [Product Blueprint](docs/PRODUCT-BLUEPRINT.md)
- [Implementation roadmap — not release evidence](docs/AUTONOMOUS-EXECUTION-ROADMAP.md)
- [Foundation audit](docs/FOUNDATION-AUDIT.md)
- [Legacy migration map](docs/LEGACY-MIGRATION-MAP.md)
- [Deployment guide — validation required](docs/DEPLOYMENT.md)

MTA Nexus is not affiliated with Rockstar Games, Take-Two Interactive, or the Multi Theft Auto project.
