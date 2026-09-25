# Canonical organization resource authorization

AUTHZ-001 aligns organization-owned servers, resources and linked publications around service-level management contracts.

## Why this is needed

An organization has a direct `ownerId`, but organization creation does not automatically insert that owner into `organization_members`.

The low-level `can(..., context.organizationMemberships)` policy can authorize organization members, but it cannot infer the direct organization owner from a server or product record alone.

SERVER-007 introduced `serverService.canManageServer()` to resolve that gap for server management.

AUTHZ-001 adds the equivalent `productService.canManageProduct()` and uses the two service contracts at the content-link write boundary.

## Product management contract

`productService.canManageProduct(product, actor, action)` permits:

- the direct product author for personal products only;
- administrators through the existing policy override;
- the direct owner of the product's organization;
- organization members accepted by the existing product policy, including `manage_products`.

The helper is now used for:

- non-public product preview;
- build submission/release authorization;
- build retirement authorization.

## Linked content

When content supplies `serverId`, the route resolves the server and calls `serverService.canManageServer()`.

When content supplies `productId`, the route resolves the product and calls `productService.canManageProduct()`.

A valid ID is therefore not sufficient to associate content with another owner's server or resource.

Missing targets remain 404. Existing targets the actor does not manage return 403.

## Moderation boundary

This authorization does not make moderated content publish automatically.

It only establishes that the author is allowed to create the association. Existing moderation rules still decide whether article/news/devlog/update/announcement content becomes published.

## Dependency

This PR is intentionally stacked on SERVER-007 because the canonical server-management helper is defined there. It supersedes the narrower CONTENT-001 draft.

## Organization server creation boundary

New organization-linked servers are organization-managed rather than silently becoming personal assets of the user who submitted the form.

For a request with `organizationId`:

- the route does not assign `ownerId` to the submitting user;
- creation requires the direct organization owner, an organization owner/admin member, or an explicit `manage_servers` permission;
- organization role `developer` alone does not imply server-management permission;
- after creation, the same `serverService.canManageServer()` contract governs updates.

For a personal server without `organizationId`, the creator remains the direct `ownerId`.

This keeps delegated organization permissions from becoming permanent personal ownership by accident.


## Organization product authority revocation

For a product with `organizationId`, `authorId` is attribution only. It does not grant permanent management authority.

Organization product authority follows the current organization relationship:

- direct organization owner;
- organization owner/admin membership;
- explicit `manage_products` permission;
- administrator override.

If a delegated creator loses the membership or `manage_products` permission that allowed them to manage the organization resource, they can no longer preview the draft or release/retire builds merely because their user ID remains in `authorId`.

Personal products without `organizationId` keep the existing direct-author management rule.
