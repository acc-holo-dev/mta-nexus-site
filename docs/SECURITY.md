# MTA NEXUS 1.1 — Security Model & Policies

## 1. Core Principles
- **No In-Memory Bypass:** All authentication, authorization, and session verification operate against PostgreSQL database records.
- **Server-Side Authorization (`can()`):** Role flags and organization permissions are resolved strictly on the server.
- **Cryptographic Password Security:** Scrypt key derivation with 128-bit random salt, timing-safe equality checks.
- **Binary Integrity & Storage Validation:** Uploaded archives require SHA-256 validation. Files exceeding 250MB or using unauthorized extensions are rejected.
- **Double-Entry Financial Immutability:** Financial ledger entries (`ledger_entries`) are strictly append-only. No UPDATE or DELETE operations are permitted on fiscal records.
- **Audit Logging:** Critical platform actions (`LOGIN`, `LOGOUT`, `USER_CREATED`, `ORDER_CREATED`, `PAYMENT_COMPLETED`, `LICENSE_ISSUED`) are persisted to `audit_events`.
