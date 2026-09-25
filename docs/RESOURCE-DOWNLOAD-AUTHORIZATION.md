# Resource download authorization policy

RESOURCE-009 centralizes the authorization decision used by the default resource download route.

## Decision order

The route requires a valid session first.

For an existing resource, the pure policy applies this order:

1. resource must be `published`;
2. resource author may download;
3. administrators may download;
4. another user needs an active `product.download` entitlement;
5. otherwise access is denied.

Publication state is evaluated before author/admin/entitlement shortcuts. A draft, suspended or archived resource is therefore not downloadable through the public route even by its author or an old entitlement holder.

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
