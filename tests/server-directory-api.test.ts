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
  jsonWithRequestId: (_context: unknown, body: unknown, init: ResponseInit) => NextResponse.json(body, init),
  logRequestEvent: logEvent,
}));

import { GET } from "../apps/web/src/app/api/servers/directory/route";

beforeEach(() => {
  getDirectory.mockReset();
  logEvent.mockReset();
});

describe("official MTA directory API", () => {
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

    const response = await GET(new NextRequest("https://nexus.test/api/servers/directory?query=nexus&minPlayers=10&limit=1&offset=1"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      servers: [{ name: "Nexus 3" }], total: 2, offset: 1, limit: 1,
      fetchedAt: "2026-09-27T00:00:00.000Z", isStale: true,
    });
    expect(response.headers.get("Cache-Control")).toContain("max-age=30");
    expect(getDirectory).toHaveBeenCalledOnce();
  });

  it("rejects invalid pagination without reading the master list", async () => {
    const response = await GET(new NextRequest("https://nexus.test/api/servers/directory?limit=101"));
    expect(response.status).toBe(400);
    expect(getDirectory).not.toHaveBeenCalled();
  });

  it("returns a retryable 503 when the master server is unavailable", async () => {
    getDirectory.mockRejectedValue(new Error("upstream unavailable"));
    const response = await GET(new NextRequest("https://nexus.test/api/servers/directory"));
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("30");
    expect((await response.json()).error).toMatch(/temporarily unavailable/);
    expect(logEvent).toHaveBeenCalledOnce();
  });
});
