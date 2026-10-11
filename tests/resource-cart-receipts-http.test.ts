import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
const state = vi.hoisted(() => ({
  user: { id: "usr_a" } as { id: string } | null,
  rate: vi.fn(),
  page: vi.fn(),
  detail: vi.fn(),
  review: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.user },
}));
vi.mock("@nexus/security", () => ({ consumeRateLimit: state.rate }));
vi.mock("../apps/web/src/lib/services/resource-cart-receipts-service", () => ({
  resourceCartReceiptsService: { page: state.page, detail: state.detail },
}));
vi.mock("../apps/web/src/lib/services/commerce-service", () => ({
  commerceService: { reviewResourceCart: state.review },
}));
import { GET as page } from "../apps/web/src/app/api/resources/cart/receipts/route";
import { GET as detail } from "../apps/web/src/app/api/resources/cart/receipts/[id]/route";
import { GET as csv } from "../apps/web/src/app/api/resources/cart/receipts/export/route";
import { GET as review } from "../apps/web/src/app/api/resources/cart/review/route";
const requestId = "11111111-1111-4111-8111-111111111111",
  context = { params: Promise.resolve({ id: requestId }) };
const request = (url: string) => new NextRequest(`https://nexus.test/api/resources/cart/${url}`);
beforeEach(() => {
  vi.clearAllMocks();
  state.user = { id: "usr_a" };
  state.rate.mockResolvedValue({ success: true });
  state.page.mockResolvedValue({
    items: [
      { requestId, createdAt: new Date("2026-10-11T00:00:00Z"), reviewed: true, itemCount: 1 },
    ],
    page: 1,
  });
  state.detail.mockResolvedValue({ requestId });
  state.review.mockResolvedValue({ items: [], limit: 20, reviewDigest: null });
});
it("authenticates all inspection paths before executing scoped reads", async () => {
  state.user = null;
  for (const response of [
    await page(request("receipts?days=7")),
    await detail(request(`receipts/${requestId}`), context),
    await csv(request("receipts/export")),
    await review(request("review")),
  ])
    expect(response.status).toBe(401);
  expect(state.page).not.toHaveBeenCalled();
  expect(state.detail).not.toHaveBeenCalled();
  expect(state.review).not.toHaveBeenCalled();
});
it("uses private session scope, strict filters and inspection rate limits", async () => {
  const response = await page(request("receipts?days=30&page=2&evidence=reviewed"));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(state.page).toHaveBeenCalledWith(state.user, { days: 30, page: 2, evidence: "reviewed" });
  expect(state.rate).toHaveBeenCalledWith("resourceInspection", "usr_a");
  expect((await page(request("receipts?userId=other"))).status).toBe(400);
  await detail(request(`receipts/${requestId}`), context);
  expect(state.detail).toHaveBeenCalledWith(state.user, requestId);
  state.rate.mockResolvedValue({ success: false });
  expect((await review(request("review"))).status).toBe(429);
  expect(state.review).not.toHaveBeenCalled();
});
it("exports the selected page only with safe attachment headers", async () => {
  const response = await csv(request("receipts/export?days=7&evidence=reviewed"));
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("text/csv");
  expect(response.headers.get("content-disposition")).toContain("page-1.csv");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(await response.text()).toContain(requestId);
});
it("masks private missing receipt details and rejects malformed identities", async () => {
  state.detail.mockRejectedValue(new AppError("Private provider key", 404, "NOT_FOUND"));
  const response = await detail(request(`receipts/${requestId}`), context);
  expect(await response.json()).toEqual({ code: "NOT_FOUND" });
  state.detail.mockClear();
  expect(
    (await detail(request("receipts/x"), { params: Promise.resolve({ id: "../private" }) })).status,
  ).toBe(400);
  expect(state.detail).not.toHaveBeenCalled();
});
