# MTA NEXUS 1.3 — Security Model & Policies

## 1. Core Principles
- **No In-Memory Bypass:** All authentication, authorization, and session verification operate against PostgreSQL database records.
- **Server-Side Authorization (`can()`):** Role flags and organization permissions are resolved strictly on the server.
- **Cryptographic Password Security:** Scrypt key derivation with 128-bit random salt, timing-safe equality checks.
- **Financial Boundary:** Paid commerce is disabled. Existing ledger tables are a redesign foundation and are not claimed to be immutable production accounting.

## 2. IDOR Protection (Nexus 1.3)
- **Notification Ownership:** `markAsRead(id, recipientId)` enforces recipient matching at the query level. A user cannot mutate another user's notification (verified by regression tests).
- **Purchase Isolation:** Checkout requires an authenticated session; no hardcoded user fallbacks exist.
- **Download Authorization:** Downloads reference a real published build only; fallback hashes and synthetic storage keys are prohibited.

## 3. Social Target Validation
`Follow` operations accept only contract-controlled target types (`user`, `server`, `product`, `organization`). Products must be published and free; private/suspended servers are rejected. Duplicate creation is resolved atomically at the unique database boundary, and self-follow is rejected.

## 4. Review Integrity
- Closed-beta reviews require a real `product.download` entitlement for a published free resource.
- One review per user per product (duplicate detection).
- Authors cannot review their own products.
- Product `ratingAverage` / `ratingCount` are recalculated from real review records inside the same serialized transaction as insertion.

## 5. Rate Limiting Matrix
| Endpoint Class | Limit | Window |
|---|---|---|
| Login | 8 attempts | 5 min per IP |
| Register | 5 attempts | 1 hour per IP |
| Checkout | 10 attempts | 1 min per IP |
| Downloads | 30 requests | 1 min per user |
| Reviews | 5 submissions | 5 min per user |
| Reports | 10 submissions | 1 hour per user |
| Verification requests | 3 requests | 24 hours per user |
| Build uploads | 10 requests | 1 hour per user |
| Resource metadata updates | 30 requests | 1 hour per user |
| Follow mutations | 30 requests | 1 min per user |
| Public search | 60 requests | 1 min per IP |
| Admin actions | 60 actions | 1 min per user |

## 6. Verification Workflow
`isVerified` flags can never be set directly through public APIs. They are granted exclusively through:
```text
Request (POST /api/verification)
  ↓
Admin Review (admin queue)
  ↓
Approve / Reject (POST /api/admin/actions)
  ↓
Audit event recorded
```

## 7. Installation Credential Security
NEXUS does not accept telemetry credentials or runtime heartbeats from game servers. Live facts are collected by the platform from public MTA sources and stored with their source and observation time.

## 8. UI Data Isolation
Server components enforce session isolation at the page level, not only in API routes:
- `/workspace`, `/workspace/purchases`, `/workspace/licenses`, `/workspace/sales`, `/workspace/saved` render only the authenticated user's records; anonymous visitors receive a "Sign in required" state.
- `/admin` requires a real admin/moderator session (verified via `can(user, "admin.access")`); no synthetic or fallback admin identities exist.

## 9. Audit Logging
Security-relevant application actions are persisted to `audit_events` with actor,
target and metadata where the corresponding service explicitly records them.
The table is an operational audit trail, not yet a cryptographically tamper-proof
or database-enforced append-only log.

## 10. Known Security Limitations
- **Rate limiter is in-memory (`MemoryRateLimit­er`)** — per-process, resets on restart, not shared across multiple instances. Redis is deliberately deferred until horizontal scaling is actually required.
- **Payments** — paid resources and money movement are disabled; no external PSP is configured.
- **Private storage** — production currently uses a mounted local volume; an S3-compatible provider remains deferred.
- **Email flows** (verification, password reset) are not implemented.
- **2FA** — schema foundation only, no flow.
- **Audit immutability** — application code appends records, but database roles/triggers do not yet prevent modification by a privileged database actor.
- Development seed contains demo statistics; production server activity comes exclusively from sourced public observations.
