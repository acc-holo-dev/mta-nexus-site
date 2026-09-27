import { beforeEach, describe, expect, it, vi } from "vitest";

const sources = vi.hoisted(() => ({
  products: vi.fn(),
  servers: vi.fn(),
  articles: vi.fn(),
  developers: vi.fn(),
  organizations: vi.fn(),
  directory: vi.fn(),
}));

vi.mock("@nexus/db", () => ({
  productRepository: { list: sources.products },
  serverRepository: { searchActivePublic: sources.servers },
  contentRepository: { searchPublished: sources.articles },
  userRepository: { searchDevelopers: sources.developers },
  organizationRepository: { searchPublic: sources.organizations },
}));
vi.mock("../apps/web/src/lib/services/mta-master-directory-service", () => ({
  matchesMtaEndpoint: (a: { ipAddress: string; port: number }, b: { address: string; port: number }) =>
    a.ipAddress === b.address && a.port === b.port,
  mtaMasterDirectoryService: { getDirectory: sources.directory },
}));

import { discoveryService } from "../apps/web/src/lib/services/discovery-service";

beforeEach(() => {
  for (const source of Object.values(sources)) source.mockReset().mockResolvedValue([]);
});

describe("discovery search", () => {
  it("searches the requested category in the database and skips unrelated sources", async () => {
    sources.servers.mockResolvedValue([{
      id: "old-server", name: "Nexus", slug: "nexus", ipAddress: "127.0.0.1", port: 22003,
    }]);
    sources.directory.mockResolvedValue({ servers: [{ address: "127.0.0.1", port: 22003, players: 7, maxPlayers: 32 }] });

    const results = await discoveryService.search("  nexus  ", 1, "server");

    expect(sources.servers).toHaveBeenCalledWith("nexus", 1);
    expect(results).toMatchObject([{ id: "old-server", badge: "7/32 players" }]);
    expect(sources.directory).toHaveBeenCalledOnce();
    expect(sources.products).not.toHaveBeenCalled();
    expect(sources.articles).not.toHaveBeenCalled();
    expect(sources.developers).not.toHaveBeenCalled();
    expect(sources.organizations).not.toHaveBeenCalled();
  });

  it("bounds later sources by remaining capacity and avoids directory calls for empty matches", async () => {
    sources.products.mockResolvedValue([{ id: "p", title: "Match", slug: "match", description: "Body", price: 0 }]);
    sources.articles.mockResolvedValue([{ id: "a", title: "Match", slug: "match", body: "Body", type: "article" }]);

    const results = await discoveryService.search("Match", 2);

    expect(results.map((result) => result.type)).toEqual(["product", "article"]);
    expect(sources.servers).toHaveBeenCalledWith("Match", 1);
    expect(sources.articles).toHaveBeenCalledWith("Match", 1);
    expect(sources.directory).not.toHaveBeenCalled();
    expect(sources.developers).not.toHaveBeenCalled();
    expect(sources.organizations).not.toHaveBeenCalled();
  });
});
