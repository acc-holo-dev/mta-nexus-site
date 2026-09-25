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

## SERVER-005 moderated publication notifications

SERVER-005 adds one concrete notification producer to server follows: when a moderator changes server-linked content from a non-published state to `published`, followers can receive a `type=server`, `category=server` notification linking to that published content.

This does **not** change the meaning of live server monitoring. It still does not produce online/offline, uptime, player-count threshold or master-list alerts.

### Safety and delivery rules

- direct community-content creation does not invoke this fan-out;
- only the audited moderator publication path invokes it;
- private or suspended servers are skipped;
- the content author is not notified about their own publication;
- `serverEnabled=false` suppresses delivery through the existing notification preference repository;
- delivery is capped at 100 eligible followers per publication;
- notification work runs in batches of at most 10 concurrent deliveries;
- the cap reports a truncation sentinel internally instead of pretending all followers were processed;
- a notification failure is secondary and cannot turn an already-completed publication into a failed moderation response.

This first fan-out is synchronous and best-effort. It is suitable for the closed-beta scale but is not a durable high-volume notification system. A future large-scale design should move publication fan-out to an accepted transactional outbox/worker rather than increasing the synchronous cap.
