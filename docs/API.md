# MTA NEXUS HTTP API

This reference documents the public integration contract that exists in the closed beta. The platform is player-first; marketplace checkout, balance, payouts, crypto and entitlement APIs are deliberately **not** available in this release.

All endpoints return JSON. Error objects expose a short, safe `error` message; callers must not rely on internal implementation details.

## Authentication

### `POST /api/auth/register`

Creates an account, starts a session and sets the HTTP-only session cookie.

### `POST /api/auth/login`

Validates credentials, creates a session and sets the HTTP-only session cookie.

### `GET /api/auth/session`

Returns the current authenticated user without password material.

### `DELETE /api/auth/session`

Invalidates the current session and clears its cookie.

## Server installation

### `POST /api/servers/:id/installations`

Creates an installation key for a server owned by the signed-in user.

Request body (optional):

```json
{ "moduleVersion": "0.1.0" }
```

Successful response (`201`) includes `installationId`, `serverId`, `moduleVersion`, and a plaintext `apiKey`. The key is returned exactly once. Store it only in the MTA server's local `config.lua`.

Rate limit: 5 new installation keys per user per hour.

### `POST /api/server/installations/heartbeat`

Accepts a heartbeat from an active installation. The MTA NEXUS Agent sends this endpoint automatically.

```json
{
  "apiKey": "installation-key-shown-once",
  "status": "online",
  "currentPlayers": 42,
  "maxPlayers": 128,
  "moduleVersion": "0.1.0"
}
```

Rules:

- `apiKey` must be an active installation key and is never returned by this endpoint.
- `status` is `online`, `offline`, or `maintenance`; it defaults to `online`.
- `currentPlayers` is an integer from 0 to 4096 and cannot exceed `maxPlayers`.
- `maxPlayers` is an integer from 1 to 4096.
- `moduleVersion` and `mtaVersion` are optional strings of at most 32 characters.

A successful response is:

```json
{
  "success": true,
  "serverId": "server-id",
  "recordedAt": "2026-09-16T20:00:00.000Z"
}
```

Rate limit: 120 requests per IP address per minute.

## Discovery

### `GET /api/search?q=:query`

Searches the publicly visible NEXUS catalogue.

## Trust and safety

The closed beta provides reporting, moderation and verification routes for platform operations. Their internal administration contracts are intentionally not public integration APIs.

## MTA resource

The reference implementation is in [resources/mta-nexus-agent](../resources/mta-nexus-agent). It sends only server status and counts over HTTPS.
