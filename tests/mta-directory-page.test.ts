import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { selectMtaDirectoryPage } from "../apps/web/src/lib/mta-directory-page";
import type { MtaMasterServer } from "../apps/web/src/lib/services/mta-master-directory-service";

const text = fc.string({ unit: "binary", maxLength: 20 });
const optionalText = fc.option(text, { nil: undefined });
const server = fc.record({
  address: text,
  port: fc.integer({ min: 1, max: 65535 }),
  players: fc.option(fc.integer({ min: 0, max: 64 }), { nil: undefined }),
  name: optionalText,
  gameMode: optionalText,
  mapName: optionalText,
  version: optionalText,
});
const query = fc
  .oneof(
    { weight: 2, arbitrary: fc.constant(undefined) },
    { weight: 2, arbitrary: fc.constant("") },
    { weight: 1, arbitrary: text },
    { weight: 1, arbitrary: fc.constantFrom("test", "РУ", "İ", "i\u0307") },
  )
  .map((value) => value?.trim());

describe("MTA directory page selection", () => {
  it.each([20261009, 20260919])(
    "matches the previous filter/slice behavior for generated queries and pages (seed %s)",
    (seed) => {
      fc.assert(
        fc.property(
          fc.array(server, { maxLength: 90 }),
          query,
          fc.integer({ min: 0, max: 64 }),
          fc.integer({ min: 1, max: 100 }),
          fc.oneof(fc.integer({ min: 0, max: 70 }), fc.integer({ min: 71, max: 10_000 })),
          (servers, query, minPlayers, limit, offset) => {
            const term = query?.toLocaleLowerCase();
            const matches = servers.filter((server) => {
              if ((server.players ?? 0) < minPlayers) return false;
              return (
                !term ||
                [server.name, server.address, server.gameMode, server.mapName, server.version]
                  .filter(Boolean)
                  .join(" ")
                  .toLocaleLowerCase()
                  .includes(term)
              );
            });
            const original = structuredClone(servers);
            const result = selectMtaDirectoryPage(servers, { query, minPlayers, limit, offset });
            expect(result).toEqual({
              servers: matches.slice(offset, offset + limit),
              total: matches.length,
            });
            expect(result.servers.length).toBeLessThanOrEqual(limit);
            expect(servers).toEqual(original);
          },
        ),
        { seed, numRuns: 1000 },
      );
    },
  );

  it("counts every later match after the page is full, including an offset beyond all results", () => {
    const servers = Array.from({ length: 10_000 }, (_, index) => ({
      address: `server-${index}.test`,
      port: 22003,
      name: "Nexus",
      players: index % 2,
    }));
    const options = { query: "nexus", minPlayers: 1, offset: 25, limit: 50 };
    const page = selectMtaDirectoryPage(servers, options);
    expect(page.total).toBe(5000);
    expect(page.servers).toEqual(servers.filter((server) => server.players === 1).slice(25, 75));
    expect(selectMtaDirectoryPage(servers, { ...options, offset: 10_000 })).toEqual({
      servers: [],
      total: 5000,
    });
  });

  it("preserves Unicode folding, joined-field matches, source order and record identity", () => {
    const servers = Object.freeze([
      Object.freeze({ address: "play.test", port: 22003, name: "РУССКИЙ", gameMode: "Race" }),
      Object.freeze({ address: "other.test", port: 22003, name: "İSTANBUL", players: 0 }),
    ]);
    const options = { minPlayers: 0, offset: 0, limit: 50 };
    expect(
      selectMtaDirectoryPage(servers, { ...options, query: "русский play.test" }).servers[0],
    ).toBe(servers[0]);
    expect(
      selectMtaDirectoryPage(servers, { ...options, query: "i\u0307stanbul" }).servers[0],
    ).toBe(servers[1]);
    expect(selectMtaDirectoryPage(servers, { ...options, query: "test" }).servers).toEqual(servers);
    expect(selectMtaDirectoryPage(servers, { ...options, minPlayers: 1 })).toEqual({
      servers: [],
      total: 0,
    });
  });

  it("does not inspect player counts outside an unfiltered page", () => {
    let inspected = 0;
    const servers: MtaMasterServer[] = Array.from({ length: 10_000 }, (_, index) => ({
      address: `server-${index}.test`,
      port: 22003,
      get players() {
        inspected++;
        return 0;
      },
    }));
    const page = selectMtaDirectoryPage(servers, {
      query: "",
      minPlayers: 0,
      offset: 9950,
      limit: 100,
    });
    expect(page.total).toBe(10_000);
    expect(page.servers).toHaveLength(50);
    expect(inspected).toBe(0);
  });

  it("reuses normalized strings for repeated text queries on one snapshot", () => {
    let nameReads = 0;
    const servers: readonly MtaMasterServer[] = Object.freeze([
      Object.freeze({
        address: "one.test", port: 22003, players: 5,
        get name() { nameReads++; return "Nexus Roleplay"; },
      }),
      Object.freeze({
        address: "two.test", port: 22003, players: 2,
        get name() { nameReads++; return "Nexus Racing"; },
      }),
    ]);
    const options = { minPlayers: 0, limit: 50, offset: 0 };
    expect(selectMtaDirectoryPage(servers, { ...options, query: "nexus" }).total).toBe(2);
    expect(selectMtaDirectoryPage(servers, { ...options, query: "racing" }).total).toBe(1);
    expect(selectMtaDirectoryPage(servers, { ...options, query: "roleplay" }).total).toBe(1);
    expect(nameReads).toBe(2);

    // A new master-list snapshot rebuilds only its own search cache.
    const nextSnapshot = [...servers];
    expect(selectMtaDirectoryPage(nextSnapshot, { ...options, query: "nexus" }).total).toBe(2);
    expect(nameReads).toBe(4);
  });

  it("does not normalize searchable text during player-only filtering", () => {
    let nameReads = 0;
    const servers: MtaMasterServer[] = [{
      address: "one.test", port: 22003, players: 7,
      get name() { nameReads++; return "Nexus"; },
    }];
    const result = selectMtaDirectoryPage(servers, {
      minPlayers: 5, limit: 10, offset: 0,
    });
    expect(result.total).toBe(1);
    expect(nameReads).toBe(0);
  });
});
