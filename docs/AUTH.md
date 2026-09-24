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

## Verification and open work

- `tests/password-change-transaction.test.ts`: actual PostgreSQL checks for wrong-password rejection, rotation/expiry, foreign-session rejection, rollback on an audit conflict, competing changes, and stale login snapshots.
- `packages/db/src/repositories/session-revocation.test.ts`: actual PostgreSQL checks for manual-revocation rollback, ownership, current-session protection, replay, active counts and selected competing requests. Six cases explicitly observe a database lock wait before revoking, expiring or rotating the synthetic initiator; they do not rely on a guessed sleep to order the operations.
- `scripts/tests/password-sessions.browser.mjs`: real HTTP/Chromium checks for password changes and session revocation. One explicitly identified 503 response fixture tests only the settings error view; it is not a database-outage rehearsal.
- Existing account and directory browser suites remain separate regression checks. Test accounts live in disposable CI databases; existing user databases are not seeded or modified by these tasks.

See the release map for the exact verified SHA and workflow results. Adding a test is not itself evidence that it passed. Database-level lock-wait and rollback checks do not establish coverage of every HTTP race, lost connection at commit, logout interleaving, or already authorized in-flight request.

Forgotten-password recovery and email verification remain an open release gate (R4). They are not implemented by changing a known password or ending sessions. MFA, a complete CSRF/XSS/session review, device identification, all history/cache states, production email delivery, all private routes and real-environment operations require separate evidence. A database audit event does not by itself prove that a security notification was delivered.

Design references: [OWASP authentication guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [Drizzle transactions](https://orm.drizzle.team/docs/transactions), and [PostgreSQL 18 locking](https://www.postgresql.org/docs/18/explicit-locking.html). These references do not replace testing the implementation.
