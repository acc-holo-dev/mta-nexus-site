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
});
