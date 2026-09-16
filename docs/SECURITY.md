# MTA NEXUS 1.3 — Security Model & Policies

## 1. Core Principles
- **No In-Memory Bypass:** All authentication, authorization, and session verification operate against PostgreSQL database records.
- **Server-Side Authorization (`can()`):** Role flags and organization permissions are resolved strictly on the server.
- **Cryptographic Password Security:** Scrypt key derivation with 128-bit random salt, timing-safe equality checks.
- **Financial Immutability:** Financial ledger entries (`ledger_entries`) are strictly append-only.

## 2. IDOR Protection (Nexus 1.3)
- **Notification Ownership:** `markAsRead(id, recipientId)` enforces recipient matching at the query level. A user cannot mutate another user's notification (verified by regression tests).
- **Purchase Isolation:** Checkout requires an authenticated session; no hardcoded user fallbacks exist.
- **Download Authorization:** Downloads reference a real published build only; fallback hashes and synthetic storage keys are prohibited.

## 3. Social Target Validation
`Follow` operations accept only contract-controlled target types (`user`, `server`, `product`, `organization`) and validate that the target exists in the database before persisting. Self-follow is rejected.

## 4. Review Integrity
- Paid products require a completed purchase (license) before a review can be submitted.
- One review per user per product (duplicate detection).
- Authors cannot review their own products.
- Product `ratingAverage` / `ratingCount` are recalculated from real review records — reviews are the source of truth.

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
| Heartbeat | 120 requests | 1 min per IP |
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
Server installations authenticate with a one-time displayed API key (`nxk_...`). Only the SHA-256 hash is persisted; the plaintext key cannot be recovered from the database.

## 8. Audit Logging
Critical platform actions (`LOGIN`, `LOGOUT`, `ORDER_CREATED`, `PAYMENT_COMPLETED`, `LICENSE_ISSUED`, `PRODUCT_DOWNLOADED`, `REVIEW_SUBMITTED`, `ADMIN_*`) are persisted to `audit_events` with actor, target, and metadata.
