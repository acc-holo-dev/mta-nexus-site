# MTA NEXUS 1.1.0-beta.4 — organization authority and listing audit

Date: 2026-09-25

## Decision

This prerelease is a post-consolidation correctness/security follow-up to
`1.1.0-beta.3`.

The repository owner requested that historical branch work be consolidated into
`main`, stale/duplicate branch state be audited rather than blindly merged,
false positives be separated from real defects, and the resulting repository
version be pinned.

Version: **1.1.0-beta.4**

All private workspace package manifests use the same prerelease version.

This is an owner-directed repository integration candidate. It is **not**
GitHub-hosted-CI acceptance, production deployment acceptance, or public
release approval.

## Historical branch reconciliation

At the start of this audit:

- `main` and `dev` were already identical at the beta.3 consolidation SHA;
- there were no open pull requests;
- `release/1.1.0-beta.3` was identical to `main`;
- older release branches were fully behind;
- remaining feature branches were typically 152–172 commits behind current
  `main` while their important files/invariants were already present in the
  consolidated tree.

Those old branches were therefore **not** mechanically merged by ancestry.
Doing so could have reintroduced stale implementations over newer audited code.

The current tree was checked directly for the major consolidated capabilities,
including:

- MTA meta.xml inspection;
- server follows, update feed, observation history and control challenge;
- resource provenance and dependency resolution;
- scanner fail-closed upload flow;
- deterministic build moderation/publication;
- free-claim and download authorization;
- release evidence;
- structured observability;
- backup/restore rehearsal.

## GitHub Actions blocker classification

Issue #7 remains a hosted-runner blocker.

A controlled re-run of workflow run `36095124322` was accepted by GitHub, but
all four core jobs again completed with **zero runner steps**:

- PostgreSQL persistence: job `108028278310`;
- Verify: job `108028278450`;
- Production Docker startup: job `108028278511`;
- Local Docker startup: job `108028278551`.

This rules out treating that run as an application test failure and also rules
out claiming exact-SHA acceptance.

The test changes listed below are implementation evidence until executable
runner evidence is restored.

## Real defects found and fixed

### 1. Organization product author attribution bypass

Organization-owned products keep `authorId` for attribution.

Before beta.4, the low-level product policy still treated that historical
`authorId` as permanent management authority. A delegated creator could
therefore retain preview/build release/build retirement authority after their
organization membership or `manage_products` permission had been revoked.

Beta.4 changes the rule:

- personal product: direct author remains manager;
- organization product: authority comes from the current organization
  relationship;
- direct organization owner, owner/admin membership and `manage_products`
  remain valid;
- historical author attribution alone is insufficient.

Integration coverage removes a delegated manager's membership after product
creation and verifies that access is revoked while the direct organization
owner retains authority.

### 2. Legacy organization server personal-owner bypass

New organization servers already avoid assigning a personal owner.

A migrated/legacy row could still contain both `organizationId` and
`ownerId`. The old policy allowed that historical personal owner to bypass
current organization permissions.

Beta.4 treats `ownerId` as direct authority only for personal servers without
`organizationId`.

A regression fixture deliberately creates the legacy shape and verifies:

- historical personal owner is denied;
- current direct organization owner is allowed.

### 3. Resource download authority disagreed with organization authority

The download route and pure download policy previously had their own
author/admin privilege shortcut.

That duplicated authorization logic and would have allowed a former creator of
an organization resource to skip the library entitlement requirement solely
through stale `authorId`.

Beta.4 uses the canonical `productService.canManageProduct()` verdict.

The pure delivery policy now knows only:

- publication state;
- current management verdict;
- active entitlement.

It no longer interprets `authorId` itself.

### 4. Direct organization owner missing from account contexts

Organization ownership is stored directly in `organizations.ownerId`;
organization creation does not automatically create an
`organization_members` row.

The account context endpoint and authoritative context switch previously looked
only at memberships. A direct owner without a separate membership row could
therefore be unable to see or select their own organization.

Beta.4:

- queries directly owned organizations;
- merges membership-backed organizations;
- de-duplicates owner + membership rows;
- reports direct ownership as role `owner`;
- authorizes switching by direct owner **or** membership;
- keeps the organization context list bounded.

### 5. Stale selected organization context

After organization membership revocation, the persisted `activeContextId`
could remain set to an organization the user could no longer access.

That stale value was not an authorization boundary, but it could produce a
false UI context.

The context GET now returns effective `personal` when the stored active
context is no longer present in the caller's current accessible contexts.

### 6. Organization profile global top-N truncation

The public organization profile previously loaded globally limited published
products/articles and only then filtered by `organizationId`.

A busy global catalogue could therefore make a valid organization appear to
have zero or incomplete releases/articles.

Beta.4 adds organization-scoped repository reads so filtering occurs in
PostgreSQL **before** the display limit.

The product query also enforces the closed-beta public boundary
`price = 0`, preventing legacy paid rows from reappearing on organization
profiles.

## Regression evidence added

The candidate adds or strengthens coverage for:

- delegated organization-product authority revocation;
- legacy organization-server personal-owner bypass;
- organization-aware download management;
- direct owner context discovery/switching;
- context de-duplication;
- revoked stale context fallback;
- organization-scoped public product/content queries;
- exclusion of draft, unrelated and legacy-paid organization resources.

## Version consistency

The root package and every private workspace package are pinned to:

```text
1.1.0-beta.4
```

The existing release-version consistency test remains the canonical regression
for manifest alignment.

## Release marker

The maintenance environment can create/update branch refs but does not expose a
Git tag creation action.

The release branch is therefore the repository marker available in this
session:

```text
release/1.1.0-beta.4
```

Intended immutable tag:

```text
v1.1.0-beta.4
```

The tag must not be claimed as created unless the Git ref actually exists.

## Remaining blockers

- #7 GitHub-hosted Actions still fail before runner steps execute.
- Exact-SHA `pnpm release:verify` evidence is unavailable.
- Production rollout is a separate decision.
- Real SMTP/provider/inbox recovery acceptance remains separate.
- Real target-environment backup/restore and deployment acceptance remain
  separate.

## Release discipline

```text
implemented != test-code-present != executed != accepted != deployed
```

Beta.4 records the audited integrated repository state without relabeling
zero-step runner failures as product failures and without raw-merging stale
historical branches over the newer consolidated tree.
