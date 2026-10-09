import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  indexMtaObservations,
  matchesMtaEndpoint,
} from "../apps/web/src/lib/services/mta-master-directory-service";

describe("incremental MTA observation index", () => {
  it("defers traversal and reuses the scanned prefix for out-of-order and repeated lookups", () => {
    let reads = 0;
    const servers = Array.from({ length: 10_000 }, (_, index) => ({
      get address() {
        reads++;
        return `server-${index}.test`;
      },
      port: 22003,
      players: index,
    }));
    const lookup = indexMtaObservations(servers);
    expect(reads).toBe(0);
    expect(lookup({ ipAddress: "server-200.test", port: 22003 })).toBe(servers[200]);
    expect(reads).toBe(201);
    expect(lookup({ ipAddress: "SERVER-10.TEST.", port: 22003 })).toBe(servers[10]);
    expect(reads).toBe(201);
    expect(lookup({ ipAddress: "missing.test", port: 22003 })).toBeUndefined();
    expect(reads).toBe(10_000);
    expect(lookup({ ipAddress: "missing.test", port: 22003 })).toBeUndefined();
    expect(lookup({ ipAddress: "server-9999.test", port: 22003 })).toBe(servers[9999]);
    expect(reads).toBe(10_000);
  });

  it("keeps first-duplicate precedence when a later lookup scans further", () => {
    const first = { address: "PLAY.TEST.", port: 22003, players: 0 };
    const secondPort = { address: " play.test ", port: 22004 };
    const servers = [
      first,
      { ...first, players: 99 },
      secondPort,
      { address: "2001:db8::1", port: 22003, players: 7 },
    ];
    const lookup = indexMtaObservations(servers);
    expect(lookup({ ipAddress: "play.test", port: 22003 })).toBe(first);
    expect(lookup({ ipAddress: "2001:DB8::1", port: 22003 })).toBe(servers[3]);
    expect(lookup({ ipAddress: "PLAY.TEST", port: 22003 })).toBe(first);
    expect(lookup({ ipAddress: "play.test", port: 22004 })).toBe(secondPort);
  });

  it("matches first-entry Array.find semantics for generated sequences of endpoint queries", () => {
    const address = fc.constantFrom(
      "play.test",
      "PLAY.TEST.",
      " play.test ",
      "other.test",
      "2001:db8::1",
      "2001:DB8::1",
    );
    const port = fc.integer({ min: 22003, max: 22005 });
    fc.assert(
      fc.property(
        fc.array(fc.record({ address, port, players: fc.integer({ min: 0, max: 100 }) }), {
          maxLength: 100,
        }),
        fc.array(fc.record({ ipAddress: fc.oneof(address, fc.constant("missing.test")), port }), {
          maxLength: 50,
        }),
        (servers, endpoints) => {
          const lookup = indexMtaObservations(servers);
          for (const endpoint of endpoints) {
            expect(lookup(endpoint)).toBe(
              servers.find((server) => matchesMtaEndpoint(endpoint, server)),
            );
          }
        },
      ),
      { seed: 20261009, numRuns: 1000 },
    );
  });
});
