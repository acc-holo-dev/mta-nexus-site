# Closed-beta release readiness

Last reviewed: 2026-09-16

## Engineering gates

| Gate | Status | Evidence / action |
|---|---|---|
| Clean database migrations | Pass | GitHub CI applies migrations to PostgreSQL 16 |
| TypeScript | Pass | `pnpm typecheck` in CI |
| Automated tests | Pass | `pnpm test` against PostgreSQL |
| Production build | Pass | `pnpm build` in CI |
| Fabricated persistence results removed | Pass | repository errors propagate |
| Mock paid settlement removed | Pass | paid checkout returns `PAYMENTS_NOT_CONFIGURED` |
| Free resource claim | Pass | idempotent transaction + entitlement |
| Binary build delivery | Pass | authenticated entitlement-gated stream |
| Server heartbeat authentication | Pass | SHA-256 API-key lookup + owner-only key creation |
| Workspace isolation | Pass | owner-scoped servers and user-scoped entitlements |
| Privacy, terms, copyright pages | Pass | closed-beta pages linked from footer |
| Browser E2E smoke test | Pending | run against the production candidate |
| Upload malware scanning | Deferred | closed beta requires trusted uploaders and manual review |
| Shared rate limiting | Deferred | single application instance only |
| S3 adapter | Deferred | use a persistent local volume for closed beta |
| Email verification and recovery | Deferred | production email is explicitly disabled |

## Infrastructure decisions

- Primary domain: `nexus-mta.com`; fallback: `nexus-mta.pro`.
- Hosting: one Hetzner Cloud instance in Finland or Germany with 4 GB RAM.
- Backups: VDS-provider backups are the owner’s backup mechanism. Confirm a restore before inviting users; Nexus must not claim an untested backup policy.
- Email: disabled for closed beta; do not expose flows that imply email delivery.

## Owner inputs still required before deployment

These are deployment inputs, not development tasks:

- register the chosen domain and control its DNS;
- create the Hetzner Cloud project and grant deployment access;
- configure `legal@nexus-mta.com` and `abuse@nexus-mta.com` as working inbound addresses or forwarding aliases;
- perform one backup restore and production browser smoke test.

## Paid commerce gate

Paid resources, balances, payouts, and crypto must remain disabled until all of the following exist:

- operating jurisdiction and suitable self-employed business setup confirmed;
- legal terms and refund/dispute process reviewed;
- provider supports the chosen countries and product category;
- signed webhook verification, idempotency, reconciliation, refunds, and payout accounting implemented;
- seller onboarding/KYC responsibilities documented.

## Go/no-go rule

The free closed beta is a **go** only when every non-deferred engineering gate passes, the deployment inputs are configured, a backup restore succeeds, and the production browser smoke test passes. Paid commerce remains a separate later release.
