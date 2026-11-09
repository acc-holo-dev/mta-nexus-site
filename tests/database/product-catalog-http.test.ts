import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ listPublicPage: vi.fn(), getProductById: vi.fn() }));
vi.mock("../../apps/web/src/lib/services/product-service", () => ({
  productService: { listPublicPage: mocks.listPublicPage, getProductById: mocks.getProductById },
}));
vi.mock("../../apps/web/src/lib/services/auth-service", () => ({ authService: {} }));

import { GET as getProduct } from "../../apps/web/src/app/api/products/[id]/route";
import { GET } from "../../apps/web/src/app/api/products/route";

describe("public resource catalog HTTP", () => {
  it("returns bounded uncached pages and validates category and sort", async () => {
    mocks.listPublicPage.mockResolvedValueOnce({ products: [{ id: "p2" }], hasMore: true });
    const response = await GET(
      new NextRequest(
        "https://nexus.test/api/products?type=api&sort=rating&q=MTA%20map&page=2&limit=24",
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-request-id")).toBeNull();
    expect(await response.json()).toEqual({
      products: [{ id: "p2" }],
      limit: 24,
      page: 2,
      hasMore: true,
    });
    expect(mocks.listPublicPage).toHaveBeenCalledWith({
      type: "api",
      sort: "rating",
      query: "MTA map",
      page: 2,
      pageSize: 24,
    });
  });

  it("does not pass repeated or invalid filters to the database", async () => {
    mocks.listPublicPage.mockResolvedValueOnce({ products: [], hasMore: false });
    const response = await GET(
      new NextRequest(
        "https://nexus.test/api/products?type=script&type=service&sort=hidden&page=-1&limit=9999",
      ),
    );
    expect((await response.json()).limit).toBe(100);
    expect(mocks.listPublicPage).toHaveBeenLastCalledWith({
      type: undefined,
      sort: "popular",
      query: "",
      page: 1,
      pageSize: 100,
    });
  });

  it("does not cache resource detail that can become unavailable", async () => {
    mocks.getProductById.mockResolvedValueOnce({ id: "prd_1", title: "Resource" });
    const response = await getProduct(new NextRequest("https://nexus.test/api/products/prd_1"), {
      params: Promise.resolve({ id: "prd_1" }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    mocks.getProductById.mockResolvedValueOnce(null);
    const missing = await getProduct(new NextRequest("https://nexus.test/api/products/prd_1"), {
      params: Promise.resolve({ id: "prd_1" }),
    });
    expect(missing.status).toBe(404);
    expect(missing.headers.get("cache-control")).toBe("no-store");
  });
});
