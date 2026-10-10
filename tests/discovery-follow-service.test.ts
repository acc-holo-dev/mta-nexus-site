import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  creators: vi.fn(),
  organizations: vi.fn(),
  servers: vi.fn(),
  content: vi.fn(),
  products: vi.fn(),
  follows: vi.fn(),
}));
vi.mock("@nexus/db", () => ({
  publicDirectoryRepository: {
    pageCreators: mocks.creators,
    pageOrganizations: mocks.organizations,
    pageServers: mocks.servers,
  },
  authorContentRepository: { pagePublic: mocks.content },
  followWorkspaceRepository: { page: mocks.follows },
}));
vi.mock("../apps/web/src/lib/services/product-service", () => ({
  productService: { listPublicPage: mocks.products },
}));
vi.mock("../apps/web/src/lib/services/mta-master-directory-service", () => ({}));
import { discoveryService } from "../apps/web/src/lib/services/discovery-service";
import { followWorkspaceService } from "../apps/web/src/lib/services/follow-workspace-service";
import { parseDiscoverQuery } from "../apps/web/src/lib/discover-query";
beforeEach(() => {
  vi.clearAllMocks();
  for (const fn of Object.values(mocks))
    fn.mockResolvedValue({ items: [], page: 2, hasMore: false });
});
it("delegates resource pages to the existing catalog without introducing commercial logic", async () => {
  mocks.products.mockResolvedValue({ products: [{ id: "resource" }], hasMore: true });
  const result = await discoveryService.page(
    parseDiscoverQuery({ type: "resources", q: "Lua", page: "2" }),
  );
  expect(mocks.products).toHaveBeenCalledWith({
    query: "Lua",
    sort: "relevance",
    page: 2,
    pageSize: 24,
  });
  expect(result).toMatchObject({ type: "resources", items: [{ id: "resource" }], hasMore: true });
  expect(mocks.servers).not.toHaveBeenCalled();
});
it("reuses published content pagination for selected discussion types", async () => {
  await discoveryService.page(
    parseDiscoverQuery({ type: "content", contentType: "question", q: "Lua", page: "3" }),
  );
  expect(mocks.content).toHaveBeenCalledWith(
    ["article", "devlog", "announcement", "review", "post", "question", "news", "update"],
    { query: "Lua", page: 3, type: "question" },
  );
});
it.each(["creators", "organizations", "servers"] as const)(
  "sanitizes public image URLs for %s pages",
  async (type) => {
    mocks[type].mockResolvedValue({
      items: [
        {
          id: "item",
          avatarUrl: "javascript:alert(1)",
          logoUrl: "data:text/html,bad",
          bannerUrl: "https://safe.test/image.png",
        },
      ],
      page: 1,
      hasMore: false,
    });
    const result = await discoveryService.page(parseDiscoverQuery({ type }));
    if (result.type === "creators") expect(result.items[0].avatarUrl).toBeNull();
    if (result.type === "organizations") expect(result.items[0].logoUrl).toBeNull();
    if (result.type === "servers")
      expect(result.items[0]).toMatchObject({
        logoUrl: undefined,
        bannerUrl: "https://safe.test/image.png",
      });
  },
);
it("projects saved identity and exact cursor without exposing repository-only fields", async () => {
  const cursor = { createdAt: "2026-10-10T12:00:00.123456Z", id: "follow" };
  mocks.follows.mockResolvedValue({
    items: [
      {
        id: "follow",
        targetType: "organization",
        targetId: "org",
        createdAt: new Date(cursor.createdAt),
        cursorTime: cursor.createdAt,
        title: "Team",
        handle: "team & friends",
        description: null,
        image: "javascript:bad",
        verified: false,
        email: "private@test",
      },
    ],
    hasMore: true,
    nextCursor: cursor,
  });
  const result = await followWorkspaceService.page("actor", {
    type: undefined,
    query: "",
    cursor: undefined,
  });
  expect(JSON.parse(result.nextCursor ?? "")).toEqual(cursor);
  expect(result.items[0].href).toBe("/organizations/team%20%26%20friends");
  expect(result.items[0].image).toBeNull();
  expect(result.items[0]).not.toHaveProperty("email");
  expect(result.items[0]).not.toHaveProperty("cursorTime");
});
