import { describe, expect, it, vi } from "vitest";
import {
  indexMtaObservations,
  matchesMtaEndpoint,
  mtaLiveStatus,
  mtaMasterDirectoryService,
  normalizeMtaAddress,
  parseMtaMasterList,
  readBoundedMasterPayload,
  requestMtaMasterDirectoryFromEndpoints,
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
    127,
    0,
    0,
    1,
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
    0,
    0,
    0,
    2,
    ...u32(FLAGS),
    ...u32(7),
    ...u32(1),
    ...u16(entry.length + 2),
    ...entry,
    0x12,
    0x34,
    0x56,
    0x79,
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

  it("decodes several independent Unicode text fields within one entry", () => {
    const flags = 0x0020 | 0x0040;
    const entry = [203, 0, 113, 7, ...u16(22003), ...text("Русский сервер"), ...text("Гонки")];
    const payload = new Uint8Array([
      0,
      0,
      0,
      2,
      ...u32(flags),
      ...u32(0),
      ...u32(1),
      ...u16(entry.length + 2),
      ...entry,
      ...u32(0x12345679),
    ]).buffer;
    expect(parseMtaMasterList(payload)).toEqual([
      {
        address: "203.0.113.7",
        port: 22003,
        name: "Русский сервер",
        gameMode: "Гонки",
      },
    ]);
  });

  it("skips unneeded player names without decoding them", () => {
    const count = 1000;
    const playerNames = Array.from({ length: count }, (_, index) => text(`player-${index}`)).flat();
    const entry = [203, 0, 113, 7, ...u16(22003), ...u16(count), ...playerNames];
    const packet = new Uint8Array([
      0,
      0,
      0,
      2,
      ...u32(0x0800),
      ...u32(1),
      ...u32(1),
      ...u16(entry.length + 2),
      ...entry,
      ...u32(0x12345679),
    ]);
    const decode = vi.spyOn(TextDecoder.prototype, "decode");
    try {
      expect(parseMtaMasterList(packet.buffer)).toEqual([{ address: "203.0.113.7", port: 22003 }]);
      expect(decode).not.toHaveBeenCalled();
    } finally {
      decode.mockRestore();
    }
  });

  it("rejects truncated ignored player names instead of reading into the next entry", () => {
    const entry = [203, 0, 113, 7, ...u16(22003), ...u16(1), 20, 65, 66];
    const packet = new Uint8Array([
      0,
      0,
      0,
      2,
      ...u32(0x0800),
      ...u32(1),
      ...u32(1),
      ...u16(entry.length + 2),
      ...entry,
      ...u32(0x12345679),
    ]);
    expect(() => parseMtaMasterList(packet.buffer)).toThrow("Truncated MTA master-list entry");
  });

  it("rejects a string crossing into the next server before decoding it", () => {
    const first = [203, 0, 113, 7, ...u16(22003), 8, 65];
    const second = [203, 0, 113, 8, ...u16(22004), 1, 66];
    const payload = new Uint8Array([
      0,
      0,
      0,
      2,
      ...u32(0x0020),
      ...u32(1),
      ...u32(2),
      ...u16(first.length + 2),
      ...first,
      ...u16(second.length + 2),
      ...second,
      ...u32(0x12345679),
    ]);
    const decode = vi.spyOn(TextDecoder.prototype, "decode");
    try {
      expect(() => parseMtaMasterList(payload.buffer)).toThrow("Truncated MTA master-list entry");
      expect(decode).not.toHaveBeenCalled();
    } finally {
      decode.mockRestore();
    }
  });

  it("rejects an optional field crossing into the EOF marker", () => {
    const entry = [203, 0, 113, 7, ...u16(22003)];
    const payload = new Uint8Array([
      0,
      0,
      0,
      2,
      ...u32(0x0004),
      ...u32(1),
      ...u32(1),
      ...u16(entry.length + 2),
      ...entry,
      ...u32(0x12345679),
    ]);
    expect(() => parseMtaMasterList(payload.buffer)).toThrow("Truncated MTA master-list entry");
  });

  it("accepts endpoint-only entries when optional flags are absent", () => {
    const payload = new Uint8Array([
      0,
      0,
      0,
      2,
      ...u32(0),
      ...u32(0),
      ...u32(1),
      ...u16(8),
      203,
      0,
      113,
      7,
      ...u16(22003),
      ...u32(0x12345679),
    ]).buffer;

    expect(parseMtaMasterList(payload)).toEqual([{ address: "203.0.113.7", port: 22003 }]);
  });

  it("rejects an incomplete payload", () => {
    expect(() => parseMtaMasterList(new Uint8Array([0, 0]).buffer)).toThrow(
      "Unsupported MTA master-list format",
    );
  });
  it("rejects an unsafe declared server count", () => {
    const payload = new Uint8Array([0, 0, 0, 2, ...u32(0), ...u32(1), ...u32(10001)]).buffer;

    expect(() => parseMtaMasterList(payload)).toThrow("server count exceeds safety limit");
  });

  it("rejects a declared server count when an entry is missing", () => {
    const payload = new Uint8Array([0, 0, 0, 2, ...u32(0), ...u32(1), ...u32(1)]).buffer;

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

describe("bounded MTA master-list transport", () => {
  it("reassembles a chunked response without using unbounded arrayBuffer()", async () => {
    const response = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([0, 1]));
          controller.enqueue(new Uint8Array([2, 3]));
          controller.close();
        },
      }),
    );
    response.arrayBuffer = () => {
      throw new Error("Unbounded reader must not be used");
    };

    expect(new Uint8Array(await readBoundedMasterPayload(response, 4))).toEqual(
      new Uint8Array([0, 1, 2, 3]),
    );
  });

  it("streams 20,000 one-byte chunks without retaining an array of chunks", async () => {
    const total = 20_000;
    let next = 0;
    const response = new Response(
      new ReadableStream<Uint8Array>({
        pull(controller) {
          if (next === total) {
            controller.close();
            return;
          }
          controller.enqueue(new Uint8Array([next++ % 251]));
        },
      }),
    );
    const actual = new Uint8Array(await readBoundedMasterPayload(response, total));
    expect(actual.length).toBe(total);
    expect(actual[250]).toBe(250);
    expect(actual[251]).toBe(0);
    expect(actual[total - 1]).toBe((total - 1) % 251);
  });

  it("grows past 64 KiB and returns an exact-length buffer", async () => {
    const first = new Uint8Array(64 * 1024).fill(5);
    const second = new Uint8Array(37).fill(9);
    const response = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(first);
          controller.enqueue(second);
          controller.close();
        },
      }),
    );
    const actual = new Uint8Array(
      await readBoundedMasterPayload(response, first.length + second.length),
    );
    expect(actual.length).toBe(first.length + second.length);
    expect(actual[0]).toBe(5);
    expect(actual[first.length]).toBe(9);
    expect(actual.at(-1)).toBe(9);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, 8 * 1024 * 1024 + 1])(
    "rejects an invalid stream byte limit %s",
    async (limit) => {
      const response = new Response(new Uint8Array([1]));
      await expect(readBoundedMasterPayload(response, limit)).rejects.toThrow(
        "Invalid MTA master-list payload size limit",
      );
    },
  );

  it("rejects an oversized advertised length and cancels its body", async () => {
    let cancelled = false;
    const response = new Response(
      new ReadableStream<Uint8Array>({
        cancel() {
          cancelled = true;
        },
      }),
      { headers: { "content-length": "17" } },
    );

    await expect(readBoundedMasterPayload(response, 16)).rejects.toThrow(
      "payload exceeds safety limit",
    );
    expect(cancelled).toBe(true);
  });

  it("stops reading and cancels when chunks exceed the limit without a length header", async () => {
    let cancelled = false;
    const response = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(8));
          controller.enqueue(new Uint8Array(9));
        },
        cancel() {
          cancelled = true;
        },
      }),
    );

    await expect(readBoundedMasterPayload(response, 16)).rejects.toThrow(
      "payload exceeds safety limit",
    );
    expect(cancelled).toBe(true);
  });

  it("rejects malformed advertised lengths before buffering a mirror response", async () => {
    for (const length of ["NaN", "-1", "1e6", "9007199254740992"]) {
      let cancelled = false;
      const body = new ReadableStream<Uint8Array>({
        cancel() {
          cancelled = true;
        },
      });
      await expect(
        readBoundedMasterPayload(new Response(body, { headers: { "content-length": length } }), 16),
      ).rejects.toThrow("payload exceeds safety limit");
      expect(cancelled).toBe(true);
    }
  });

  it("rejects oversized declared content without awaiting a stalled cancel", async () => {
    let cancelled = false;
    const response = new Response(
      new ReadableStream<Uint8Array>({
        cancel() {
          cancelled = true;
          return new Promise<void>(() => {});
        },
      }),
      { headers: { "content-length": "17" } },
    );

    await expect(readBoundedMasterPayload(response, 16)).rejects.toThrow(
      "payload exceeds safety limit",
    );
    expect(cancelled).toBe(true);
  });

  it("rejects oversized stream chunks without awaiting a stalled cancel", async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(8));
        controller.enqueue(new Uint8Array(9));
      },
      cancel() {
        cancelled = true;
        return new Promise<void>(() => {});
      },
    });

    await expect(readBoundedMasterPayload(new Response(body), 16)).rejects.toThrow(
      "payload exceeds safety limit",
    );
    expect(cancelled).toBe(true);
    expect(body.locked).toBe(false);
  });

  it("aborts a stalled mirror stream even if its cancellation never settles", async () => {
    const active = new AbortController();
    let notifyPull!: () => void;
    const pulling = new Promise<void>((resolve) => {
      notifyPull = resolve;
    });
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>(
      {
        pull() {
          notifyPull();
        },
        cancel() {
          cancelled = true;
          return new Promise<void>(() => {});
        },
      },
      { highWaterMark: 0 },
    );

    const reading = readBoundedMasterPayload(new Response(body), 16, active.signal);
    await pulling;
    active.abort();
    await expect(reading).rejects.toMatchObject({ name: "AbortError" });
    expect(cancelled).toBe(true);
    expect(body.locked).toBe(false);
  });
});

describe("MTA master endpoint fallback", () => {
  it("falls back from an unavailable official endpoint to a valid mirror", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("upstream unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response(fixture()));

    const directory = await requestMtaMasterDirectoryFromEndpoints(
      ["https://master.multitheftauto.com/ase/mta/", "https://mirror.example.com/ase/mta/"],
      fetchMock,
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://master.multitheftauto.com/ase/mta/",
      "https://mirror.example.com/ase/mta/",
    ]);
    expect(directory.isStale).toBe(false);
    expect(directory.servers).toHaveLength(1);
    expect(directory.servers[0]).toMatchObject({
      address: "127.0.0.1",
      port: 22003,
      players: 42,
    });
  });

  it("rejects a malformed mirror payload and continues to the next endpoint", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(new Uint8Array([0, 0, 0, 2])))
      .mockResolvedValueOnce(new Response(fixture()));

    const directory = await requestMtaMasterDirectoryFromEndpoints(
      ["https://broken.example.com/ase/mta/", "https://healthy.example.net/ase/mta/"],
      fetchMock,
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(directory.servers[0]?.name).toBe("Nexus test server");
  });

  it("falls back after a redirect is rejected by fetch", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(async (_input, init) => {
        expect(init?.redirect).toBe("error");
        throw new TypeError("redirect disallowed");
      })
      .mockResolvedValueOnce(new Response(fixture()));
    const directory = await requestMtaMasterDirectoryFromEndpoints(
      ["https://redirect.example.com/ase", "https://mirror.example.com/ase"],
      fetchMock,
    );
    expect(directory.servers).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("refuses a successful response already marked redirected by a fetch adapter", async () => {
    const redirected = new Response(fixture());
    Object.defineProperty(redirected, "redirected", { value: true });
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(redirected)
      .mockResolvedValueOnce(new Response(fixture()));
    const directory = await requestMtaMasterDirectoryFromEndpoints(
      ["https://redirect.example.com/ase", "https://mirror.example.com/ase"],
      fetchMock,
    );
    expect(directory.servers).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reports a generic failure after every endpoint fails", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new Error("private endpoint detail"));

    await expect(
      requestMtaMasterDirectoryFromEndpoints(
        [
          "https://master.multitheftauto.com/ase/mta/",
          "https://secret-mirror.example.com/ase/mta/",
        ],
        fetchMock,
      ),
    ).rejects.toThrow("MTA master-list endpoints are unavailable");
  });

  it("passes bounded timeout signals and no-store semantics to every attempt", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 502 }))
      .mockResolvedValueOnce(new Response(fixture()));

    await requestMtaMasterDirectoryFromEndpoints(
      ["https://one.example.com/master", "https://two.example.com/master"],
      fetchMock,
    );

    for (const [, init] of fetchMock.mock.calls) {
      expect(init?.cache).toBe("no-store");
      expect(init?.redirect).toBe("error");
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      expect(init?.headers).toEqual({
        "user-agent": "MTA-Nexus/1.0 (+https://nexus-mta.com)",
      });
    }
  });
});

describe("MTA directory outage cache", () => {
  it("throttles failed refreshes without extending the stale snapshot deadline", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-27T00:00:00Z"));
    const fetchMock = vi
      .fn()
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
      await expect(mtaMasterDirectoryService.getDirectory()).rejects.toThrow(
        "MTA master-list endpoints are unavailable",
      );
      expect(fetchMock).toHaveBeenCalledTimes(4);
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });
});
