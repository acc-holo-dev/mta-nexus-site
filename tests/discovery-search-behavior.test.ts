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
vi.mock("../apps/web/src/lib/services/mta-master-directory-service", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("../apps/web/src/lib/services/mta-master-directory-service")
  >()),
  mtaMasterDirectoryService: { getDirectory: sources.directory },
}));

import { discoveryService } from "../apps/web/src/lib/services/discovery-service";

beforeEach(() => {
  for (const source of Object.values(sources)) source.mockReset().mockResolvedValue([]);
});

describe("discovery search", () => {
  it("scans a 10,000-entry snapshot once for fifty unmatched server results", async () => {
    let addressReads = 0;
    const servers = Array.from({ length: 10_000 }, (_, index) => ({
      get address() {
        addressReads++;
        return `server-${index}.test`;
      },
      port: 22003,
      players: 99,
    }));
    sources.servers.mockResolvedValue(
      Array.from({ length: 50 }, (_, index) => ({
        id: `s${index}`,
        name: `Server ${index}`,
        slug: `server-${index}`,
        ipAddress: `missing-${index}.test`,
        port: 22003,
      })),
    );
    sources.directory.mockResolvedValue({ isStale: false, servers });
    const results = await discoveryService.search("Server", 50, "server");
    expect(results).toHaveLength(50);
    expect(results.every((result) => result.players === undefined)).toBe(true);
    expect(addressReads).toBe(10_000);
    expect(sources.directory).toHaveBeenCalledOnce();
  });

  it("keeps a single early match from visiting the rest of the directory", async () => {
    sources.servers.mockResolvedValue([
      {
        id: "s",
        name: "Match",
        slug: "match",
        ipAddress: "Play.Example.COM.",
        port: 22003,
      },
    ]);
    const untouched = vi.fn(() => "unused.test");
    sources.directory.mockResolvedValue({
      isStale: false,
      servers: [
        { address: " play.example.com ", port: 22003, players: 0, maxPlayers: 32 },
        {
          get address() {
            return untouched();
          },
          port: 22003,
          players: 99,
        },
      ],
    });
    expect(await discoveryService.search("Match", 1, "server")).toMatchObject([
      { id: "s", players: 0, maxPlayers: 32 },
    ]);
    expect(untouched).not.toHaveBeenCalled();
  });

  it("preserves normalized endpoint, port and first-duplicate behavior for indexed results", async () => {
    sources.servers.mockResolvedValue([
      { id: "zero", name: "Zero", slug: "zero", ipAddress: "  Play.Example.COM. ", port: 22003 },
      {
        id: "unknown",
        name: "Unknown",
        slug: "unknown",
        ipAddress: "play.example.com",
        port: 22004,
      },
      { id: "ipv6", name: "IPv6", slug: "ipv6", ipAddress: "2001:DB8::1", port: 22003 },
    ]);
    sources.directory.mockResolvedValue({
      isStale: false,
      servers: [
        { address: "play.example.com", port: 22003, players: 0, maxPlayers: 32 },
        { address: "PLAY.EXAMPLE.COM.", port: 22003, players: 99, maxPlayers: 100 },
        { address: "play.example.com", port: 22004 },
        { address: "play.example.com", port: 22004, players: 99 },
        { address: "2001:db8::1", port: 22003, players: 7, maxPlayers: 16 },
      ],
    });
    const results = await discoveryService.search("Server", 3, "server");
    expect(results.map((result) => [result.id, result.players, result.maxPlayers])).toEqual([
      ["zero", 0, 32],
      ["unknown", undefined, undefined],
      ["ipv6", 7, 16],
    ]);
  });

  it("does not inspect a stale snapshot when several server results are shown", async () => {
    sources.servers.mockResolvedValue(
      Array.from({ length: 3 }, (_, index) => ({
        id: `s${index}`,
        name: "Match",
        slug: `server-${index}`,
        ipAddress: "play.example.com",
        port: 22003,
      })),
    );
    const inspected = vi.fn(() => "play.example.com");
    sources.directory.mockResolvedValue({
      isStale: true,
      servers: [
        {
          get address() {
            return inspected();
          },
          port: 22003,
          players: 99,
        },
      ],
    });
    const results = await discoveryService.search("Match", 3, "server");
    expect(results.every((result) => result.players === undefined)).toBe(true);
    expect(inspected).not.toHaveBeenCalled();
  });

  it("searches the requested category in the database and skips unrelated sources", async () => {
    sources.servers.mockResolvedValue([
      {
        id: "old-server",
        name: "Nexus",
        slug: "nexus",
        ipAddress: "127.0.0.1",
        port: 22003,
      },
    ]);
    sources.directory.mockResolvedValue({
      servers: [{ address: "127.0.0.1", port: 22003, players: 7, maxPlayers: 32 }],
    });

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
    sources.products.mockResolvedValue(
      Array.from({ length: 5 }, (_, index) => ({
        id: `p${index}`,
        title: "Match",
        slug: `product-${index}`,
        description: "Body",
        price: 0,
      })),
    );
    sources.servers.mockResolvedValue([
      { id: "s", name: "Match", slug: "server", ipAddress: "203.0.113.1", port: 22003 },
    ]);
    sources.articles.mockResolvedValue([
      { id: "a", title: "Match", slug: "article", body: "Body", type: "article" },
    ]);
    sources.developers.mockResolvedValue([
      { id: "d", displayName: "Match", username: "developer" },
    ]);
    sources.organizations.mockResolvedValue([{ id: "o", name: "Match", slug: "studio" }]);
    sources.directory.mockRejectedValue(new Error("upstream unavailable"));

    const results = await discoveryService.search("Match", 5);

    expect(results.map((result) => result.type)).toEqual([
      "product",
      "server",
      "article",
      "developer",
      "organization",
    ]);
    expect(sources.products).toHaveBeenCalledWith({ query: "Match", limit: 5 });
    expect(sources.servers).toHaveBeenCalledWith("Match", 5);
    expect(sources.articles).toHaveBeenCalledWith("Match", 5);
    expect(results[1].players).toBeUndefined();
  });

  it("fills the result limit from one category and avoids directory calls without servers", async () => {
    sources.products.mockResolvedValue(
      Array.from({ length: 3 }, (_, index) => ({
        id: `p${index}`,
        title: "Match",
        slug: `product-${index}`,
        description: "Body",
        price: 0,
      })),
    );

    const results = await discoveryService.search("Match", 2);

    expect(results.map((result) => result.type)).toEqual(["product", "product"]);
    expect(sources.directory).not.toHaveBeenCalled();
    expect(sources.servers).toHaveBeenCalledWith("Match", 2);
  });

  it("does not advertise a stale or incomplete player observation as current", async () => {
    sources.servers.mockResolvedValue([
      { id: "s", name: "Match", slug: "server", ipAddress: "203.0.113.1", port: 22003 },
    ]);
    sources.directory
      .mockResolvedValueOnce({
        isStale: true,
        servers: [{ address: "203.0.113.1", port: 22003, players: 99 }],
      })
      .mockResolvedValueOnce({
        isStale: false,
        servers: [{ address: "203.0.113.1", port: 22003 }],
      });

    expect((await discoveryService.search("Match", 1, "server"))[0].players).toBeUndefined();
    expect((await discoveryService.search("Match", 1, "server"))[0].players).toBeUndefined();
  });
});
