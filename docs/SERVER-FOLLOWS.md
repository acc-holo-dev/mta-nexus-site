# Server follows

SERVER-004 exposes the existing generic `follows` model on server detail pages.

## User behavior

A signed-in user can:

- follow a public/non-suspended server;
- unfollow it;
- see the server in `/workspace/saved`.

A signed-out user sees **Sign in to follow**.

The component checks the current follow state through:

```text
GET /api/follow?targetType=server&targetId=<server-id>
```

The GET response now distinguishes anonymous and authenticated state while remaining private/no-store.

## Meaning

In this slice, **Follow server means save/follow the server**.

It does not yet mean:

- online/offline alerts;
- player-count threshold alerts;
- new-version alerts;
- automatic notifications for every server metadata change.

Those behaviors require separate notification-producing events and acceptance evidence. The UI deliberately avoids words such as “alerts” or “notify”.

## Existing data model

No watchlist table is added. Server follows continue to use the existing `follows` table with:

```text
targetType = server
targetId   = <server id>
```

The existing saved-items page resolves those follows back to public server cards.

## API notes

The follow-state GET:

- validates target type;
- bounds the target ID;
- returns `Cache-Control: private, no-store`;
- returns `authenticated: false` for guests;
- does not mutate state.

POST still verifies the target exists and rejects private/suspended server targets. DELETE remains idempotent so stale follows can be cleaned up even when a target is no longer publicly followable.
