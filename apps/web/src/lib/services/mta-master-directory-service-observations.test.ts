import { describe, expect, it } from "vitest";
import {
  indexMtaObservations,
  matchesMtaEndpoint,
  mtaLiveStatus,
  normalizeMtaAddress,
} from "./mta-master-directory-service";

describe("editorial/live endpoint matching", () => {
  it("indexes one shared snapshot, preserving the first observation for duplicate endpoints", () => {
    const first = { address: "play.example.com", port: 22003, players: 12 };
    const lookup = indexMtaObservations([first, { ...first, players: 99 }]);
    expect(lookup({ ipAddress: " PLAY.EXAMPLE.COM. ", port: 22003 })).toBe(first);
    expect(lookup({ ipAddress: "play.example.com", port: 22004 })).toBeUndefined();
  });
  it("normalizes case, whitespace and a trailing hostname dot", () => {
    expect(normalizeMtaAddress("  Play.Example.COM. ")).toBe("play.example.com");
    expect(
      matchesMtaEndpoint(
        { ipAddress: " PLAY.EXAMPLE.COM. ", port: 22003 },
        { address: "play.example.com", port: 22003 },
      ),
    ).toBe(true);
  });

  it("never matches a different port", () => {
    expect(
      matchesMtaEndpoint(
        { ipAddress: "127.0.0.1", port: 22003 },
        { address: "127.0.0.1", port: 22004 },
      ),
    ).toBe(false);
  });
});

describe("MTA live-status authority", () => {
  it("treats missing and stale observations as unknown", () => {
    expect(mtaLiveStatus(null)).toBe("unknown");
    expect(mtaLiveStatus({ responding: true }, true)).toBe("unknown");
    expect(mtaLiveStatus({ responding: false }, true)).toBe("unknown");
    expect(mtaLiveStatus({ responding: true })).toBe("online");
    expect(mtaLiveStatus({ responding: false })).toBe("offline");
  });
});
