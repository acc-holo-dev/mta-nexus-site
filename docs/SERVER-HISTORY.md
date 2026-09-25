# Server observation history

SERVER-001 builds a read-only history surface on the existing `server_observations` table and the official MTA master-list source.

## What the first slice means

The endpoint:

```text
GET /api/servers/:id/history?window=24h|7d|30d
```

returns observations already stored for that server and opportunistically records the current master-list snapshot for the requested server.

Coverage is explicitly:

```text
demand_driven_confirmed_listings
```

This is **not** continuous monitoring.

A missing server in one master-list response is reported as `not_listed`. It is not stored as an offline observation, and the API explicitly returns `absenceMeansOffline: false`.

Therefore this first slice may support:

- latest observed player count;
- peak players among recorded observations;
- average players among observations that actually contain a player count;
- a chronological list of confirmed master-list snapshots.

It must not be used to claim:

- uptime percentage;
- downtime duration;
- continuous five-minute coverage;
- that absence from the public master-list proves the server was offline.

## Editorial/live separation

Recording an observation updates only runtime projection fields on the server row:

- current players;
- maximum players;
- last observed time;
- observation source.

It does not overwrite owner-managed name, gamemode, map or other editorial profile data.

The full raw master-list metadata remains in the immutable observation row.

## Deduplication

The master-list fetch timestamp is used as `sourceSequence`. The existing unique observation constraint plus `onConflictDoNothing()` makes repeated reads of the same cached directory snapshot idempotent.

## Next step

Continuous SERVER-001 monitoring requires a separately accepted collector/scheduler. That collector should reuse the same repository contract and should have its own frequency, retention, failure and resource-budget evidence before any uptime metric is exposed.
