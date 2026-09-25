# Published build consistency

RESOURCE-006 defines one deterministic rule for the build represented by a resource's `currentVersion` and by the default download endpoint:

> newest **clean published** build by `createdAt DESC, id DESC`.

The ID tie-breaker is used only when two build timestamps are equal so every code path makes the same deterministic choice.

## Why this is needed

Multiple builds can be pending moderation at the same time.

Previously, approving a build always wrote:

```text
product.currentVersion = reviewed.version
```

If a newer submitted build was approved first and an older pending build was approved afterward, the product could advertise the older version while the download route still selected the newer published artifact by creation time.

That produced an inconsistent public state:

```text
resource page currentVersion != default downloaded build
```

## RESOURCE-006 behavior

After an approval transaction:

1. the reviewed build becomes `published`;
2. the transaction queries the newest clean published build for that product;
3. `products.currentVersion` is set to that build's version;
4. product status remains `published`.

Reject and retirement fallback selection use the same deterministic ordering.

The download route now asks the repository directly for `findLatestPublishedByProduct` instead of loading all builds and filtering them in application memory.

## Acceptance invariant

For a published free resource with at least one clean published build:

```text
product.currentVersion === findLatestPublishedByProduct(product.id).version // resolver excludes non-clean builds
```

The integration test explicitly creates two pending builds, approves them in reverse chronological order, and verifies the invariant. It then retires the newest build and verifies that both `currentVersion` and latest-download resolution move to the same fallback.

## Scope boundary

This rule defines release recency by submission/creation order, not semantic-version precedence.

RESOURCE-006 does not decide whether a numerically lower version is allowed to be uploaded after a higher one. A future semantic-version policy can be introduced separately if the product requires it.


## Scan-safety clarification

A `published` status alone is not sufficient to make a build downloadable or eligible for `currentVersion`. The canonical latest-build resolver also requires `scanStatus = clean`. This keeps stale or inconsistent non-clean rows out of default delivery resolution even if their status was previously published.
