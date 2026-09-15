# MTA NEXUS — Security Model & Policies

## 1. Principles
- **No Client Secrets:** All sensitive credentials, database keys, and provider secrets are strictly isolated on the server.
- **Server-Side Authorization (`can()`):** Role checks are never made directly in UI components. The centralized `can(user, action, resource, context)` policy engine evaluates permissions based on ownership, verified status, and team assignments.
- **Opaque Predefined Identifiers:** All entities use opaque, collision-resistant prefixed IDs (e.g., `usr_`, `srv_`, `prd_`, `lic_`, `ord_`) generated using cryptographically secure random bytes (`crypto.randomBytes`).
- **Binary Integrity:** Uploaded builds and resource packages require SHA-256 integrity validation upon upload and before distribution to MTA servers.
- **Financial Immutability:** Financial balances are derived strictly from append-only double-entry ledger records (`LedgerEntry`).
- **Rate Limiting:** Sliding-window rate limiters defend public endpoints against brute force, denial of service, and scraping.
- **Tamper-Proof Audit Trail:** Critical operations (role promotions, server verifications, moderation actions, build releases) are committed to `audit_events`.
