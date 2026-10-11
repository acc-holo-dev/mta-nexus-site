import type { ServerStatisticsResult } from "../../apps/web/src/lib/services/server-statistics-service";
export function statisticsFixture(): ServerStatisticsResult {
  const summary = {
    observationCount: 100,
    knownPlayerCount: 90,
    observedFrom: "2026-10-10T01:00:00.000Z",
    observedTo: "2026-10-10T23:59:00.000Z",
    peakPlayers: 20,
    averagePlayers: 10,
    knownPlayerPercent: 90,
  };
  return {
    server: {
      id: "server",
      name: "Server <private>",
      slug: "server",
      visibility: "public",
      status: "active",
      endpointRevision: 0,
    },
    source: "mta_master",
    absenceMeansOffline: false,
    window: "24h",
    windowStart: "2026-10-10T00:00:00.000Z",
    windowEnd: "2026-10-11T00:00:00.000Z",
    previousStart: "2026-10-09T00:00:00.000Z",
    bucketSeconds: 3600,
    summary,
    previousSummary: { ...summary, averagePlayers: 5 },
    averagePlayerChange: 5,
    averagePlayerPercentChange: 100,
    buckets: [{ ...summary, bucketAt: "2026-10-10T01:00:00.000Z", maxPlayers: 64 }],
    observations: [
      {
        id: "obs_1",
        observedAt: "2026-10-10T01:00:00.000Z",
        currentPlayers: 0,
        maxPlayers: 64,
        gameMode: "mode",
        mapName: null,
        mtaVersion: "1.6",
        passworded: false,
        responding: null,
      },
    ],
    pageSize: 25,
    nextCursor: "obs_1",
    collectionEligible: true,
  };
}
