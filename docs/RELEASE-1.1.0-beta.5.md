# MTA NEXUS 1.1.0-beta.5 — download audit semantics hardening

Date: 2026-09-25

## Decision

This prerelease is an audit-correctness follow-up to `1.1.0-beta.4`.

The repository owner requested consolidation of branch work into `main`, resolution of conflicts and false positives, continued audit, and a fixed prerelease version.

Version: **1.1.0-beta.5**

All private workspace package manifests use the same prerelease version.

This is a repository integration candidate. It is not production deployment acceptance and it does not convert the current GitHub-hosted runner failure into application test evidence.

## Branch consolidation audit

At the start of this pass:

- `main` and `dev` were identical at `9144b55707b2a8f78ca22ed45e1d3f01a79bb580`;
- `release/1.1.0-beta.4` pointed to the same SHA;
- there were no open pull requests;
- historical feature/integration branches remained in the repository with divergent commit ancestry.

A file-presence audit compared the current release tree with the historically closed-but-unmerged branch families for:

- server observation collector/history/follow notifications/update feed/control proof;
- resource dependency/reverse dependency/expired claim/build-upload preflight;
- Scenario Lab, environment doctor, isolated local verification and release evidence;
- authenticated GET cache policy;
- J4/J5/server-follow integration branches;
- reconciliation and verification moderation branches.

No branch-only file from those audited families was absent from current `main`.

This confirms the previous classification: old branch ancestry divergence is not, by itself, evidence of missing release functionality. Blindly merging those stale heads would risk reintroducing older implementations.

## Real defect found

### Download audit events claimed completion before stream completion

Both user resource downloads and moderator reviewer-artifact downloads perform a required audit write **before** returning the response stream.

That ordering is intentional for fail-closed delivery:

- if audit persistence fails, the opened storage stream is destroyed;
- the route returns 500 instead of delivering unaudited bytes.

However, the old action names were:

```text
product.downloaded
build.review_artifact_downloaded
```

Those names implied completed delivery even though the client may still disconnect or the stream may fail after the audit record is written.

That was a false-positive audit semantic.

Beta.5 changes the required pre-stream events to:

```text
product.download_started
build.review_artifact_download_started
```

The access decision, entitlement policy, moderator policy, storage stream, SHA-256 header and fail-closed audit requirement are unchanged.

No durable `download_completed` event is claimed by this change. A true completion event would require a separately designed stream-completion persistence model and must not be inferred from response creation alone.

## Regression evidence added

The candidate strengthens tests so that:

- the resource download route records `product.download_started`;
- the real DB integration path verifies that the new start event exists;
- the old false `product.downloaded` event is absent;
- moderator reviewer download records `build.review_artifact_download_started`;
- the build moderation integration path verifies the start event in the audit table;
- the old false reviewer `*_downloaded` event is absent.

Existing stream-destruction-on-audit-failure coverage remains intact.

## Version consistency

The root manifest and every private workspace package are pinned to:

```text
1.1.0-beta.5
```

The existing `release-version-consistency.test.ts` remains the canonical manifest-alignment regression.

## Hosted runner evidence

Before creating beta.5, a controlled rerun was executed on exact beta.4 release SHA:

```text
9144b55707b2a8f78ca22ed45e1d3f01a79bb580
```

Workflow run:

```text
36123372933
```

GitHub accepted the rerun request, but all five core jobs again completed with zero runner steps:

- Local Docker startup: 108036819335
- Production Docker startup: 108036819419
- Disposable backup restore: 108036819480
- PostgreSQL persistence: 108036819488
- Verify: 108036819552

This remains infrastructure/runner evidence, not an application-test failure.

Therefore the beta.5 test changes are implementation evidence until the exact beta.5 SHA executes on a functioning runner.

## Release marker

The connected GitHub App can update branch refs but does not expose creation of `refs/tags/*`.

The available repository marker for this prerelease is:

```text
release/1.1.0-beta.5
```

Intended immutable tag:

```text
v1.1.0-beta.5
```

The tag must not be claimed as created unless that Git ref actually exists.

## Remaining blockers

- #7 GitHub-hosted jobs still fail before runner steps execute.
- Exact-SHA `pnpm release:verify` execution remains unavailable.
- Production deployment remains a separate decision.
- Real SMTP/provider/inbox recovery acceptance remains separate.
- Target-environment backup/restore and deployment acceptance remain separate.

## Release discipline

```text
implemented != test-code-present != executed != accepted != deployed
```

Beta.5 fixes an audit false positive without overstating stream completion or CI acceptance.
