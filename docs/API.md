# MTA NEXUS HTTP API

This reference documents the current closed-beta API. The platform is player-first:
live server data comes from the official MTA master-list. NEXUS does not require an
in-game resource, heartbeat agent, `config.lua`, or runtime code on third-party
MTA servers.

All endpoints return JSON. Error objects expose a short, safe `error` message;
callers must not rely on internal implementation details.

## Authentication

### `POST /api/auth/register`

Creates an account, starts a session and sets the HTTP-only `nexus_session` cookie.
Registration is rate limited per client IP.

### `POST /api/auth/login`

Validates credentials, creates a session and sets the HTTP-only session cookie.
Failed attempts are rate limited per client IP.

### `GET /api/auth/session`

Returns the current authenticated user without password material.

### `GET /api/auth/sessions`

Returns metadata for the authenticated user's sessions. Session tokens are never
returned. The response is private and not cacheable.

### `GET /api/auth/context`

Returns the authenticated user's available contexts: a personal context plus
organization memberships (bounded to 50). The response is private and never
cached.

### `POST /api/auth/context`

Switches the active account context after verifying organization membership:

```json
{ "contextId": "org_..." }
```

Use `"personal"` to return to the personal context. Switches are rate limited
and recorded in the audit log; selecting an organization never grants permissions
beyond that membership.

### `DELETE /api/auth/sessions`

Revoke one owned session:

```json
{ "sessionId": "ses_..." }
```

Or revoke every other session while keeping the current session:

```json
{ "allOther": true }
```

### `POST /api/auth/password`

Changes the authenticated user's password after verifying the current password.
All other sessions are revoked. Password changes are audited and rate limited.

```json
{
  "currentPassword": "old password",
  "newPassword": "new password"
}
```

## Server profiles and live state

### `GET /api/servers`

Returns up to 100 active editorial server profiles (use the optional `limit`
parameter for a smaller page). Each profile includes an explicit
`liveObservation` (or `null`) and `liveStatus` (`online`, `offline` or
`unknown`) matched to the official MTA master-list by normalized address/port.
The response also reports whether the directory snapshot is stale. Editorial
metadata may include validated website, Discord and rules links, up to eight media
URLs, language, region and up to twelve gameplay tags; these fields never
override the live observation.

## Live MTA directory

### `GET /api/servers/directory`

Returns a bounded, paginated view of the official MTA master-list. Supported
query parameters include `offset`, `limit`, `query`, and `minPlayers`.
The endpoint exposes live observations only; editorial server profiles remain
under `/api/servers`.

When the official directory is unavailable, the endpoint returns `503` with
`Retry-After` and does not invent offline or zero-player data.

## Resources

### `GET /api/products`

Returns the free published resource catalog. The optional `limit` parameter is
bounded to 100 and successful responses use short public caching. Paid products
remain unavailable in the closed beta.

### `POST /api/products/:id/builds`

Uploads a free resource build for review. The server validates the archive
signature, size, extension, filename and derived MIME type before private
storage. New builds begin in `pending_review`, remain unsigned, and expose
scanner state honestly.

### `GET /api/products/:id/download`

Requires authentication and a valid entitlement (or resource ownership). Only
the latest published build is downloadable. The response includes the recorded
SHA-256 checksum, trusted MIME type and `nosniff` protection.

### `POST /api/resources/claim`

Claims a free published resource for the signed-in player and creates the
download entitlement. Paid resources and checkout remain disabled in the
closed beta.


## Product reviews

### `GET /api/products/:id/reviews`

Returns up to 100 newest reviews for a published free resource. Draft and
archived resources return `404`.

### `POST /api/products/:id/reviews`

Requires authentication, a valid `product.download` entitlement and a published
resource. Authors cannot review their own resource, and the database enforces one
review per user/resource even when concurrent submissions race.

## Search

### `GET /api/search?q=...`

Searches published resources, public servers, published content, developers and
organizations. The query is limited to 100 characters and the optional `limit`
is capped at 50. Use the optional `type` facet (`product`, `server`,
`developer`, `organization` or `article`) to restrict results. Empty queries
return an empty result set; repeated searches are rate limited per client IP and
successful responses use short public caching. Server player badges are shown
only when the official MTA directory has a matching observation.


## Creator profiles

### `GET /developers/:username`

Renders a public creator profile only for developer/admin accounts and bounds
published resource reads to 100. Identity verification is shown only when the
account's verification state is true; seller or reputation badges are not inferred.

## Community content

### `GET /api/content`

Returns publicly published articles, updates and posts. The optional `limit`
parameter is bounded to 100 items.

### `GET /api/content/:slug`

Returns one published article and up to 100 newest comments. Draft and archived
slugs return `404`; metadata reads do not increment the article view counter a
second time.

### `POST /api/content/:slug/comments`

Adds an authenticated comment or reply to a published article. Parent comments
must belong to the same article; writes are rate limited, update the comment
counter transactionally and notify the article author.

### `POST /api/content`

Creates content for the authenticated author. Player and creator submissions are
stored as `draft`; only an authorized moderator can request immediate
publication. Linked server, resource and organization IDs must exist. The
operation is rate limited per account.

### `POST /api/admin/actions` for content

Moderators can transition a submitted content draft with:

```json
{ "targetType": "content", "targetId": "cnt_...", "action": "publish" }
```

Use `archive` to reject/archive a draft. Both transitions require the moderation
capability and create an audit event.

## Notifications

### `GET /api/notifications`

Returns the authenticated user's notification feed. Use `limit` (bounded to
100) and `unreadOnly=true` for a focused feed. Responses are private and
not cacheable.

### `POST /api/notifications/mark-read`

Marks one owned notification read using `{ "id": "..." }`, or marks all of the
user's notifications read with an empty body. Mutations are rate limited.

### `GET /api/notifications/preferences`

Returns the authenticated user's in-app notification preferences.

### `PATCH /api/notifications/preferences`

Updates one or more preference flags:

```json
{
  "followsEnabled": false,
  "contentEnabled": true,
  "serverEnabled": true,
  "commerceEnabled": true,
  "systemEnabled": true
}
```

Security notifications are always delivered.

## Trust and safety

### `POST /api/reports`

Creates a validated abuse report for an existing user, server, product, content
or comment target. Duplicate open reports by the same reporter and target are rejected.

### `POST /api/verification`

Submits an ownership/identity verification request. Moderators process requests
through the protected moderation queue.

No endpoint in this release activates payments, crypto settlement, seller
balances, payouts, or MTA server-side software.
