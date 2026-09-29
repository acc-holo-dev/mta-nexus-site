# Closed-beta release readiness

Last reviewed: 2026-09-29

This is a release checklist, not a declaration that the current uncommitted
`main` tree has passed every gate. See `CAPABILITY-AUDIT.md` for the current audit.

## Engineering gates

| Gate | Status | Evidence / action |
|---|---|---|
| Clean database migrations | Pending current tree | Migration 0012 must pass from empty and against current development data |
| TypeScript | Pass locally | `tsc -b` succeeds |
| Automated tests | Partial locally | 56 non-DB test files / 124 tests pass on 2026-09-29, including 7 local ClamAV protocol tests; database-backed suite still requires PostgreSQL/CI |
| Production build | Pass locally | Next.js build succeeds with Docker-equivalent environment |
| Fabricated persistence results removed | Pass | repository errors propagate |
| Mock paid settlement removed | Pass | paid checkout returns `PAYMENTS_NOT_CONFIGURED` |
| Free resource claim | Pass | idempotent transaction + entitlement |
| Binary build delivery | Pass | authenticated entitlement-gated stream |
| Official MTA live directory | Pass | bounded master-list parser, cache and paginated API |
| Workspace isolation | Pass | owner-scoped servers and user-scoped entitlements |
| Privacy, terms, copyright pages | Pass | closed-beta pages linked from footer |
| Docker image build | Pending current tree | Workflow contains `docker build`; current tree needs a successful CI run |
| Production service Compose smoke | Pending current CI | Workflow now starts PostgreSQL, ClamAV and the built app image, then exercises `/api/health` |
| Browser E2E smoke test | Pending | Run against the production candidate |
| Upload malware scanning | Protocol contract verified, operational proof pending | Production ClamAV enables `AlertExceedsMax`, so files that exceed scan limits receive a non-clean verdict; local mock-daemon tests cover INSTREAM framing and clean/malicious/limit/error/timeout handling. A real daemon and EICAR integration run remain required |
| Scanner provenance at publication and delivery | Hardened in current tree | Only a clean ClamAV result with a valid non-future timestamp is eligible; untrusted legacy rows are withheld from public build lists and downloads |
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
