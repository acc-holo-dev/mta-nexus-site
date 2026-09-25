# Resource download authorization policy

RESOURCE-009 centralizes the authorization decision used by the default resource download route.

## Decision order

The route requires a valid session first.

For an existing resource, the route and pure policy apply this order:

1. resource must be `published`;
2. a current resource manager may download;
3. another user needs an active `product.download` entitlement;
4. otherwise access is denied.

The route obtains the management verdict through the canonical `productService.canManageProduct()` contract. For a personal resource, the direct author remains a manager. For an organization resource, historical `authorId` attribution does not bypass current organization authority; direct organization owner/admin/`manage_products` semantics apply.

Publication state is evaluated before management/entitlement shortcuts. A draft, suspended or archived resource is therefore not downloadable through the public route even by a manager or an old entitlement holder.

## HTTP behavior

The route preserves:

- anonymous request → 401;
- missing/unpublished resource → 404;
- published resource without access → 403;
- published resource with access but no published build → 404;
- unexpected storage/audit failure → 500.

RESOURCE-006 continues to determine the default artifact as the latest published build.

## Why this is a separate policy

The previous route encoded the same intent inline. A pure decision function makes the J5 matrix deterministic and independently testable, reducing the chance that future entitlement or author-preview changes weaken publication gating.

No new permission model or entitlement persistence is introduced.


## Organization attribution boundary

The pure download policy no longer inspects `authorId`. It receives an already-computed management verdict from the canonical authorization service.

This prevents a former delegated creator of an organization-owned resource from retaining privileged download access solely because their user ID remains as historical author attribution after organization permissions are revoked.
