# Server observation history

SERVER-001 builds a read-only history surface on the existing `server_observations` table.

## Read API

The endpoint:

```text
GET /api/servers/:id/history?window=24h|7d|30d
```

reads already stored observations for a non-private server. The GET route does not fetch the master-list and does not write to PostgreSQL.

Coverage is explicitly:

```text
stored_confirmed_observations
```

and the response declares:

```text
collectionMode: collector_required
absenceMeansOffline: false
```

This is not continuous monitoring.

Therefore this first slice may support:

- latest stored player count;
- peak players among stored observations;
- average players among observations that actually contain a player count;
- a chronological list of stored confirmed snapshots.

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

The full sourced metadata remains in the immutable observation row.

## Bounded reads

The repository caps history windows to 31 days and result sets to 500 observations. The public API exposes only 24-hour, 7-day and 30-day windows.

## Collection is separate

SERVER-001 intentionally does not make a GET request mutate state and does not introduce a scheduler.

The next step is an explicit collector that:

1. fetches one official master-list snapshot;
2. matches only known NEXUS server endpoints;
3. records confirmed listings with a stable source sequence;
4. does not translate absence into an offline observation;
5. is safe to retry;
6. has explicit runtime/frequency/resource limits before scheduling is enabled.

Until that collector is accepted, an empty history means only that NEXUS has no stored observations for the requested window.
