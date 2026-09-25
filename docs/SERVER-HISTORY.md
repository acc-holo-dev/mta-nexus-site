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


## SERVER-003 server-detail UI candidate

The stacked SERVER-003 candidate renders the 24-hour stored history directly in the server detail Server Component.

The UI deliberately distinguishes:

- an empty valid history window;
- a temporary history-storage failure;
- a stored observation whose player count is unknown;
- a real zero-player observation.

It shows sample count, peak, observed average and latest stored player count. The compact graph uses at most 24 evenly selected points from the bounded history result and requires no client-side chart library.

The graph is descriptive rather than uptime-oriented. It repeats that missing observations do not mean offline, scales bars to the peak stored player count, and renders neutral bars for samples where the player count was unknown.

Live master-list status and stored history are requested in parallel after the editorial server profile is resolved. A history failure does not remove live status, and a live-directory failure does not erase stored history.
