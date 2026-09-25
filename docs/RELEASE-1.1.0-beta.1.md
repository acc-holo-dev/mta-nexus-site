# MTA NEXUS 1.1.0-beta.1 — integration release manifest

Date: 2026-09-25

## Decision

The repository owner explicitly requested consolidation of the active development branches into `main`, reconciliation of conflicts/false positives, an audit pass, and a fixed release version.

This document records the code-integration decision. It does **not** claim that a public VDS deployment, production mail delivery, existing-data migration, DNS/ACME, or every manual browser/visual acceptance gate has been executed.

Version: **1.1.0-beta.1**

All private workspace package manifests use the same prerelease version.

## Integration strategy

The release candidate was built from current `dev` plus the unique behavior from the remaining open, closed-unmerged, integration, reconciliation, and moderation branches.

Branches were **not** merged mechanically when their commit history had diverged from newer rebased implementations. In those cases, current-tree behavior was compared and only unique/non-superseded changes were reconciled.

This avoids reintroducing stale code while still preserving the useful work from every branch family.

## False-positive findings

### Diverged Git history did not always mean missing functionality

Several old branches reported many commits "missing" from the release candidate because the same behavior had already been rebased, cherry-picked, or rewritten in newer branches.

Examples include:

- DEVX-010: the older branch remained open while the rebased replacement had already merged;
- RESOURCE-012: Git history diverged, while the release route already contained target preflight, media-type validation, organization-aware authorization, and scanner fail-closed behavior;
- SERVER-008: branch ancestry diverged, while the release candidate already contained repository anti-bypass, consumed-proof linkage, legacy-request protection, and the moderator ownership journey.

These were treated as history false positives, not reasons to reapply stale commits.

### Real missing work discovered during reconciliation

The audit also found genuine omissions:

- SERVER-005 publication notifications were absent even though server follow and update-feed surfaces existed;
- the verification moderation control UI from `moderation/002-verification-controls` was absent;
- integrated J4/J5 journey tests from integration branches were absent;
- OPS-002 exact proxy body-limit checks were not fully present;
- reconciliation coverage exposed a scanner-outage response path using an undefined `NextResponse` symbol.

Those changes were restored or fixed in this release candidate.

## Problems fixed during final audit

### J4 upload/scanner path

- target authorization happens before multipart parsing, file buffering, scanner and storage work;
- non-multipart uploads receive 415 before body parsing;
- malicious and scanner-error verdicts fail closed before storage;
- scanner outages return correlated JSON with request ID and `Retry-After: 30`;
- the undefined `NextResponse` scanner-outage path was removed;
- ClamAV streaming remains bounded/backpressure-aware;
- review publication remains serialized and deterministic;
- reviewer artifact access remains private and clean/pending-only.

### Production proxy boundary

Caddy's previous `65MB` limit used decimal units and was lower than a 64 MiB application file limit.

The release uses an exact **68,157,440-byte** request envelope (65 MiB):

- 64 MiB maximum stored build;
- 1 MiB multipart allowance.

Disposable production smoke includes an oversized request at limit + 1 byte and expects HTTP 413 at the proxy.

### J5 free acquisition/download

- first claim and retry remain idempotent;
- expired entitlements renew to exactly one new active claim under concurrency;
- claim responses are private/no-store and authenticated before JSON parsing;
- download policy fails closed for unpublished resources;
- unentitled download remains 403;
- no-published-build remains 404;
- successful delivery exposes the recorded SHA-256;
- storage streams are destroyed if audit persistence fails;
- integrated claim-to-download coverage is retained.

### Server ownership/control

- generic server verification cannot bypass the live MTA control challenge;
- repository creation of generic server ownership requests is blocked;
- moderator approval requires a consumed durable challenge linked to the exact request/server/requester;
- legacy unproven pending requests cannot assign ownership;
- organization-owned servers do not silently become personal assets;
- organization server creation requires explicit server-management authority.

### Moderation

- build decisions require review context;
- verification moderation UI was restored;
- verification approve/reject now also requires review notes at the backend HTTP schema, so direct API calls cannot bypass the UI requirement;
- server claim proof enforcement remains backend-authoritative.

### Server follows and updates

- Follow server remains a saved-server action, not a live-status alert claim;
- moderated server-linked publication notifications were restored;
- fan-out is preference-aware, author-excluding, capped, and concurrency-bounded;
- notification failure cannot reverse an already-completed publication;
- update feed remains limited to moderated publication types.

## Acceptance coverage retained

The release candidate includes or restores coverage for:

- Biome lint baseline;
- Playwright runner foundation;
- environment doctor;
- Scenario Lab;
- isolated local verification;
- fail-closed release evidence;
- disposable backup/restore rehearsal;
- scanner and build moderation paths;
- server history/collector;
- server control proof;
- resource provenance;
- direct and reverse resource dependencies;
- free claim/download HTTP and DB/storage journeys;
- server follow/publication/update integration;
- J4 integrated upload safety;
- verification moderation surface.

## Known execution limitation

GitHub Actions hosted jobs have repeatedly been created with **zero executed steps** on recent candidate SHAs. The implementation includes release evidence and extensive test coverage, but a test file existing in the repository is not the same as that test executing successfully.

Therefore:

- promotion of this code to `main` is an explicit repository-owner decision;
- it is not evidence of a successful production deployment;
- the hosted-runner/account/billing/permission issue remains operational work;
- deployment to a real environment should still require a successful execution of the exact release/tag candidate and the environment-specific gates in `RELEASE-READINESS.md`.

## Release tag

The intended tag is:

```text
v1.1.0-beta.1
```

The tag must point to the final `main` merge commit for this release candidate.
