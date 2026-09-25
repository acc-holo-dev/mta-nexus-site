# Linked content target authorization

CONTENT-001 closes a provenance gap in content creation.

A content record may carry optional links to a server, resource or organization. Existence of the target alone is not enough to let an author attach content to it.

## Server links

When `serverId` is supplied, content creation now requires the actor to satisfy the existing `server.manage` policy for that server.

This permits:

- the server owner;
- an authorized organization member according to the existing server policy;
- administrators through the normal policy override.

It rejects an arbitrary signed-in user who merely knows a valid server ID.

## Resource links

When `productId` is supplied, content creation requires the existing `product.update` policy for that resource.

This prevents an author from making a publication appear associated with another developer's resource.

## Organization links

The existing organization ownership/membership check remains in place.

Memberships are loaded lazily and reused within the same request so a content submission linking multiple organization-backed targets does not perform duplicate membership reads.

## Why this blocks server-feed spoofing

SERVER-006 can show moderated server-linked publications on a server page, and SERVER-005 can notify followers after moderator-approved publication.

Without CONTENT-001, a user could submit content linked to a server they did not control and rely on moderation to catch the false association manually.

CONTENT-001 moves that invariant to the write boundary: an unauthorized association cannot enter the normal content workflow in the first place.

Moderation remains required for the moderated content types; authorization and moderation are separate controls.
