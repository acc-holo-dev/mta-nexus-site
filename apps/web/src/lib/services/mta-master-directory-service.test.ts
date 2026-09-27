import { describe, expect, it, vi } from "vitest";
import {
  matchesMtaEndpoint,
  mtaLiveStatus,
  mtaMasterDirectoryService,
  normalizeMtaAddress,
  parseMtaMasterList,
  readBoundedMasterPayload,
} from "./mta-master-directory-service";

const FLAGS = 0x0004 | 0x0008 | 0x0020 | 0x0040 | 0x0080 | 0x0100 | 0x0200 | 0x1000 | 0x080000;

function u16(value: number) {
  return [(value >>> 8) & 0xff, value & 0xff];
}

function u32(value: number) {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function text(value: string) {
  const bytes = [...new TextEncoder().encode(value)];
  return [bytes.length, ...bytes];
}

function fixture() {
  const entry = [
    127, 0, 0, 1,
    ...u16(22003),
    ...u16(42),
    ...u16(128),
    ...text("Nexus test server"),
    ...text("roleplay"),
    ...text("Los Santos"),
    ...text("1.6"),
    1,
    0,
    ...u16(22005),
  ];

  return new Uint8Array([
    0, 0, 0, 2,
    ...u32(FLAGS),
    ...u32(7),
    ...u32(1),
    ...u16(entry.length + 2),
    ...entry,
    0x12, 0x34, 0x56, 0x79,
  ]).buffer;
}

describe("parseMtaMasterList", () => {
  it("parses extended master-list entries in network byte order", () => {
    expect(parseMtaMasterList(fixture())).toEqual([
      {
        address: "127.0.0.1",
        port: 22003,
        players: 42,
        maxPlayers: 128,
        name: "Nexus test server",
        gameMode: "roleplay",
        mapName: "Los Santos",
        version: "1.6",
        passworded: true,
        responding: true,
        httpPort: 22005,
      },
    ]);
  });

  it("accepts endpoint-only entries when optional flags are absent", () => {
    const payload = new Uint8Array([
      0, 0, 0, 2,
      ...u32(0),
      ...u32(0),
      ...u32(1),
      ...u16(8),
      203, 0, 113, 7,
      ...u16(22003),
      ...u32(0x12345679),
    ]).buffer;

    expect(parseMtaMasterList(payload)).toEqual([
      { address: "203.0.113.7", port: 22003 },
    ]);
  });

  it("rejects an incomplete payload", () => {
    expect(() => parseMtaMasterList(new Uint8Array([0, 0]).buffer)).toThrow("Unsupported MTA master-list format");
  });
  it("rejects an unsafe declared server count", () => {
    const payload = new Uint8Array([
      0, 0, 0, 2,
      ...u32(0),
      ...u32(1),
      ...u32(10001),
    ]).buffer;

    expect(() => parseMtaMasterList(payload)).toThrow("server count exceeds safety limit");
  });

  it("rejects a declared server count when an entry is missing", () => {
    const payload = new Uint8Array([
      0, 0, 0, 2,
      ...u32(0),
      ...u32(1),
      ...u32(1),
    ]).buffer;

    expect(() => parseMtaMasterList(payload)).toThrow("Truncated MTA master-list server entry");
  });

  it("rejects a truncated or corrupted version 2 EOF marker", () => {
    const valid = new Uint8Array(fixture());
    expect(() => parseMtaMasterList(valid.slice(0, -1).buffer)).toThrow("EOF marker");
    valid[valid.length - 1] ^= 1;
    expect(() => parseMtaMasterList(valid.buffer)).toThrow("EOF marker");
  });

  it("rejects bytes after the version 2 EOF marker", () => {
    const valid = new Uint8Array(fixture());
    const extra = new Uint8Array(valid.length + 1);
    extra.set(valid);
    expect(() => parseMtaMasterList(extra.buffer)).toThrow("EOF marker");
  });
});

describe("editorial/live endpoint matching", () => {
  it("normalizes case, whitespace and a trailing hostname dot", () => {
    expect(normalizeMtaAddress("  Play.Example.COM. ")).toBe("play.example.com");
    expect(matchesMtaEndpoint(
      { ipAddress: " PLAY.EXAMPLE.COM. ", port: 22003 },
      { address: "play.example.com", port: 22003 }
    )).toBe(true);
  });

  it("never matches a different port", () => {
    expect(matchesMtaEndpoint(
      { ipAddress: "127.0.0.1", port: 22003 },
      { address: "127.0.0.1", port: 22004 }
    )).toBe(false);
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

describe("bounded MTA master-list transport", () => {
  it("reassembles a chunked response without using unbounded arrayBuffer()", async () => {
    const response = new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([0, 1]));
        controller.enqueue(new Uint8Array([2, 3]));
        controller.close();
      },
    }));
    response.arrayBuffer = () => {
      throw new Error("Unbounded reader must not be used");
    };

    expect(new Uint8Array(await readBoundedMasterPayload(response, 4)))
      .toEqual(new Uint8Array([0, 1, 2, 3]));
  });

  it("rejects an oversized advertised length and cancels its body", async () => {
    let cancelled = false;
    const response = new Response(new ReadableStream<Uint8Array>({
      cancel() { cancelled = true; },
    }), { headers: { "content-length": "17" } });

    await expect(readBoundedMasterPayload(response, 16))
      .rejects.toThrow("payload exceeds safety limit");
    expect(cancelled).toBe(true);
  });

  it("stops reading and cancels when chunks exceed the limit without a length header", async () => {
    let cancelled = false;
    const response = new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(8));
        controller.enqueue(new Uint8Array(9));
      },
      cancel() { cancelled = true; },
    }));

    await expect(readBoundedMasterPayload(response, 16))
      .rejects.toThrow("payload exceeds safety limit");
    expect(cancelled).toBe(true);
  });
});

describe("MTA directory outage cache", () => {
  it("throttles failed refreshes without extending the stale snapshot deadline", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-27T00:00:00Z"));
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(fixture()))
      .mockRejectedValue(new Error("upstream unavailable"));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const fresh = await mtaMasterDirectoryService.getDirectory();
      expect(fresh.isStale).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      vi.setSystemTime(new Date("2026-09-27T00:01:01Z"));
      const stale = await mtaMasterDirectoryService.getDirectory();
      expect(stale.isStale).toBe(true);
      expect(stale.fetchedAt).toBe(fresh.fetchedAt);
      expect(fetchMock).toHaveBeenCalledTimes(2);

      expect((await mtaMasterDirectoryService.getDirectory()).isStale).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);

      vi.setSystemTime(new Date("2026-09-27T00:01:12Z"));
      expect((await mtaMasterDirectoryService.getDirectory()).isStale).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(3);

      vi.setSystemTime(new Date("2026-09-27T00:15:01Z"));
      await expect(mtaMasterDirectoryService.getDirectory())
        .rejects.toThrow("upstream unavailable");
      expect(fetchMock).toHaveBeenCalledTimes(4);
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });
});
