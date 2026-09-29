import {
  serverObservationRepository,
  serverRepository,
} from "@nexus/db";
import type { ServerObservation } from "@nexus/domain";

export const serverHistoryWindows = {
  "24h": 24,
  "7d": 24 * 7,
  "30d": 24 * 30,
} as const;

export type ServerHistoryWindow = keyof typeof serverHistoryWindows;

export type ServerHistorySummary = Readonly<{
  observationCount: number;
  observedFrom: string | null;
  observedTo: string | null;
  peakPlayers: number | null;
  averagePlayers: number | null;
  latestPlayers: number | null;
  latestMaxPlayers: number | null;
}>;

export function summarizeServerObservations(
  observations: readonly ServerObservation[],
): ServerHistorySummary {
  const ordered = [...observations].sort(
    (left, right) =>
      new Date(left.observedAt).getTime() - new Date(right.observedAt).getTime(),
  );
  const playerCounts = ordered
    .map((observation) => observation.currentPlayers)
    .filter((value): value is number => typeof value === "number");
  const latest = ordered.at(-1);

  return Object.freeze({
    observationCount: ordered.length,
    observedFrom: ordered[0]?.observedAt
      ? new Date(ordered[0].observedAt).toISOString()
      : null,
    observedTo: latest?.observedAt
      ? new Date(latest.observedAt).toISOString()
      : null,
    peakPlayers:
      playerCounts.length > 0 ? Math.max(...playerCounts) : null,
    averagePlayers:
      playerCounts.length > 0
        ? Math.round(
            (playerCounts.reduce((sum, value) => sum + value, 0) /
              playerCounts.length) *
              10,
          ) / 10
        : null,
    latestPlayers:
      typeof latest?.currentPlayers === "number"
        ? latest.currentPlayers
        : null,
    latestMaxPlayers:
      typeof latest?.maxPlayers === "number"
        ? latest.maxPlayers
        : null,
  });
}

export const serverHistoryService = {
  async getHistory(
    serverId: string,
    window: ServerHistoryWindow,
  ) {
    const server = await serverRepository.findById(serverId);
    if (!server || server.visibility === "private") return null;

    const hours = serverHistoryWindows[window];
    const observations = await serverObservationRepository.listWindow(
      server.id,
      hours,
      500,
    );

    return Object.freeze({
      server: {
        id: server.id,
        slug: server.slug,
        name: server.name,
      },
      source: "mta_master" as const,
      window,
      coverage: "stored_confirmed_observations" as const,
      collectionMode: "collector_required" as const,
      absenceMeansOffline: false as const,
      summary: summarizeServerObservations(observations),
      observations: observations.map((observation) => ({
        id: observation.id,
        observedAt: new Date(observation.observedAt).toISOString(),
        currentPlayers:
          typeof observation.currentPlayers === "number"
            ? observation.currentPlayers
            : null,
        maxPlayers:
          typeof observation.maxPlayers === "number"
            ? observation.maxPlayers
            : null,
        gameMode: observation.gameMode ?? null,
        mapName: observation.mapName ?? null,
        mtaVersion: observation.mtaVersion ?? null,
        passworded: observation.passworded ?? null,
      })),
    });
  },
};

export type ServerHistoryResult = NonNullable<
  Awaited<ReturnType<(typeof serverHistoryService)["getHistory"]>>
>;
