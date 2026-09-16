# MTA NEXUS 1.1 — Authentication & Authorization

## 1. Real User & Session Architecture
MTA Nexus 1.1 stores all user credentials and active sessions in PostgreSQL:
- **Passwords:** Hashed with salted scrypt (`packages/security/src/password.ts`) with timing-safe comparison.
- **Sessions:** Persisted in the `sessions` table with an expiration timestamp and foreign-key link to `users`.
- **Cookies:** Issued with `HttpOnly`, `SameSite: Lax`, and `Secure` (in production).

## 2. Server-Side Policy Engine (`can()`)
No authorization decisions are made on the client. All actions are verified through `can(user, action, resource, context)`:
- `admin.access`, `admin.moderation`, `admin.audit`: Reserved for administrative and moderator accounts.
- `product.create`, `build.release`, `product.update`: Verified against resource author or verified organization permissions.
- `server.manage`, `server.delete`: Verified against server ownership or organization role.

## 3. Real Context Switching
Users can switch between Personal and Organization contexts (`personal` vs `org_id`). The system verifies that the user holds an active membership record in the target organization before switching.
