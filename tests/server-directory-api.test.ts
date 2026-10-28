import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { getDirectory, logEvent } = vi.hoisted(() => ({
  getDirectory: vi.fn(),
  logEvent: vi.fn(),
}));

vi.mock("../apps/web/src/lib/services/mta-master-directory-service", () => ({
  mtaMasterDirectoryService: { getDirectory },
}));
vi.mock("../apps/web/src/lib/observability", () => ({
  createRequestLogContext: () => ({ requestId: "test-request" }),
  jsonWithRequestId: (context: { requestId: string }, body: unknown, init: ResponseInit) => {
    const headers = new Headers(init.headers);
    headers.set("X-Request-Id", context.requestId);
    return NextResponse.json(body, { ...init, headers });
  },
  logRequestEvent: logEvent,
}));

import { GET } from "../apps/web/src/app/api/servers/directory/route";

beforeEach(() => {
  getDirectory.mockReset();
  logEvent.mockReset();
});

describe("official MTA directory API", () => {
  it("reads only the requested fifty entries from an unfiltered 10,000-server snapshot", async () => {
    let entryReads = 0;
    const servers = new Proxy(
      Array.from({ length: 10_000 }, (_, index) => ({
        address: `server-${index}.test`,
        port: 22003,
        players: index % 32,
      })),
      {
        get(target, key, receiver) {
          if (typeof key === "string" && /^\d+$/.test(key)) entryReads++;
          return Reflect.get(target, key, receiver);
        },
      },
    );
    getDirectory.mockResolvedValue({
      servers,
      fetchedAt: "2026-10-09T00:00:00.000Z",
      isStale: false,
    });
    const response = await GET(
      new NextRequest("https://nexus.test/api/servers/directory?offset=500&limit=50"),
    );
    const body = await response.json();
    expect(body).toMatchObject({ total: 10_000, offset: 500, limit: 50, isStale: false });
    expect(body.servers).toHaveLength(50);
    expect(body.servers[0].address).toBe("server-500.test");
    expect(body.servers.at(-1).address).toBe("server-549.test");
    expect(entryReads).toBe(50);
  });

  it("filters a live snapshot before paginating and preserves its provenance", async () => {
    getDirectory.mockResolvedValue({
      servers: [
        { address: "203.0.113.1", port: 22003, name: "Nexus 1", players: 4 },
        { address: "203.0.113.2", port: 22003, name: "Nexus 2", players: 30 },
        { address: "203.0.113.3", port: 22003, name: "Nexus 3", players: 25 },
      ],
      fetchedAt: "2026-09-27T00:00:00.000Z",
      isStale: true,
    });

    const response = await GET(
      new NextRequest(
        "https://nexus.test/api/servers/directory?query=nexus&minPlayers=10&limit=1&offset=1",
      ),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      servers: [{ name: "Nexus 3" }],
      total: 2,
      offset: 1,
      limit: 1,
      fetchedAt: "2026-09-27T00:00:00.000Z",
      isStale: true,
    });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Request-Id")).toBeNull();
    expect(getDirectory).toHaveBeenCalledOnce();
  });

  it("keeps bounded public caching for freshly fetched master data", async () => {
    getDirectory.mockResolvedValue({
      servers: [{ address: "203.0.113.9", port: 22003, players: 4 }],
      fetchedAt: new Date().toISOString(),
      isStale: false,
    });
    const response = await GET(new NextRequest("https://nexus.test/api/servers/directory"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=30");
    expect((await response.json()).isStale).toBe(false);
  });

  it("rejects invalid pagination without reading the master list", async () => {
    const response = await GET(
      new NextRequest("https://nexus.test/api/servers/directory?limit=101"),
    );
    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Request-Id")).toBe("test-request");
    expect(getDirectory).not.toHaveBeenCalled();
  });

  it("returns a retryable 503 when the master server is unavailable", async () => {
    getDirectory.mockRejectedValue(new Error("upstream unavailable"));
    const response = await GET(new NextRequest("https://nexus.test/api/servers/directory"));
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("30");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Request-Id")).toBe("test-request");
    expect((await response.json()).error).toMatch(/temporarily unavailable/);
    expect(logEvent).toHaveBeenCalledOnce();
  });
});
