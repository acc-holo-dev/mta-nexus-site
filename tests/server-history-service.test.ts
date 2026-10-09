import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ readWindow: vi.fn() }));
vi.mock("@nexus/db", () => ({
  serverObservationRepository: { readWindow: state.readWindow },
  serverRepository: {},
}));
import { serverHistoryService } from "../apps/web/src/lib/services/server-history-service";
import { parseServerHistoryWindow } from "../apps/web/src/lib/server-history-window";
const listing = { id: "server", name: "Server", slug: "server", visibility: "public" as const };
const end = new Date("2026-10-09T12:00:00Z");
const sample = { id: "sample", observedAt: end, currentPlayers: 2, maxPlayers: 64 };
beforeEach(() => {
  state.readWindow.mockReset().mockResolvedValue({
    observations: [sample],
    sampleLimit: 500,
    bucketSeconds: 86400,
    windowStart: new Date("2026-09-09T12:00:00Z"),
    windowEnd: end,
    summary: {
      observationCount: 8000,
      knownPlayerCount: 7900,
      observedFrom: new Date("2026-09-10T00:00:00Z"),
      observedTo: end,
      peakPlayers: 64,
      averagePlayers: 32.5,
    },
    buckets: [
      {
        bucketAt: new Date("2026-09-10T00:00:00Z"),
        observationCount: 300,
        knownPlayerCount: 299,
        peakPlayers: 64,
        averagePlayers: 32.5,
        maxPlayers: 64,
      },
    ],
  });
});
describe("complete server history windows", () => {
  it.each([
    ["24h", 24],
    ["7d", 168],
    ["30d", 720],
  ] as const)("requests the complete %s window", async (window, hours) => {
    const history = await serverHistoryService.getHistoryForServer(listing, window);
    expect(state.readWindow).toHaveBeenCalledExactlyOnceWith("server", hours, 500);
    expect(history).toMatchObject({
      summary: { observationCount: 8000, peakPlayers: 64, averagePlayers: 32.5, latestPlayers: 2 },
      samplesTruncated: true,
    });
    expect(history?.observations).toHaveLength(1);
    expect(history?.buckets[0]).toMatchObject({
      bucketAt: "2026-09-10T00:00:00.000Z",
      peakPlayers: 64,
    });
    expect(history?.absenceMeansOffline).toBe(false);
  });
  it("retains unknown values and an empty complete window without claiming downtime", async () => {
    state.readWindow.mockResolvedValue({
      observations: [],
      buckets: [],
      sampleLimit: 500,
      bucketSeconds: 3600,
      windowStart: end,
      windowEnd: end,
      summary: {
        observationCount: 0,
        knownPlayerCount: 0,
        observedFrom: null,
        observedTo: null,
        peakPlayers: null,
        averagePlayers: null,
      },
    });
    const history = await serverHistoryService.getHistoryForServer(listing, "24h");
    expect(history).toMatchObject({
      summary: {
        observationCount: 0,
        peakPlayers: null,
        averagePlayers: null,
        observedFrom: null,
        observedTo: null,
        latestPlayers: null,
        latestMaxPlayers: null,
      },
      samplesTruncated: false,
      absenceMeansOffline: false,
    });
  });
  it("does not turn a latest observation with unknown players into zero", async () => {
    const result = await state.readWindow();
    result.observations = [{ ...sample, currentPlayers: undefined, maxPlayers: undefined }];
    state.readWindow.mockResolvedValue(result);
    expect(await serverHistoryService.getHistoryForServer(listing, "24h")).toMatchObject({
      summary: { latestPlayers: null, latestMaxPlayers: null },
    });
  });
  it("propagates a history failure for the HTTP/SSR caller to handle", async () => {
    state.readWindow.mockRejectedValue(new Error("Database unavailable"));
    await expect(serverHistoryService.getHistoryForServer(listing, "24h")).rejects.toThrow();
  });
  it.each(["24h", "7d", "30d", "invalid", "", undefined, ["7d", "30d"]])(
    "parses the page period %s without accepting malformed or ambiguous windows",
    (value) => {
      expect(parseServerHistoryWindow(value)).toBe(
        value === "7d" || value === "30d" ? value : "24h",
      );
    },
  );
});
