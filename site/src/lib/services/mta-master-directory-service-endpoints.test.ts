import { describe, expect, it, vi } from "vitest";
import {
  mtaMasterDirectoryService,
  requestMtaMasterDirectoryFromEndpoints,
} from "./mta-master-directory-service";
import { fixture } from "./mta-master-directory-service-harness";

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
