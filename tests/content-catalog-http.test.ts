import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ articles: vi.fn(), community: vi.fn() }));
vi.mock("../apps/web/src/lib/services/content-service", () => ({
  contentService: { pageArticles: mocks.articles, pageCommunity: mocks.community },
}));
import { GET } from "../apps/web/src/app/api/content/catalog/route";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.articles.mockResolvedValue({ items: [], page: 2, hasMore: false });
  mocks.community.mockResolvedValue({ items: [], page: 1, hasMore: true });
});
it("exposes a cacheable public editorial catalog without session access", async () => {
  const response = await GET(
    new NextRequest("http://nexus.test/api/content/catalog?page=2&q=lua&type=news"),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("public, max-age=30");
  expect(response.headers.get("x-request-id")).toBeNull();
  expect(mocks.articles).toHaveBeenCalledWith({ page: 2, query: "lua", type: "news" });
  expect(mocks.community).not.toHaveBeenCalled();
});
it("routes community topics through the existing content service", async () => {
  const response = await GET(
    new NextRequest(
      "http://nexus.test/api/content/catalog?channel=community&type=question&page=NaN",
    ),
  );
  expect(await response.json()).toEqual({ items: [], page: 1, hasMore: true });
  expect(mocks.community).toHaveBeenCalledWith({ page: 1, query: "", type: "question" });
});
it("does not cache service failures or expose database details", async () => {
  mocks.articles.mockRejectedValue(new Error("Database password"));
  const response = await GET(
    new NextRequest("http://nexus.test/api/content/catalog", {
      headers: { cookie: "nexus_locale=ru" },
    }),
  );
  expect(response.status).toBe(503);
  expect(response.headers.get("cache-control")).toBe("no-store");
  const data = await response.json();
  expect(data.error).toContain("временно недоступен");
  expect(data.error).not.toContain("Database password");
});
