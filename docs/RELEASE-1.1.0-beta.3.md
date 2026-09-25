# MTA NEXUS 1.1.0-beta.3 — post-consolidation audit hardening

Date: 2026-09-25

## Decision

This prerelease is an audit/hardening follow-up to `1.1.0-beta.2`.

The repository owner explicitly requested that branch work be consolidated into
`main`, conflicts and false positives be investigated, real defects be fixed,
and the resulting repository version be pinned.

Version: **1.1.0-beta.3**

All private workspace package manifests use the same prerelease version.

This release candidate is a repository-integration decision. It is not a claim
that GitHub-hosted CI, production deployment, real SMTP delivery, real backup
restore, DNS/ACME or public rollout have been accepted.

## Branch reconciliation result

The historical feature branches remaining in the repository were audited by
current-tree behavior and artifact presence rather than commit ancestry alone.

Many old branches remain `diverged` from `main` because their changes were
rebased, copied, reconciled or squash-merged by the beta.1/beta.2 release
trains. Representative unique files from the J3/J4/J5/server-history/resource
dependency/release-evidence/scenario/local-verification branches are present in
current `main`.

Two initially suspected missing paths were false positives caused by guessed
file names. The actual Scenario Lab and local verification artifacts are
present under their current paths.

No historical branch was merged into the release merely because it was ahead
by commit ancestry; doing so could have reintroduced stale implementations.

## GitHub Actions false-positive classification

The hosted-runner problem tracked by #7 remains reproducible.

A controlled rerun of workflow run `36095124322` was accepted by GitHub, but
the rerun jobs again failed with **zero executed steps**. Zero-step job log
downloads returned `BlobNotFound`, consistent with no runner log being
produced.

This is treated as infrastructure/runner failure evidence, not as an
application test failure.

Exact-SHA automated acceptance therefore remains open.

## Real defects found and fixed

### 1. Build lifecycle event semantics

A newly uploaded build is persisted as `pending_review`.

Before this audit it nevertheless emitted `build.released`.

The lifecycle is now:

```text
upload + clean scan
  -> pending_review
  -> build.submitted_for_review
  -> moderator approval
  -> published
  -> build.released
```

Rejected builds never emit `build.released`.

### 2. Organization-owned server event shape

An organization-owned server may intentionally have no personal `ownerId`.

The `server.created` domain event now models optional `ownerId` and optional
`organizationId`, matching the canonical server entity.

### 3. Stale verification approval

Approval of user/developer/organization verification now fails closed when the
target disappeared after the request was created.

The verification request update and target update share one transaction, so a
stale target leaves the request pending instead of producing a false approved
record.

SERVER-008 proof requirements remain unchanged: server approval still requires
the exact consumed control-proof row.

### 4. Product restore publication bypass

Generic moderator `restore` no longer means “set product status to
published”.

The state machine now requires:

- suspend: only `published -> suspended`;
- restore: only `suspended -> published`;
- restore additionally requires at least one published build;
- stale/invalid transitions return 409.

A draft/pending/archived resource cannot be published through the restore
action.

### 5. Moderation state/audit atomicity

Several moderation paths previously mutated state and wrote the audit event in
separate transactions. An audit failure could therefore return HTTP 500 after
the action had already happened.

The following transitions now commit their state and audit together:

- content publish/archive;
- product feature/unfeature;
- product suspend/restore;
- report resolve/dismiss;
- verification approve/reject;
- build moderation already had transactional audit semantics.

Report resolution is also one-way: a resolved/dismissed report cannot be
silently resolved again.

Missing moderation targets remain 404. Existing targets whose state changed
return 409, preventing “already resolved” from being misreported as “not
found”.

### 6. Audited creation atomicity

Creation of products, servers, content and verification requests now commits
the created row and its audit event in one transaction.

A failed audit insert therefore rolls back the created row instead of returning
a false HTTP failure after persistence.

Server updates also commit their mutation and audit together.

### 7. Comment/review consistency

Article comment writes now commit their comment/counter/audit in one
transaction.

Product reviews commit:

- review row;
- serialized rating aggregate;
- product rating counters;
- audit event;

in one transaction.

Article-author notification is secondary best-effort delivery and cannot turn
a successfully committed comment into a false 500.

### 8. False review-journey evidence

The legacy public-platform test previously called the generic comment
repository and then manually edited the product rating, while describing that
as a review/rating journey.

It now uses the serialized `addProductReview` aggregate path and verifies the
calculated counters instead of manufacturing them.

The dedicated HTTP review route and entitlement checks remain the stronger
acceptance surface.

## New regression evidence in the tree

The candidate adds or strengthens tests covering:

- domain event lifecycle semantics;
- stale verification target rollback;
- moderation state/audit wiring;
- guarded product suspend/restore;
- report one-way resolution;
- audited creation rollback on audit failure;
- review aggregate semantics.

These test files are implementation evidence until runner #7 is restored and
the exact candidate SHA executes.

## Version consistency

The root package and every private workspace package are pinned to:

```text
1.1.0-beta.3
```

The existing release-version consistency regression test remains applicable.

Intended tag after merge:

```text
v1.1.0-beta.3
```

The current GitHub connector used for this maintenance session can update
branches and pull requests but does not expose tag creation. The tag must not
be claimed as created unless a Git ref for it actually exists.

## Remaining blockers

- #7 GitHub-hosted Actions jobs still fail before runner steps execute.
- Exact-SHA `pnpm release:verify` evidence is therefore not available for this
  candidate.
- Public production rollout is a separate decision.
- Real provider/inbox recovery acceptance remains separate.
- Operational backup/restore and environment-specific deployment evidence must
  still be executed on the real target environment.

## Release discipline

The interpretation remains:

```text
implemented != tested != accepted != deployed
```

This prerelease records the audited integrated repository state without
relabeling the runner failure as an application failure or pretending that
unexecuted test files are passing evidence.
