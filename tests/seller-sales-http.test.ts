import { AppError } from "@nexus/domain";
import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  actor: { id: "usr_a" } as { id: string } | null,
  rate: vi.fn(),
  report: vi.fn(),
  detail: vi.fn(),
  scopes: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.actor },
}));
vi.mock("@nexus/security", () => ({ consumeRateLimit: state.rate }));
vi.mock("../apps/web/src/lib/services/seller-sales-service", () => ({
  sellerSalesService: { report: state.report, detail: state.detail, scopes: state.scopes },
}));

import { GET as detail } from "../apps/web/src/app/api/sales/[id]/route";
import { GET as csv } from "../apps/web/src/app/api/sales/export/route";
import { GET as report } from "../apps/web/src/app/api/sales/route";
import { GET as scopes } from "../apps/web/src/app/api/sales/scopes/route";

const date = new Date("2026-10-11T00:00:00Z"),
  request = (path = "") => new NextRequest(`https://nexus.test/api/sales${path}`),
  context = { params: Promise.resolve({ id: "itm_a" }) };
beforeEach(() => {
  vi.clearAllMocks();
  state.actor = { id: "usr_a" };
  state.rate.mockResolvedValue({ success: true });
  state.report.mockResolvedValue({
    page: 1,
    observedAt: date,
    sales: [
      {
        id: "itm_a",
        productId: "prd_a",
        productTitle: "Sale",
        orderNumber: "ORDER-A",
        status: "completed",
        unitPrice: 50,
        currency: "USD",
        createdAt: date,
        evidence: "capture_recorded",
      },
    ],
  });
  state.detail.mockResolvedValue({ sale: { id: "itm_a" } });
  state.scopes.mockResolvedValue({ scopes: [] });
});
it("authenticates every report, export, detail and scope read", async () => {
  state.actor = null;
  for (const res of [
    await report(request()),
    await csv(request("/export")),
    await detail(request("/itm_a"), context),
    await scopes(request("/scopes")),
  ]) {
    expect(res.status).toBe(401);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  }
  expect(state.report).not.toHaveBeenCalled();
  expect(state.scopes).not.toHaveBeenCalled();
  expect(state.detail).not.toHaveBeenCalled();
});
it("uses session actor, strict filters, private headers and inspection policy", async () => {
  const res = await report(
    request(
      "?days=30&page=2&currency=EUR&status=all&evidence=review&organizationId=org_a&productId=prd_a",
    ),
  );
  expect(res.status).toBe(200);
  expect(state.report).toHaveBeenCalledWith(state.actor, {
    page: 2,
    days: 30,
    currency: "EUR",
    status: "all",
    evidence: "review",
    organizationId: "org_a",
    productId: "prd_a",
  });
  expect(state.rate).toHaveBeenCalledWith("resourceInspection", "usr_a");
  expect(res.headers.get("vary")).toBe("Cookie");
  expect(res.headers.get("x-request-id")).toBeTruthy();
});
it("throttles all reads before accessing repository data", async () => {
  state.rate.mockResolvedValue({ success: false });
  for (const res of [
    await report(request()),
    await csv(request("/export")),
    await detail(request("/itm_a"), context),
    await scopes(request("/scopes")),
  ])
    expect(res.status).toBe(429);
  expect(state.report).not.toHaveBeenCalled();
  expect(state.detail).not.toHaveBeenCalled();
  expect(state.scopes).not.toHaveBeenCalled();
});
it("rejects unscoped and repeated selectors", async () => {
  for (const path of ["?userId=other", "?currency=GBP", "?page=1&page=2"]) {
    expect((await report(request(path))).status).toBe(400);
  }
  expect(state.report).not.toHaveBeenCalled();
  expect((await scopes(request("/scopes?organizationId=org_a"))).status).toBe(400);
  expect((await detail(request("/itm_a?organizationId=a&organizationId=b"), context)).status).toBe(
    400,
  );
  expect(state.scopes).not.toHaveBeenCalled();
  expect(state.detail).not.toHaveBeenCalled();
});
it("preserves masked authority errors and exports only one safe page", async () => {
  state.detail.mockRejectedValue(new AppError("private account title", 404, "NOT_FOUND"));
  const res = await detail(request("/itm_a?organizationId=org_a"), context);
  expect(await res.json()).toEqual({ code: "NOT_FOUND" });
  expect(state.detail).toHaveBeenCalledWith(state.actor, "itm_a", "org_a");
  const exportRes = await csv(request("/export?days=7"));
  expect(exportRes.headers.get("content-type")).toContain("text/csv");
  expect(exportRes.headers.get("content-disposition")).toBe(
    'attachment; filename="seller-sales-page-1.csv"',
  );
  expect(exportRes.headers.get("x-content-type-options")).toBe("nosniff");
  expect(await exportRes.text()).toContain("capture_recorded");
});
it("does not expose provider errors in generic failures", async () => {
  state.report.mockRejectedValue(new Error("PROVIDER-SECRET"));
  const res = await report(request());
  expect(res.status).toBe(500);
  expect(await res.json()).toEqual({ code: "RESOURCE_COMMERCE_FAILED" });
});
