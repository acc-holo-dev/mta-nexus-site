# Server ownership hardening

SERVER-007 tightens the existing server-management and verification-request foundations without claiming that J3 proof-of-control is complete.

## Registration request IP

Server registration now uses the shared `getTrustedRequestIp(request)` wrapper for abuse-rate-limit identity.

The low-level proxy parser is not called without its trusted-proxy secret.

## Organization-managed servers

Server management now has one service-level contract used by both PATCH and the workspace management page.

Access is allowed to:

- the direct server owner;
- administrators through the existing policy override;
- the owning organization's direct owner;
- organization members whose role/permissions satisfy the existing `server.manage` policy, including `manage_servers`.

This fixes the previous mismatch where the security policy supported organization memberships but the server service/page effectively behaved as direct-owner/admin only.

## Exclusive pending ownership claims

Unowned server claims are serialized in PostgreSQL using a transaction-scoped advisory lock derived from the server ID.

Inside the lock, the repository re-checks:

- the server still exists;
- it has not become owned by another requester;
- it is not already verified;
- no pending server-ownership request exists for that target, regardless of requester.

Only then is the pending verification request inserted.

The route also checks pending claims across requesters for an early friendly 409, but the repository transaction is the authoritative race protection.

## Deliberate remaining J3 gap

SERVER-007 does **not** declare proof-of-control complete.

`proofUrl` and notes remain moderator evidence fields. They are not an automatic proof that the requester controls the live MTA process.

Likewise, official master-list presence or online status is not treated as ownership proof.

A later J3 proof slice must define an explicit ownership challenge/proof protocol and its browser/user acceptance before J3 can be accepted.
