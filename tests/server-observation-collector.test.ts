import { describe, expect, it } from "vitest";
import { buildMasterObservationCandidates } from "../apps/web/src/lib/services/server-observation-collector";

describe("server observation collector", () => {
  it("matches known endpoints once and records only confirmed listings", () => {
    const candidates = buildMasterObservationCandidates(
      [
        { id: "srv_one", ipAddress: "Example.COM.", port: 22003 },
        { id: "srv_missing", ipAddress: "missing.example", port: 22003 },
      ],
      {
        fetchedAt: "2026-09-25T12:00:00.000Z",
        isStale: false,
        servers: [
          {
            address: "example.com",
            port: 22003,
            name: "Observed name",
            gameMode: "Race",
            players: 14,
            maxPlayers: 64,
            version: "1.6.0",
            responding: true,
          },
        ],
      },
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      serverId: "srv_one",
      source: "mta_master",
      sourceSequence: "2026-09-25T12:00:00.000Z",
      name: "Observed name",
      gameMode: "Race",
      currentPlayers: 14,
      maxPlayers: 64,
      mtaVersion: "1.6.0",
      responding: true,
    });
    expect(candidates[0]?.observedAt.toISOString()).toBe(
      "2026-09-25T12:00:00.000Z",
    );
  });

  it("does not synthesize offline observations for missing servers", () => {
    const candidates = buildMasterObservationCandidates(
      [{ id: "srv_missing", ipAddress: "missing.example", port: 22003 }],
      {
        fetchedAt: "2026-09-25T12:00:00.000Z",
        isStale: false,
        servers: [],
      },
    );

    expect(candidates).toEqual([]);
  });

  it("deduplicates duplicate master endpoints before candidate creation", () => {
    const candidates = buildMasterObservationCandidates(
      [{ id: "srv_one", ipAddress: "example.com", port: 22003 }],
      {
        fetchedAt: "2026-09-25T12:00:00.000Z",
        isStale: false,
        servers: [
          { address: "example.com", port: 22003, players: 10 },
          { address: "EXAMPLE.COM.", port: 22003, players: 20 },
        ],
      },
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.currentPlayers).toBe(10);
  });
});
