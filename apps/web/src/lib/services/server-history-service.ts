import { serverObservationRepository, serverRepository } from "@nexus/db";
import type { Server } from "@nexus/domain";

import { serverHistoryWindows, type ServerHistoryWindow } from "../server-history-window";
export { serverHistoryWindows } from "../server-history-window";

type ServerHistoryListing = Pick<Server, "id" | "slug" | "name" | "visibility">;

export const serverHistoryService = {
  async getHistory(serverId: string, window: ServerHistoryWindow) {
    const server = await serverRepository.findById(serverId);
    if (!server) return null;
    return this.getHistoryForServer(server, window);
  },

  // SSR already fetched this server for its detail page. Avoid a redundant
  // SELECT here; enforce the same visibility boundary as the public API.
  async getHistoryForServer(server: ServerHistoryListing, window: ServerHistoryWindow) {
    if (server.visibility === "private") return null;

    const hours = serverHistoryWindows[window];
    const data = await serverObservationRepository.readWindow(server.id, hours, 500);
    const observations = data.observations;
    const latest = observations.at(-1);

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
      summary: {
        observationCount: data.summary.observationCount,
        knownPlayerCount: data.summary.knownPlayerCount,
        observedFrom: data.summary.observedFrom?.toISOString() ?? null,
        observedTo: data.summary.observedTo?.toISOString() ?? null,
        peakPlayers: data.summary.peakPlayers,
        averagePlayers: data.summary.averagePlayers,
        latestPlayers: latest?.currentPlayers ?? null,
        latestMaxPlayers: latest?.maxPlayers ?? null,
      },
      windowStart: data.windowStart.toISOString(),
      windowEnd: data.windowEnd.toISOString(),
      sampleLimit: data.sampleLimit,
      samplesTruncated: data.summary.observationCount > observations.length,
      bucketSeconds: data.bucketSeconds,
      buckets: data.buckets.map((bucket) => ({
        ...bucket,
        bucketAt: bucket.bucketAt.toISOString(),
      })),
      observations: observations.map((observation) => ({
        id: observation.id,
        observedAt: new Date(observation.observedAt).toISOString(),
        currentPlayers:
          typeof observation.currentPlayers === "number" ? observation.currentPlayers : null,
        maxPlayers: typeof observation.maxPlayers === "number" ? observation.maxPlayers : null,
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
