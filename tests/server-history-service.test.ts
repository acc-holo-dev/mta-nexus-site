import { describe, expect, it } from "vitest";
import type { ServerObservation } from "@nexus/domain";
import { summarizeServerObservations } from "../apps/web/src/lib/services/server-history-service";

function observation(
  observedAt: string,
  currentPlayers?: number,
  maxPlayers?: number,
): ServerObservation {
  return {
    id: `obs_${observedAt}`,
    serverId: "srv_test",
    source: "mta_master",
    sourceSequence: observedAt,
    currentPlayers,
    maxPlayers,
    observedAt: new Date(observedAt),
    createdAt: new Date(observedAt),
  };
}

describe("server history summary", () => {
  it("sorts observations and computes observed-player statistics only", () => {
    const summary = summarizeServerObservations([
      observation("2026-09-25T12:10:00.000Z", 20, 64),
      observation("2026-09-25T12:00:00.000Z", 10, 64),
      observation("2026-09-25T12:05:00.000Z", undefined, 64),
    ]);

    expect(summary).toEqual({
      observationCount: 3,
      observedFrom: "2026-09-25T12:00:00.000Z",
      observedTo: "2026-09-25T12:10:00.000Z",
      peakPlayers: 20,
      averagePlayers: 15,
      latestPlayers: 20,
      latestMaxPlayers: 64,
    });
  });

  it("keeps missing player counts unknown instead of converting them to zero", () => {
    const summary = summarizeServerObservations([
      observation("2026-09-25T12:00:00.000Z"),
    ]);

    expect(summary.peakPlayers).toBeNull();
    expect(summary.averagePlayers).toBeNull();
    expect(summary.latestPlayers).toBeNull();
  });

  it("returns a neutral empty summary", () => {
    expect(summarizeServerObservations([])).toEqual({
      observationCount: 0,
      observedFrom: null,
      observedTo: null,
      peakPlayers: null,
      averagePlayers: null,
      latestPlayers: null,
      latestMaxPlayers: null,
    });
  });
});
