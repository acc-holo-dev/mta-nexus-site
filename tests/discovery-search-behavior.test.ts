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
    expect(results).toMatchObject([{ id: "old-server", players: 7, maxPlayers: 32 }]);
    expect(sources.directory).toHaveBeenCalledOnce();
    expect(sources.products).not.toHaveBeenCalled();
    expect(sources.articles).not.toHaveBeenCalled();
    expect(sources.developers).not.toHaveBeenCalled();
    expect(sources.organizations).not.toHaveBeenCalled();
  });

  it("does not let a full product page hide other matching categories", async () => {
    sources.products.mockResolvedValue(Array.from({ length: 5 }, (_, index) => ({
      id: `p${index}`, title: "Match", slug: `product-${index}`, description: "Body", price: 0,
    })));
    sources.servers.mockResolvedValue([{ id: "s", name: "Match", slug: "server", ipAddress: "203.0.113.1", port: 22003 }]);
    sources.articles.mockResolvedValue([{ id: "a", title: "Match", slug: "article", body: "Body", type: "article" }]);
    sources.developers.mockResolvedValue([{ id: "d", displayName: "Match", username: "developer" }]);
    sources.organizations.mockResolvedValue([{ id: "o", name: "Match", slug: "studio" }]);
    sources.directory.mockRejectedValue(new Error("upstream unavailable"));

    const results = await discoveryService.search("Match", 5);

    expect(results.map((result) => result.type)).toEqual([
      "product", "server", "article", "developer", "organization",
    ]);
    expect(sources.products).toHaveBeenCalledWith({ query: "Match", limit: 5 });
    expect(sources.servers).toHaveBeenCalledWith("Match", 5);
    expect(sources.articles).toHaveBeenCalledWith("Match", 5);
    expect(results[1].players).toBeUndefined();
  });

  it("fills the result limit from one category and avoids directory calls without servers", async () => {
    sources.products.mockResolvedValue(Array.from({ length: 3 }, (_, index) => ({
      id: `p${index}`, title: "Match", slug: `product-${index}`, description: "Body", price: 0,
    })));

    const results = await discoveryService.search("Match", 2);

    expect(results.map((result) => result.type)).toEqual(["product", "product"]);
    expect(sources.directory).not.toHaveBeenCalled();
    expect(sources.servers).toHaveBeenCalledWith("Match", 2);
  });

  it("does not advertise a stale or incomplete player observation as current", async () => {
    sources.servers.mockResolvedValue([{ id: "s", name: "Match", slug: "server", ipAddress: "203.0.113.1", port: 22003 }]);
    sources.directory.mockResolvedValueOnce({
      isStale: true, servers: [{ address: "203.0.113.1", port: 22003, players: 99 }],
    }).mockResolvedValueOnce({
      isStale: false, servers: [{ address: "203.0.113.1", port: 22003 }],
    });

    expect((await discoveryService.search("Match", 1, "server"))[0].players).toBeUndefined();
    expect((await discoveryService.search("Match", 1, "server"))[0].players).toBeUndefined();
  });
});
