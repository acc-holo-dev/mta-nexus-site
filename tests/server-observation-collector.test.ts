import { describe, expect, it } from "vitest";
import { buildMasterObservationCandidates } from "../apps/web/src/lib/services/server-observation-matching";

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
    expect(candidates[0]?.observedAt.toISOString()).toBe("2026-09-25T12:00:00.000Z");
  });

  it.each(["", "invalid", "2026-99-01T00:00:00Z"])(
    "fails before creating observations for an invalid snapshot time %s",
    (fetchedAt) => {
      expect(() =>
        buildMasterObservationCandidates(
          [{ id: "srv_one", ipAddress: "example.com", port: 22003 }],
          {
            fetchedAt,
            isStale: false,
            servers: [{ address: "example.com", port: 22003, players: 20 }],
          },
        ),
      ).toThrow("Invalid MTA master-list observation timestamp");
    },
  );

  it("creates distinct snapshot identities for endpoint A -> B -> A revisions", () => {
    const fetchedAt = "2026-10-09T07:30:00.000Z";
    const directory = {
      fetchedAt,
      isStale: false,
      servers: [{ address: "host.test", port: 22003, players: 12 }],
    };
    const collect = (endpointRevision: number) => {
      const rows = buildMasterObservationCandidates(
        [{ id: "srv_one", ipAddress: "host.test", port: 22003, endpointRevision }],
        directory,
      );
      expect(rows).toHaveLength(1);
      return rows[0]!;
    };
    expect(collect(0).sourceSequence).toBe(fetchedAt);
    expect(collect(1).sourceSequence).toBe(fetchedAt + "#endpoint-revision=1");
    expect(collect(2).sourceSequence).toBe(fetchedAt + "#endpoint-revision=2");
    expect(collect(2).observedAt.toISOString()).toBe(fetchedAt);
    expect(collect(1).currentPlayers).toBe(12);
    expect(collect(1).sourceSequence).not.toBe(collect(2).sourceSequence);
    expect(() => collect(-1)).toThrow("Invalid server endpoint revision");
    expect(() => collect(2_147_483_648)).toThrow("Invalid server endpoint revision");
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
