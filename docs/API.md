# MTA NEXUS 1.1 — HTTP API Reference

## 1. System Health Checks

### `GET /api/health`
Returns global health status, active version, uptime, and environment.

### `GET /api/health/db`
Verifies live connectivity to the PostgreSQL database (`SELECT 1`) and returns round-trip latency.

### `GET /api/health/storage`
Verifies availability of the configured storage provider (`local` / `s3`).

## 2. Authentication Endpoints

### `POST /api/auth/register`
Creates a new user record with salted scrypt hashing, opens a session, and sets an `httpOnly` cookie.
- **Request Body:**
  ```json
  {
    "email": "developer@example.com",
    "username": "mta_dev",
    "password": "Password123!",
    "displayName": "MTA Developer"
  }
  ```

### `POST /api/auth/login`
Validates credentials against PostgreSQL, registers a session record, and sets an `httpOnly` cookie.
- **Request Body:**
  ```json
  {
    "email": "admin@mta-nexus.com",
    "password": "password123"
  }
  ```

### `GET /api/auth/session`
Returns the currently authenticated user based on the incoming session cookie.

### `DELETE /api/auth/session`
Invalidates the current session in PostgreSQL and clears the session cookie.

## 3. Discovery & Search

### `GET /api/search?q=:query`
Unified search engine querying across Products, Servers, Articles, and Developers directly from PostgreSQL.

## 4. Commerce Endpoints

### `POST /api/checkout`
Requires an authenticated session (401 otherwise). Validates checkout input, creates an order, transitions payment state to `completed`, appends balanced entries to the double-entry financial ledger, and provisions cryptographic licenses and entitlements. Rate limited.

## 5. Product Endpoints

### `GET /api/products/:id`
Public product DTO (title, price, currency, license model, version). Returns 404 for unpublished products.

### `GET /api/products/:id/download`
Authorized build delivery. Requires session + entitlement/license/ownership. Returns the real published build metadata (version, SHA-256) or 404 when no published build exists. Fallback builds and synthetic hashes are prohibited. Rate limited.

### `GET /api/products/:id/reviews`
Public review list for a product.

### `POST /api/products/:id/reviews`
Review submission with integrity enforcement: verified purchase required for paid products, one review per user per product, self-reviews rejected. Recalculates the product rating from real review records. Rate limited.

## 6. Social & Notification Endpoints

### `GET/POST/DELETE /api/follow`
Follow/unfollow with target validation — target types restricted to `user`, `server`, `product`, `organization`, and the target must exist. Self-follow rejected. Notifies followed users.

### `GET /api/notifications`
Returns the authenticated user's notifications and unread count.

### `POST /api/notifications/mark-read`
IDOR-protected: a notification can only be marked read by its recipient (404 otherwise).

## 7. Trust & Moderation Endpoints

### `GET/POST /api/verification`
Submit and list verification requests (user, developer, organization, server). Rate limited to 3 per day.

### `GET/POST /api/reports`
Report submission with rate limiting; listing restricted to moderators.

### `POST /api/admin/actions`
Moderator-only actions: product feature/suspend/restore, report resolve/dismiss, verification approve/reject. Every action is audit logged.

## 8. Server Telemetry Endpoints

### `POST /api/server/installations/heartbeat`
Installation authentication via SHA-256 hashed API key. Records telemetry snapshots (players, status, module version), updates live server statistics, and records the last heartbeat. Rate limited.
