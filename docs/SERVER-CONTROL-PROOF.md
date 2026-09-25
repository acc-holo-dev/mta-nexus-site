# MTA server control proof

SERVER-008 introduces an agentless proof-of-control protocol for server ownership claims.

It is built on the official MTA master-list already used by NEXUS. It does not require installing a NEXUS resource, agent, heartbeat daemon or remote command channel on the game server.

## User flow

For an unverified listing, an eligible requester can create a short-lived control challenge.

The API returns a one-time token such as:

```text
NXCLAIM-0123456789ABCDEF01234567
```

The requester temporarily adds that exact token to the live MTA server name and asks NEXUS to verify control.

NEXUS accepts the proof only when all of these are true:

1. the challenge belongs to the authenticated requester and exact server ID;
2. the challenge is unconsumed, unrevoked and unexpired;
3. the official directory snapshot is not marked stale;
4. the snapshot timestamp is not older than challenge issuance;
5. the exact configured `address:port` is present;
6. the observed endpoint is not marked non-responding;
7. the observed server name contains the exact one-time token;
8. the server is still eligible for the requester;
9. no other ownership verification request became pending before transaction commit.

Only after those checks does NEXUS create a normal pending moderation request.

The requester may remove the token from the server name after proof succeeds.

## Token storage

The plaintext token is returned to the browser once.

PostgreSQL stores only a domain-separated SHA-256 digest:

```text
sha256("nexus:server-claim:v1\0" + token)
```

The token is not written to the verification request, audit event or moderator notification.

A challenge lasts 10 minutes. Issuing a new challenge for the same requester/server revokes the previous active challenge.

## Durable proof evidence

The challenge row records:

- server ID;
- requester ID;
- token digest;
- proof version;
- issuance/expiry;
- consumption time;
- official source fetch timestamp;
- generated verification request ID.

The created verification request stores a system-generated note identifying the challenge ID, source fetch time and proof version. It does not store the plaintext token.

The verification-request creation and challenge consumption happen in one database transaction. Failure rolls both back.

## Race behavior

SERVER-007 remains a prerequisite.

The final proof transaction locks the server row and re-checks owner/verified/pending-request state. Competing ownership claims cannot both become pending moderation requests.

If ownership or verification changes during proof, the proof fails closed.

## Generic verification anti-bypass

`POST /api/verification` no longer accepts new `targetType=server` requests.

It returns:

```text
SERVER_CONTROL_CHALLENGE_REQUIRED
```

Server ownership requests must originate from the control-challenge flow so a manual arbitrary `proofUrl` cannot bypass live-control proof.

Historical verification records remain readable/moderatable.

## UI surfaces

The control panel appears:

- on a public unowned/unverified server listing;
- in workspace management for a managed but unverified server.

The UI explicitly distinguishes:

```text
control proof recorded
!=
ownership assigned
```

Moderator approval remains required before `ownerId`/verified state changes.

## Security boundary

Master-list presence alone is not ownership proof.

A token is accepted only when it was generated for this requester/server and then observed in the server name on the exact endpoint in a fresh post-issuance master-list snapshot.

The protocol proves the requester could change the live server name during the challenge window. It does not prove legal ownership of a brand/domain/community, and moderator review remains the place for conflicting legal/community claims.

## Acceptance boundary

SERVER-008 provides implementation and prepared automated tests. It is **not accepted** until current migrations, typecheck, Vitest, build and browser scenarios execute successfully on the exact candidate SHA.

Because GitHub Actions jobs currently fail before runner steps (#7), this branch must remain draft and must not be promoted to release history based on file/test existence alone.
