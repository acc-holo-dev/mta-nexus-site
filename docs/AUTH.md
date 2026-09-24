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

## Forgotten-password recovery — BETA-005d, internal D1/D2a only

[ACCOUNT-RECOVERY.md](ACCOUNT-RECOVERY.md) separates the retained D0 design, implemented proof/queue primitives and remaining delivery/enrollment/reset work. D2a adds internal encrypted queue acceptance, not a public reset/verification endpoint, email sender, activation gate or password-reset UI. Production Compose still fixes `EMAIL_PROVIDER` to `disabled`; SMTP fields are not delivery evidence.

Registration still creates an active session with `emailVerified: false`. Moderator `isVerified` is not mailbox ownership. Migration 0012 adds private `account_auth_state`, `auth_challenges` and `account_recovery_bindings`; it does not bulk-trust legacy flags or alter existing passwords, sessions or activation. Credential versions are not added to the public User payload.

The internal `AccountChallengeRepository` issues purpose-separated random token digests and consumes a proof only with a required transactional action callback and audit. It rechecks account, email, credential version, purpose, expiry and the appropriate initiating session or verified binding. For email verification the future calling service must first verify the user's current password; passing a hash snapshot is an internal consistency check, not external authentication. A reset proof needs a binding referencing an actually consumed verification for the same account/address. Existing booleans are insufficient. Admin/moderator and MFA-enabled accounts remain unavailable to this primitive pending a separate policy decision; their existing login behavior is unchanged.

The custom SQL trigger versions and invalidates open proofs whenever an ordinary SQL update actually changes a password hash or email. Email changes also remove the binding. No-op assignments and unrelated profile updates do not invalidate proofs. The trigger's writes roll back with the surrounding password transaction if that transaction fails. Keep this trigger in subsequent migrations; arbitrary privileged changes that disable it are not covered by these guarantees.

Token issuance/consumption and mail enqueue are currently used only by isolated tests, not application routes. Tests use synthetic proof/binding callbacks, not email delivery or proof of mailbox ownership. Neither D1 nor D2a performs a complete password reset or automatically revokes all sessions on proof consumption. D3/D4 must implement their protected action with the supplied transaction; a separate `consume` commit followed by a password write is not acceptable. Callback failures must throw; external side effects and detached work are not transactional.

D2a adds `AccountMailOutboxRepository.enqueue`: proof issuance, revocation of the previous pending proof, issuance audit and encrypted pending envelope share one READ COMMITTED transaction. The producer locks the persistent capacity gate after the user/proof context; a fresh count enforces the shared pending limit. Queue-full, encryption or insertion failure rolls back the whole issuance. Expiry is rechecked after the additional queue-lock wait. Enqueue returns only job/proof IDs and expiry, never a token or recipient. Standalone `issue` remains an internal no-delivery primitive; adding mail in a later transaction is still prohibited.

The AES-256-GCM envelope uses an explicitly supplied versioned key ring with no environment defaults or AUTH_SECRET fallback. Token and recipient are encrypted; authentication binds the envelope to its job ID, proof ID, user, purpose, expiry and key ID. The key is not stored in PostgreSQL. Application-side key provisioning, rotation operations and backups require separate acceptance; a pure encryption test does not certify deployment secret management.

Migration 0013 deletes pending envelopes transactionally when their proof is consumed or revoked, including credential-change invalidation. Deletion rolls back if the protected operation or audit fails. `discardExpired` removes at most 100 expired envelopes per call without deleting proof provenance; it is not yet scheduled. Removal from the live table is not erasure from WAL/backups. These internal methods are not exported from the public database barrel or exposed by HTTP.

**D2b is next:** delivery-worker leases, retry/deadline handling, durable abuse limits and a closed SMTP receiver. There is no SMTP acceptance, transmission retry, process-crash/restart delivery proof or end-user recovery yet. A future worker must revalidate the full proof/session/binding context before sending, and may not extend the proof lifetime. Public response privacy, enrollment, reset forms and real delivery remain separate gates. Future reset must consume its proof, replace credentials, invalidate proofs and all sessions, audit and enqueue notification together, then use ordinary login rather than creating a full session automatically. GET/mail preview must not mutate either flow.

Existing accounts must not be bulk-verified, deleted or silently locked out. Activation, transition, unsupported-account and privileged/MFA policies require a release-owner decision before rollout. R4 remains open until a working process and the agreed rollout policy are verified.

## Verification and open work

- `tests/password-change-transaction.test.ts`: actual PostgreSQL checks for wrong-password rejection, rotation/expiry, foreign-session rejection, rollback on an audit conflict, competing changes, and stale login snapshots.
- `packages/db/src/repositories/session-revocation.test.ts`: actual PostgreSQL checks for manual-revocation rollback, ownership, current-session protection, replay, active counts and selected competing requests. Six cases observe a database lock wait before revoking, expiring or rotating the synthetic initiator.
- `packages/db/src/repositories/account-challenges.test.ts`: D1 proof issuance/consumption, migration rehearsal with synthetic legacy rows, ownership/purpose, active context, audit/callback rollback, concurrency and invalidation after credential changes. Tests do not send email or implement an end-user reset.
- `packages/db/src/repositories/account-mail-crypto.test.ts` and `account-mail-outbox.test.ts`: envelope authentication/key rotation and actual PostgreSQL enqueue/rollback, capacity, reissue, invalidation, bounded cleanup and observed queue-lock expiry. A fresh key-ring instance reading stored ciphertext is not a process-restart or SMTP test.
- `scripts/tests/password-sessions.browser.mjs`: real HTTP/Chromium checks for existing password changes and session revocation. One explicitly identified 503 response fixture tests only the settings error view; it is not a database-outage rehearsal.
- Existing account and directory browser suites remain separate regression checks. Test accounts live in disposable CI databases; existing user databases are not seeded or modified by these tasks.

See the release map for the exact verified SHA and workflow results. Adding a test is not itself evidence that it passed. Database-level lock-wait and rollback checks do not establish coverage of every HTTP race, lost connection at commit, logout interleaving, or already authorized in-flight request.

Forgotten-password recovery and email verification remain an open release gate (R4). They are not implemented by changing a known password, ending sessions or adding internal proof/queue primitives. MFA, a complete CSRF/XSS/session review, device identification, all history/cache states, production email delivery, all private routes and real-environment operations require separate evidence. A database audit event or queued envelope does not prove that a security notification was delivered.

Design references: [OWASP authentication guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [OWASP cryptographic storage](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html), [Node crypto](https://nodejs.org/api/crypto.html), [Drizzle transactions](https://orm.drizzle.team/docs/transactions), and [PostgreSQL 18 locking](https://www.postgresql.org/docs/18/explicit-locking.html). These references do not replace testing the implementation.
