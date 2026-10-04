import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getManagedProduct: vi.fn(),
  updateProductDetails: vi.fn(),
  consumeRateLimit: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: mocks.getSession },
}));
vi.mock("../apps/web/src/lib/services/product-service", () => ({ productService: mocks }));
vi.mock("@nexus/security", () => ({ consumeRateLimit: mocks.consumeRateLimit }));
import { PATCH } from "../apps/web/src/app/api/products/[id]/route";
const input = {
  title: "My resource",
  shortDescription: "Summary",
  description: "A complete resource description.",
  tags: ["lua"],
};
const actor = { id: "author", role: "developer" };
function request(body: unknown) {
  return new NextRequest("http://nexus.test/api/products/resource", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}
const params = { params: Promise.resolve({ id: "resource" }) };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSession.mockResolvedValue(actor);
  mocks.getManagedProduct.mockResolvedValue({ id: "resource" });
  mocks.consumeRateLimit.mockResolvedValue({ success: true });
  mocks.updateProductDetails.mockResolvedValue({
    id: "resource",
    ...input,
    storageKey: "private",
    authorId: "author",
    status: "published",
  });
});
it("requires authentication before reading or editing", async () => {
  mocks.getSession.mockResolvedValue(null);
  const response = await PATCH(request(input), params);
  expect(response.status).toBe(401);
  expect(mocks.getManagedProduct).not.toHaveBeenCalled();
  expect(mocks.updateProductDetails).not.toHaveBeenCalled();
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
});
it("hides resources outside the management scope", async () => {
  mocks.getManagedProduct.mockResolvedValue(null);
  expect((await PATCH(request(input), params)).status).toBe(404);
  expect(mocks.consumeRateLimit).not.toHaveBeenCalled();
  expect(mocks.updateProductDetails).not.toHaveBeenCalled();
});
it.each([
  "price",
  "status",
  "authorId",
  "organizationId",
  "slug",
  "type",
  "currentVersion",
  "isFeatured",
])("rejects attempts to mutate %s", async (key) => {
  expect((await PATCH(request({ ...input, [key]: "override" }), params)).status).toBe(400);
  expect(mocks.updateProductDetails).not.toHaveBeenCalled();
});
it("persists only validated details and returns a narrow response", async () => {
  const response = await PATCH(request({ ...input, title: " My resource " }), params);
  expect(response.status).toBe(200);
  expect(mocks.updateProductDetails).toHaveBeenCalledWith("resource", input, actor);
  expect(await response.json()).toEqual({ product: { id: "resource", ...input } });
});
it("respects throttling", async () => {
  mocks.consumeRateLimit.mockResolvedValue({ success: false });
  expect((await PATCH(request(input), params)).status).toBe(429);
  expect(mocks.updateProductDetails).not.toHaveBeenCalled();
});
it("handles a scope change during the guarded write", async () => {
  mocks.updateProductDetails.mockRejectedValue(new AppError("private", 404, "NOT_FOUND"));
  const response = await PATCH(request(input), params);
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ code: "NOT_FOUND" });
});
it("rejects excessive tags and whitespace metadata", async () => {
  for (const body of [
    { ...input, tags: Array(21).fill("tag") },
    { ...input, title: "    " },
    { ...input, tags: ["  "] },
  ])
    expect((await PATCH(request(body), params)).status).toBe(400);
});
