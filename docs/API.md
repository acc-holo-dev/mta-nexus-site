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
Validates checkout input, creates an order, transitions payment state to `completed`, appends balanced entries to the double-entry financial ledger, and provisions cryptographic licenses and entitlements.
