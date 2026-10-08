import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({
  user: { id: "reviewer" } as { id: string } | null,
  product: { id: "resource" } as { id: string } | null,
  manager: false,
  existing: false,
  entitled: false,
}));
const addReview = vi.hoisted(() => vi.fn());
const rateLimit = vi.hoisted(() => vi.fn(async () => ({ success: true })));

vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.user },
}));
vi.mock("../apps/web/src/lib/services/product-service", () => ({
  productService: {
    getProductById: async () => state.product,
    canManageProduct: async () => state.manager,
  },
}));
vi.mock("@nexus/db", () => ({
  contentRepository: {
    hasReviewFromUser: async () => state.existing,
    addProductReview: addReview,
  },
  entitlementRepository: {
    hasEntitlement: async () => state.entitled,
  },
}));
vi.mock("@nexus/security", () => ({
  consumeRateLimit: rateLimit,
  generateId: () => "test-review-id",
}));

import { POST } from "../apps/web/src/app/api/products/[id]/reviews/route";

function request(body: unknown = { text: "A useful map", rating: 5 }) {
  const request = new NextRequest("https://nexus.test/api/products/resource/reviews", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
  request.cookies.set("nexus_session", "session");
  return request;
}

async function review(body?: unknown) {
  return POST(request(body), { params: Promise.resolve({ id: "resource" }) });
}

beforeEach(() => {
  state.user = { id: "reviewer" };
  state.product = { id: "resource" };
  state.manager = false;
  state.existing = false;
  state.entitled = false;
  addReview.mockReset();
  rateLimit.mockReset().mockResolvedValue({ success: true });
});

describe("resource reviews over HTTP", () => {
  it("requires an account and a currently published resource", async () => {
    state.user = null;
    expect((await review()).status).toBe(401);
    state.user = { id: "reviewer" };
    state.product = null;
    expect((await review()).status).toBe(404);
    expect(addReview).not.toHaveBeenCalled();
  });

  it("rejects managers, duplicate reviews and accounts without the resource", async () => {
    state.manager = true;
    expect((await review()).status).toBe(403);
    state.manager = false;
    state.existing = true;
    expect((await review()).status).toBe(409);
    state.existing = false;
    expect((await review()).status).toBe(403);
    expect(addReview).not.toHaveBeenCalled();
  });

  it("rejects excessive requests and invalid review bodies before any database write", async () => {
    rateLimit.mockResolvedValueOnce({ success: false });
    expect((await review()).status).toBe(429);
    expect((await review({ text: "", rating: 6 })).status).toBe(400);
    expect(addReview).not.toHaveBeenCalled();
  });

  it("accepts an acquired resource with audit evidence and no shared cache", async () => {
    state.entitled = true;
    addReview.mockResolvedValue({ review: { id: "review" }, ratingCount: 1, ratingAverage: 5 });
    const response = await review();
    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Request-Id")).toMatch(
      /^[0-9a-f-]{20,}$/u,
    );
    expect(await response.json()).toMatchObject({ success: true, review: { id: "review" } });
    expect(addReview).toHaveBeenCalledWith(
      expect.objectContaining({ productId: "resource", authorId: "reviewer", isVerifiedPurchase: true }),
      expect.objectContaining({ action: "product.review_submitted", details: { rating: 5, verifiedAcquisition: true } }),
    );
  });

  it("rejects concurrent duplicate insertion and a publication change", async () => {
    state.entitled = true;
    addReview.mockRejectedValueOnce({ code: "23505" }).mockRejectedValueOnce(new Error("PRODUCT_NOT_PUBLISHED"));
    expect((await review()).status).toBe(409);
    expect((await review()).status).toBe(404);
  });
});
