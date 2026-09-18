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

Returns active editorial server profiles. Each profile includes an explicit
`liveObservation` (or `null`) and `liveStatus` (`online`, `offline` or
`unknown`) matched to the official MTA master-list by normalized address/port.
The response also reports whether the directory snapshot is stale.

## Live MTA directory

### `GET /api/servers/directory`

Returns a bounded, paginated view of the official MTA master-list. Supported
query parameters include `offset`, `limit`, `query`, and `minPlayers`.
The endpoint exposes live observations only; editorial server profiles remain
under `/api/servers`.

When the official directory is unavailable, the endpoint returns `503` with
`Retry-After` and does not invent offline or zero-player data.

## Resources

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

## Community content

### `GET /api/content`

Returns publicly published articles, updates and posts. The optional `limit`
parameter is bounded to 100 items.

### `GET /api/content/:slug`

Returns one published article and up to 100 newest comments. Draft and archived
slugs return `404`; metadata reads do not increment the article view counter a
second time.

### `POST /api/content`

Creates content for the authenticated author. Player and creator submissions are
stored as `draft`; only an authorized moderator can request immediate
publication. Linked server, resource and organization IDs must exist. The
operation is rate limited per account.

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

Creates a validated abuse report for an existing user, server, product or content
target. Duplicate open reports by the same reporter and target are rejected.

### `POST /api/verification`

Submits an ownership/identity verification request. Moderators process requests
through the protected moderation queue.

No endpoint in this release activates payments, crypto settlement, seller
balances, payouts, or MTA server-side software.
