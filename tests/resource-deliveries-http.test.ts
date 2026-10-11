import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
const state = vi.hoisted(() => ({
  user: { id: "usr_a", role: "user" } as { id: string; role: "user" } | null,
  rate: vi.fn(),
  page: vi.fn(),
  detail: vi.fn(),
  publisher: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.user },
}));
vi.mock("@nexus/security", () => ({ consumeRateLimit: state.rate }));
vi.mock("@nexus/db", () => ({
  resourceDeliveriesRepository: {
    page: state.page,
    detail: state.detail,
    publisher: state.publisher,
  },
}));
import { GET as page } from "../apps/web/src/app/api/library/downloads/route";
import { GET as detail } from "../apps/web/src/app/api/library/downloads/[id]/route";
import { GET as csv } from "../apps/web/src/app/api/library/downloads/export/route";
import { GET as publisher } from "../apps/web/src/app/api/products/[id]/deliveries/route";
const request = (path = "/api/library/downloads") => new NextRequest(`https://nexus.test${path}`);
beforeEach(() => {
  vi.clearAllMocks();
  state.user = { id: "usr_a", role: "user" };
  state.rate.mockResolvedValue({ success: true });
  state.page.mockResolvedValue({ items: [], counts: { all: 0 }, page: 1 });
  state.detail.mockResolvedValue({ id: "dlv_a" });
  state.publisher.mockResolvedValue({ items: [] });
});
it("serves only session-scoped private, rate-limited histories and receipts", async () => {
  const response = await page(request("/api/library/downloads?days=7&status=failed&page=2"));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(state.rate).toHaveBeenCalledWith("resourceInspection", "usr_a");
  expect(state.page).toHaveBeenCalledWith("usr_a", {
    days: "7",
    status: "failed",
    page: 2,
    resourceId: null,
  });
  expect(
    (
      await detail(request("/api/library/downloads/dlv_a"), {
        params: Promise.resolve({ id: "dlv_a" }),
      })
    ).status,
  ).toBe(200);
  expect(state.detail).toHaveBeenCalledWith("usr_a", "dlv_a");
});
it("guests cannot read or export receipts", async () => {
  state.user = null;
  expect((await csv(request("/api/library/downloads/export"))).status).toBe(401);
  expect(
    (
      await detail(request("/api/library/downloads/dlv_a"), {
        params: Promise.resolve({ id: "dlv_a" }),
      })
    ).status,
  ).toBe(401);
  expect(state.page).not.toHaveBeenCalled();
  expect(state.detail).not.toHaveBeenCalled();
});
it("rejects account selectors, invalid receipt IDs and excessive inspection", async () => {
  expect((await page(request("/api/library/downloads?userId=usr_other"))).status).toBe(400);
  expect(
    (
      await detail(request("/api/library/downloads/bad"), {
        params: Promise.resolve({ id: "bad" }),
      })
    ).status,
  ).toBe(400);
  state.rate.mockResolvedValue({ success: false });
  expect((await page(request())).status).toBe(429);
  expect(state.page).not.toHaveBeenCalled();
  expect(state.detail).not.toHaveBeenCalled();
});
it("a foreign receipt and revoked publisher authority remain opaque", async () => {
  state.detail.mockRejectedValue(new AppError("private receipt context", 404, "NOT_FOUND"));
  const denied = await detail(request("/api/library/downloads/dlv_other"), {
    params: Promise.resolve({ id: "dlv_other" }),
  });
  expect(denied.status).toBe(404);
  expect(await denied.json()).toEqual({ code: "NOT_FOUND" });
  state.publisher.mockRejectedValue(new AppError("private buyer context", 404, "NOT_FOUND"));
  expect(
    (
      await publisher(request("/api/products/prd_a/deliveries?days=30"), {
        params: Promise.resolve({ id: "prd_a" }),
      })
    ).status,
  ).toBe(404);
  expect(state.publisher).toHaveBeenCalledWith("prd_a", "usr_a", { days: "30", page: 1 });
});
it("exports just the requested page with private headers", async () => {
  const response = await csv(request("/api/library/downloads/export?status=cancelled&page=2"));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(state.page).toHaveBeenCalledWith(
    "usr_a",
    expect.objectContaining({ page: 2, status: "cancelled" }),
  );
  expect(await response.text()).toContain("receipt_id,resource_id");
});
