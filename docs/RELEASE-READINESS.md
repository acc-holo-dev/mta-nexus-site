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
| Browser E2E smoke test | Pending | run against the production candidate |
| Upload malware scanning | Deferred | closed beta requires trusted uploaders and manual review |
| Shared rate limiting | Deferred | single application instance only |
| S3 adapter | Deferred | use a persistent local volume for closed beta |

## Owner inputs still required

These are real release blockers that cannot be safely invented in code:

- production domain and DNS;
- hosting provider/VPS access;
- SMTP provider credentials and verified sender;
- backup destination and retention confirmation;
- privacy policy, terms, and acceptable-use/copyright contact details.

## Paid commerce gate

Paid resources, balances, payouts, and crypto must remain disabled until all of the following exist:

- operating jurisdiction and suitable self-employed business setup confirmed;
- legal terms and refund/dispute process reviewed;
- provider supports the chosen countries and product category;
- signed webhook verification, idempotency, reconciliation, refunds, and payout accounting implemented;
- seller onboarding/KYC responsibilities documented.

## Go/no-go rule

The free closed beta is a **go** only when every non-deferred engineering gate passes, all owner inputs are configured, a backup restore succeeds, and the production browser smoke test passes. Paid commerce remains a separate later release.
