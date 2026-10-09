import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { getDirectory, listServers } = vi.hoisted(() => ({ getDirectory: vi.fn(), listServers: vi.fn() }));
vi.mock("../apps/web/src/lib/services/server-service", () => ({
  serverService: { listServers },
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: {},
}));
vi.mock("../apps/web/src/lib/services/mta-master-directory-service", async (importOriginal) => {
  const original = await importOriginal<typeof import("../apps/web/src/lib/services/mta-master-directory-service")>();
  return { ...original, mtaMasterDirectoryService: { getDirectory } };
});

import { GET } from "../apps/web/src/app/api/servers/route";

beforeEach(() => {
  getDirectory.mockReset();
  listServers.mockReset().mockResolvedValue([{
    id: "s1", slug: "nexus", name: "Nexus", ipAddress: "203.0.113.7", port: 22003,
  }]);
});

describe("editorial server API", () => {
  it("never calls a stale or unavailable directory snapshot live", async () => {
    getDirectory.mockResolvedValueOnce({
      servers: [{ address: "203.0.113.7", port: 22003, players: 12 }], isStale: true,
    }).mockResolvedValueOnce({
      servers: [{ address: "203.0.113.7", port: 22003, players: 12 }], isStale: false,
    }).mockRejectedValueOnce(new Error("upstream down"));

    const request = () => new NextRequest("https://nexus.test/api/servers?limit=500");
    const stale = await (await GET(request())).json();
    const fresh = await (await GET(request())).json();
    const unavailable = await (await GET(request())).json();

    expect(listServers).toHaveBeenCalledWith(100);
    expect(stale.directoryIsStale).toBe(true);
    expect(stale.servers[0]).toMatchObject({ liveStatus: "unknown", liveObservation: { players: 12 } });
    expect(fresh.servers[0].liveStatus).toBe("online");
    expect(unavailable.servers[0]).toMatchObject({ liveStatus: "unknown", liveObservation: null });
  });

  it("performs independent editorial and directory reads together", async () => {
    let resolveServers!: (value: { id: string; name: string; ipAddress: string; port: number }[]) => void;
    listServers.mockReturnValueOnce(new Promise(resolve => { resolveServers = resolve; }));
    getDirectory.mockResolvedValueOnce({ servers: [], isStale: false });
    const pending = GET(new NextRequest("https://nexus.test/api/servers"));
    expect(listServers).toHaveBeenCalledOnce();
    expect(getDirectory).toHaveBeenCalledOnce();
    resolveServers([{ id: "srv_one", name: "Server", ipAddress: "203.0.113.7", port: 22003 }]);
    expect((await (await pending).json()).servers).toHaveLength(1);
  });

  it("shares endpoint indexing when many listings miss a large master snapshot", async () => {
    let reads = 0;
    const observations = new Proxy(Array.from({ length: 10_000 }, (_, index) => ({
      address: `other-${index}.test`, port: 22003, players: 5,
    })), {
      get(target, key, receiver) {
        if (typeof key === "string" && /^\\d+$/u.test(key)) reads++;
        return Reflect.get(target, key, receiver);
      },
    });
    const requested = Array.from({ length: 60 }, (_, index) => ({
      id: `srv_${index}`, name: `Server ${index}`,
      ipAddress: `missing-${index}.test`, port: 22003,
    }));
    listServers.mockResolvedValueOnce(requested);
    getDirectory.mockResolvedValueOnce({ servers: observations, isStale: false });
    const response = await GET(new NextRequest("https://nexus.test/api/servers?limit=60"));
    const result = await response.json();
    expect(result.servers).toHaveLength(60);
    expect(result.servers.every((server: { liveObservation: unknown; liveStatus: string }) =>
      server.liveObservation === null && server.liveStatus === "unknown")).toBe(true);
    // Previously: 60 * 10,000 index reads. Now: at most one full scan.
    expect(reads).toBe(10_000);
  });

  it("prevents shared caching when live provenance is stale or missing", async () => {
    listServers.mockResolvedValue([{ id: "srv_1", name: "Nexus", ipAddress: "203.0.113.7", port: 22003 }]);
    getDirectory.mockResolvedValueOnce({ servers: [], isStale: true })
      .mockRejectedValueOnce(new Error("unavailable"))
      .mockResolvedValueOnce({ servers: [], isStale: false });
    const request = () => new NextRequest("https://nexus.test/api/servers");
    const stale = await GET(request());
    const missing = await GET(request());
    const fresh = await GET(request());
    expect(stale.headers.get("Cache-Control")).toBe("no-store");
    expect(missing.headers.get("Cache-Control")).toBe("no-store");
    expect(fresh.headers.get("Cache-Control")).toContain("max-age=30");
  });
});
