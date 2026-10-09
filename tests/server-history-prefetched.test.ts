import { beforeEach, describe, expect, it, vi } from "vitest";

const repositories = vi.hoisted(() => ({
  findById: vi.fn(),
  readWindow: vi.fn(),
}));

vi.mock("@nexus/db", () => ({
  serverRepository: { findById: repositories.findById },
  serverObservationRepository: { readWindow: repositories.readWindow },
}));

import { serverHistoryService } from "../apps/web/src/lib/services/server-history-service";

const listing = {
  id: "srv_known",
  slug: "known-server",
  name: "Known server",
  visibility: "public" as const,
};
const observation = {
  id: "obs_known",
  serverId: listing.id,
  source: "mta_master" as const,
  observedAt: new Date("2026-10-09T07:00:00.000Z"),
  currentPlayers: 21,
  maxPlayers: 64,
  createdAt: new Date("2026-10-09T07:00:00.000Z"),
};

beforeEach(() => {
  repositories.findById.mockReset();
  repositories.readWindow.mockReset();
  repositories.readWindow.mockResolvedValue({
    observations: [observation],
    buckets: [],
    sampleLimit: 500,
    bucketSeconds: 3600,
    windowStart: new Date("2026-10-08T07:00:00Z"),
    windowEnd: new Date("2026-10-09T07:00:00Z"),
    summary: {
      observationCount: 1,
      knownPlayerCount: 1,
      observedFrom: observation.observedAt,
      observedTo: observation.observedAt,
      peakPlayers: 21,
      averagePlayers: 21,
    },
  });
});

describe("server detail history with prefetched listing", () => {
  it("uses the trusted page listing without a second server lookup", async () => {
    const history = await serverHistoryService.getHistoryForServer(listing, "24h");
    expect(repositories.findById).not.toHaveBeenCalled();
    expect(repositories.readWindow).toHaveBeenCalledExactlyOnceWith(listing.id, 24, 500);
    expect(history).toMatchObject({
      server: { id: listing.id, slug: listing.slug, name: listing.name },
      window: "24h",
      summary: { observationCount: 1, latestPlayers: 21, peakPlayers: 21 },
    });
  });

  it("does not expose history for a private prefetched listing", async () => {
    expect(
      await serverHistoryService.getHistoryForServer(
        {
          ...listing,
          visibility: "private",
        },
        "24h",
      ),
    ).toBeNull();
    expect(repositories.findById).not.toHaveBeenCalled();
    expect(repositories.readWindow).not.toHaveBeenCalled();
  });

  it("retains an ID-based lookup and the same privacy check for the public API", async () => {
    repositories.findById.mockResolvedValueOnce(null);
    expect(await serverHistoryService.getHistory(listing.id, "24h")).toBeNull();
    repositories.findById.mockResolvedValueOnce({ ...listing, visibility: "private" });
    expect(await serverHistoryService.getHistory(listing.id, "24h")).toBeNull();
    expect(repositories.readWindow).not.toHaveBeenCalled();
    repositories.findById.mockResolvedValueOnce(listing);
    expect((await serverHistoryService.getHistory(listing.id, "7d"))?.summary.latestPlayers).toBe(
      21,
    );
    expect(repositories.findById).toHaveBeenCalledTimes(3);
    expect(repositories.readWindow).toHaveBeenCalledExactlyOnceWith(listing.id, 7 * 24, 500);
  });
});
