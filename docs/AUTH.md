# MTA NEXUS — authentication and account security

This document describes the implemented contract, not approval of the entire authentication system. Exact tested commits, environments and remaining release gates belong in [RELEASE-READINESS.md](RELEASE-READINESS.md).

## Credentials and sessions

Passwords are salted scrypt hashes; session bearer tokens are stored as SHA-256 digests in PostgreSQL. The browser receives `nexus_session` with `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` in production. Login/registration currently create sessions with a 14-day expiry. Session lists expose metadata, not bearer tokens or password hashes. Never put credentials, cookie jars or raw authentication responses into diagnostic artifacts.

Authorization must be checked on the server. The policy engine (`can`) and explicit ownership/membership checks enforce the individual routes; displaying or hiding a control is not authorization. A successful test of one route does not establish coverage of every private entity. Context switching verifies membership before selecting an organization context.

## Changing a known password — BETA-005b

The request needs a valid current session and the current password. The authoritative account is the session owner, never a `userId` supplied in the body. The existing validation requires a different new password of 8–128 characters; these bounds are the current product contract, not a claim of a completed password-policy review.

On success, one database transaction performs all four operations:

1. Update the password hash.
2. Delete the account's other sessions.
3. Replace the current session's bearer-token digest with a newly generated token.
4. Record the password-change audit event without passwords, hashes or tokens.

The current browser remains signed in using the new cookie. Its original expiry is preserved, not extended; all previously issued tokens for this account, including its previous current token, cease to authenticate subsequent requests. The response body contains only success and the count of other active sessions ended. Already authorized in-flight requests are not retroactively undone by revocation.

Password hashing/verification happens outside the short write transaction. Inside it, the repository locks the user row, rechecks the verified password-hash snapshot and verifies that the current session still belongs to that account and is unexpired. Login commits acquire the same user lock and reject an obsolete verified hash. This prevents a login verified against the old password from creating a new session after the password change commits. Simultaneous changes from the same credential snapshot do not both succeed.

If an operation inside this transaction fails, its database changes roll back together. A lost HTTP response after a successful commit is a different case: the browser may not know the result. The interface must not report success without confirmation or automatically resend a sensitive mutation. Sign in again before retrying an uncertain password change; neither a network error nor a timeout proves that no commit occurred.

## Ending sessions — BETA-005c

Settings distinguishes **This browser**, **End session**, and **End other sessions**. A selected foreign account's session cannot be ended through these operations. The dedicated session-management route rejects revoking the current session by ID; use the header's **Sign out** action for that browser. Ending other sessions does not change the password, rotate the current token, extend its expiry, or sign out the current browser.

Both manual operations now perform deletion and audit insertion in one transaction in `AuthRepository`. An audit-write failure rolls back the deletion. The operation locks the user row first, then locks and revalidates the initiating session. This matches the lock order used by login commits and password changes. A token that was revoked, rotated or expired while waiting cannot rely on the route's earlier authorization. The repository itself enforces ownership and the prohibition on ending the current session by ID.

The route takes the account and initiating token from the authenticated request, not from body fields. A missing or foreign selected target returns the same 404 response. Trying to end the current session returns 409; an invalidated initiator returns 401, including when discovered inside the transaction. Unexpected storage failures still return an unconfirmed-operation 503 without raw SQL parameters. Rate limits and response privacy headers are unchanged.

A repeated selected-target request cannot delete the row or create another success audit. An end-others request that deletes no rows returns zero without creating an audit event. When expired rows are removed along with active sessions, `revokedCount` counts only active sessions at the operation's cutoff; the audit also records `removedSessionCount` for all deleted rows. An expired-only cleanup can therefore have zero active revocations and still create an audit event for the actual cleanup.

**Concurrency boundary:** end-others is not a permanent sign-in ban. A login serialized before the revocation is included; a login serialized afterwards may create a valid new session using the unchanged password. Someone who may know the password requires a password change as well as session review. Two competing revocations cannot both proceed using an initiating session already removed by the first. These contracts cover the stated repository operations, not every private endpoint or arbitrary direct database writes.

`/api/auth/password`, `/api/auth/session`, and `/api/auth/sessions` return private, non-storable responses. Settings distinguishes a 401 authentication requirement from temporary unavailability. A failure to refresh the list after a confirmed mutation must not be presented as a failed mutation or an empty successful list. Loss of an HTTP response is still an uncertain client result, even when the database transaction is atomic; reload settings before retrying an uncertain revocation.

## Forgotten-password recovery — internal D1/D2a/D2b only

[ACCOUNT-RECOVERY.md](ACCOUNT-RECOVERY.md) separates the retained design, implemented proof/queue/lease primitives and remaining SMTP, enrollment and reset work. There is no public recovery endpoint, email sender, running dispatcher, activation gate or password-reset UI as a result of these tasks. Production Compose still fixes `EMAIL_PROVIDER` to `disabled`.

Registration still creates an active session with `emailVerified: false`. Moderator verification is not mailbox ownership. Private recovery tables do not bulk-trust legacy flags, alter existing passwords or add credential versions to public User payloads. An email-verification proof requires a valid initiating session and an internally verified password snapshot; a reset proof requires a current binding with a consumed verification from the same account/address. Admin/moderator and MFA-enabled recovery remain gated; existing login is unchanged.

Proof consumption requires a protected-action callback using the same `tx`; consumption, action and audit commit or roll back together. Current tests create synthetic bindings, not evidence of real mailbox ownership. Credential changes invalidate outstanding proofs through the custom SQL trigger; an email change also removes the binding. D3/D4 must perform complete enrollment/reset with all specified effects. Separate successful consume followed by a later password transaction is not acceptable.

D2a atomically enqueues a proof and encrypted mail under the persistent capacity gate. It uses AES-256-GCM with an explicit versioned key ring, no AUTH_SECRET fallback, and authenticated job/proof/user/purpose/expiry context. Terminal proofs discard associated pending or leased ciphertext in the same transaction. The old no-delivery `issue` remains internal. Actual key provisioning/rotation and backup handling require separate acceptance.

D2b adds `AccountMailWorkerRepository`: candidate IDs, exclusive claims, revalidated plaintext handoff, outcome settlement and bounded unavailable-job cleanup. Lease bearer secrets have a separate digest in PostgreSQL. A lease lasts at most 60 seconds and no longer than the proof/initiating session. Each claim consumes one of five allowed acquisitions, even if its process dies before sending. Explicit retries persist backoff and reuse the original proof/ciphertext without extending proof expiry. A stale lease cannot prepare mail or acknowledge/requeue another worker's attempt.

Claim, prepare and settle use user-first lock order and recheck the full account, purpose, address, credential version, initiating session or binding/provenance and wall-clock expiry after lock waits. Prepare additionally validates the decrypted token/recipient against the stored proof. Queue outcome and minimal audit share a transaction; audit failure restores the prior queue state. System audits identify `system:account-mail-worker`, not the recipient as an acting user. Secrets and raw transport failures are not recorded in these events.

**This is database coordination, not exactly-once SMTP.** No SMTP was used to establish these contracts. An `accepted` outcome is the trusted transport caller's report, not an inbox receipt. State can change after prepare returns, and a database lease cannot retract plaintext already held by a paused process. The future transport must honor sendBefore, bounded network time and cancellation without holding database locks during I/O. An uncertain SMTP acceptance may require resending the same message. Any link must still pass authoritative single-use checks when applied.

Expired/exhausted or terminal queue entries are removed without spending the underlying proof or deleting binding provenance. An active fifth lease is not purged merely for reaching five attempts. Cleanup is bounded to 100 entries and is not scheduled yet; deletion from live tables does not erase WAL/backups. Preserve the custom trigger functions and review production roles/search_path and future schema generation before deployment.

D2c adds an internal implicit-TLS SMTP adapter and bounded dispatcher. The dispatcher prepares a leased message, releases the database transaction, performs network I/O, then settles accepted/retry/discard through the D2b transaction. A lost final reply after DATA is classified as retryable and uncertain, never as confirmed delivery. The same one-time proof and original expiry are reused, so duplicate mail delivery is possible without creating a second valid proof.

The SMTP adapter verifies the server certificate with Node TLS and has no plaintext fallback. The application URL must be HTTPS; the challenge ID is a non-secret query parameter while the token is placed in the URL fragment. The transport/receiver do not log message bodies, recipients or tokens. D2c does not wire production SMTP configuration, credentials or a scheduler.

A closed Docker receiver is started only inside Verify. It uses a one-day synthetic localhost certificate generated by the runner and never relays to the internet. The integration covers accepted mail, 4xx retry, 5xx discard, timeout, connection loss after DATA, rejection of an untrusted certificate and a real disposable queue -> worker -> SMTP -> settlement path. The receiver logs only readiness. This proves the tested transport contract, not inbox delivery or a real provider.

**D2d is next:** explicit runtime key/transport provisioning, a bounded standalone dispatcher lifecycle with graceful shutdown/cleanup, and durable abuse limits before any public request endpoint. Production email remains disabled until provider-specific authentication/TLS and secret handling are accepted. Future reset must consume its proof, replace credentials, invalidate proofs and all sessions, audit and enqueue notification together; it then requires ordinary login. GET/mail preview must not mutate accounts.

Existing accounts must not be bulk-verified, deleted or silently locked out. Activation, transition, unsupported-account and privileged/MFA policies require a release-owner decision before rollout. R4 remains open until a working process and its rollout policy are verified.

## Verification and open work

- `tests/password-change-transaction.test.ts`, `session-revocation.test.ts`, `account-challenges.test.ts`: real PostgreSQL password/session/proof tests, rollback, selected concurrent operations and observed lock waits; synthetic users only.
- `account-mail-crypto.test.ts` and `account-mail-outbox.test.ts`: authenticated envelopes, explicit keys, atomic enqueue/capacity/invalidation/cleanup. A new key-ring instance is not an SMTP delivery test.
- `account-mail-worker.test.ts`: candidate/claim/lease/retry/outcome transactions, context revalidation, rollback and a child-process SIGKILL fixture. Retry/lease times are accelerated only on synthetic rows.
- `account-mail-dispatcher.test.ts` plus `packages/db/scripts/check-account-mail-smtp.ts`: dispatcher outcome/link tests and closed-Docker TLS transport integration. The integration uses synthetic recipients and a disposable account; it does not contact external SMTP or prove inbox delivery. See RELEASE-READINESS for the verified SHA and exact results.
- Existing account/password/directory browser suites remain regression checks of their earlier routes, not new recovery browser acceptance. The prior P10 explicitly mocks only a 503 response for the settings error view.

Database tests do not cover every HTTP race, lost response at commit, logout interleaving, already authorized in-flight request, external message delivery or all history/cache states. Full security/dependency, CSRF/XSS/session, MFA, private-route, RU/EN, visual/accessibility, real key management and environment/restore reviews remain open. An audit event or queued envelope is not a delivered security notification.

Design references: [OWASP authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [OWASP cryptographic storage](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html), [Node crypto](https://nodejs.org/api/crypto.html), [Drizzle transactions](https://orm.drizzle.team/docs/transactions), and [PostgreSQL 18 locking](https://www.postgresql.org/docs/18/explicit-locking.html). These references do not replace implementation tests.
