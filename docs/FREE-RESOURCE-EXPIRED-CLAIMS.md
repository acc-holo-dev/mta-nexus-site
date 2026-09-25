# Expired free-resource claim recovery

RESOURCE-008 aligns free-claim idempotency with download entitlement semantics.

An entitlement is active only when its `expiresAt` is null or in the future. The download authorization path already uses that rule.

Previously, `claimFreeResource` treated any matching direct entitlement as an existing claim even when it had expired. A retry could therefore return `alreadyClaimed=true` while `hasEntitlement(..., "product.download")` still returned false.

RESOURCE-008 changes the claim transaction to consider only active matching entitlements idempotent.

If only expired direct entitlements exist, a new non-expiring free claim is inserted and the library-addition counter advances once for that renewed acquisition. A subsequent retry sees the new active entitlement and remains idempotent.

This does not alter license fallback semantics or introduce automatic renewal of paid/expiring licenses.
