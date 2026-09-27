import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ listPublicPage: vi.fn() }));
vi.mock("../apps/web/src/lib/services/product-service", () => ({
  productService: { listPublicPage: mocks.listPublicPage },
}));

import { GET } from "../apps/web/src/app/api/products/route";

describe("public resource catalog HTTP", () => {
  it("returns bounded pages, preserves public caching, and validates category and sort", async () => {
    mocks.listPublicPage.mockResolvedValueOnce({ products: [{ id: "p2" }], hasMore: true });
    const response = await GET(new NextRequest(
      "https://nexus.test/api/products?type=api&sort=rating&q=MTA%20map&page=2&limit=24",
    ));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("public, max-age=30");
    expect(await response.json()).toEqual({
      products: [{ id: "p2" }], limit: 24, page: 2, hasMore: true,
    });
    expect(mocks.listPublicPage).toHaveBeenCalledWith({
      type: "api", sort: "rating", query: "MTA map", page: 2, pageSize: 24,
    });
  });

  it("does not pass repeated or invalid filters to the database", async () => {
    mocks.listPublicPage.mockResolvedValueOnce({ products: [], hasMore: false });
    const response = await GET(new NextRequest(
      "https://nexus.test/api/products?type=script&type=service&sort=hidden&page=-1&limit=9999",
    ));
    expect((await response.json()).limit).toBe(100);
    expect(mocks.listPublicPage).toHaveBeenLastCalledWith({
      type: undefined, sort: "popular", query: "", page: 1, pageSize: 100,
    });
  });
});
