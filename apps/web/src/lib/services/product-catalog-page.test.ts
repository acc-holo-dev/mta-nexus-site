import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@nexus/db", () => ({ productRepository: { list: mocks.list } }));

import { ProductService } from "./product-service";

describe("free catalog page boundary", () => {
  it("requests one extra row to decide if the next page exists, without returning it", async () => {
    const rows = Array.from({ length: 25 }, (_, index) => ({ id: `resource-${index}` }));
    mocks.list.mockResolvedValueOnce(rows);

    const result = await new ProductService().listPublicPage({
      page: 2, pageSize: 24, sort: "newest", type: "script", query: "map",
    });
    expect(result.products).toHaveLength(24);
    expect(result.products).not.toContain(rows[24]);
    expect(result.hasMore).toBe(true);
    expect(mocks.list).toHaveBeenCalledWith({
      type: "script", featuredOnly: undefined, minPrice: 0, maxPrice: 0,
      sort: "newest", query: "map", limit: 25, offset: 24,
    });
  });

  it("stops navigation when the database has no extra row", async () => {
    mocks.list.mockResolvedValueOnce([{ id: "only" }]);
    const result = await new ProductService().listPublicPage({ page: 5, pageSize: 24 });
    expect(result).toMatchObject({ hasMore: false });
    expect(result.products).toHaveLength(1);
  });
});
