import { AppError } from "@nexus/domain";
import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  actor: { id: "usr_a", role: "user" } as { id: string; role: string } | null,
  rate: vi.fn(),
  report: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.actor },
}));
vi.mock("@nexus/security", () => ({ consumeRateLimit: state.rate }));
vi.mock("@nexus/db", () => ({ orderTermsRepository: { report: state.report } }));

import { GET as adminExport } from "../apps/web/src/app/api/admin/commerce/orders/[id]/terms/export/route";
import { GET as admin } from "../apps/web/src/app/api/admin/commerce/orders/[id]/terms/route";
import { GET as buyerExport } from "../apps/web/src/app/api/orders/[id]/terms/export/route";
import { GET as buyer } from "../apps/web/src/app/api/orders/[id]/terms/route";

const context = { params: Promise.resolve({ id: "ord_a" }) },
  request = (url: string) => new NextRequest(`https://nexus.test${url}`),
  paths = [
    "/api/orders/ord_a/terms",
    "/api/orders/ord_a/terms/export",
    "/api/admin/commerce/orders/ord_a/terms",
    "/api/admin/commerce/orders/ord_a/terms/export",
  ] as const,
  surfaces = [
    [buyer, paths[0]],
    [buyerExport, paths[1]],
    [admin, paths[2]],
    [adminExport, paths[3]],
  ] as const;
beforeEach(() => {
  vi.clearAllMocks();
  state.actor = { id: "usr_a", role: "user" };
  state.rate.mockResolvedValue({ success: true });
  state.report.mockResolvedValue({ order: { id: "ord_a" }, page: 2, lines: [] });
});
it("authenticates every terms and export path before inspecting an order", async () => {
  state.actor = null;
  for (const [handler, path] of surfaces)
    expect((await handler(request(path), context)).status).toBe(401);
  expect(state.report).not.toHaveBeenCalled();
});
it("fixes authority scope server-side and applies private inspection limits", async () => {
  const res = await buyer(request(`${paths[0]}?page=2`), context);
  expect(res.status).toBe(200);
  expect(state.report).toHaveBeenCalledWith("usr_a", "ord_a", "buyer", 2);
  expect(res.headers.get("cache-control")).toBe("private, no-store");
  expect(res.headers.get("vary")).toBe("Cookie");
  expect(res.headers.get("x-request-id")).toBeTruthy();
  expect(state.rate).toHaveBeenCalledWith("resourceInspection", "usr_a");
  await admin(request(`${paths[2]}?page=2`), context);
  expect(state.report).toHaveBeenCalledWith("usr_a", "ord_a", "admin", 2);
});
it("rejects malformed IDs and client-selected identities, scope or limits", async () => {
  for (const q of ["scope=admin", "buyerId=other", "pageSize=100", "page=1&page=2", "page=1%0A"]) {
    expect((await buyer(request(`${paths[0]}?${q}`), context)).status).toBe(400);
  }
  expect(
    (await buyer(request(paths[0]), { params: Promise.resolve({ id: "../private" }) })).status,
  ).toBe(400);
  expect(state.report).not.toHaveBeenCalled();
});
it("throttles every surface before data access", async () => {
  state.rate.mockResolvedValue({ success: false });
  for (const [handler, path] of surfaces)
    expect((await handler(request(path), context)).status).toBe(429);
  expect(state.report).not.toHaveBeenCalled();
});
it("exports one bounded page with private headers and masks inaccessible orders", async () => {
  for (const h of [buyerExport, adminExport]) {
    const res = await h(request(paths[1]), context);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="order-terms-page-2.json"',
    );
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await res.json()).toMatchObject({ page: 2 });
  }
  state.report.mockRejectedValue(new AppError("PRIVATE-BUYER", 404, "NOT_FOUND"));
  const res = await buyer(request(paths[0]), context);
  expect(await res.json()).toEqual({ code: "NOT_FOUND" });
});
it("oversized exports fail without returning private data", async () => {
  state.report.mockResolvedValue({ page: 2, privateLarge: "x".repeat(128 * 1024) });
  const res = await buyerExport(request(paths[1]), context);
  expect(res.status).toBe(500);
  expect(await res.json()).toEqual({ code: "RESOURCE_COMMERCE_FAILED" });
});
