import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  actor: { id: "usr_a", role: "user" } as { id: string; role: string } | null,
  rate: vi.fn(),
  compare: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => h.actor },
}));
vi.mock("@nexus/security", () => ({ consumeRateLimit: h.rate }));
vi.mock("../apps/web/src/lib/services/resource-release-control-service", () => ({
  libraryReleaseService: { compare: h.compare },
}));
import { GET } from "../apps/web/src/app/api/library/releases/[id]/compare/route";
import { GET as download } from "../apps/web/src/app/api/library/releases/[id]/compare/export/route";
const context = { params: Promise.resolve({ id: "prd_a" }) },
  request = (suffix = "?from=bld_a&to=bld_b&returnPage=2") =>
    new NextRequest(`https://nexus.test/api/library/releases/prd_a/compare${suffix}`);
beforeEach(() => {
  vi.clearAllMocks();
  h.actor = { id: "usr_a", role: "user" };
  h.rate.mockResolvedValue({ success: true });
  h.compare.mockResolvedValue({ from: { id: "bld_a" }, to: { id: "bld_b" } });
});
it("binds private inspection to the actor, resource and exact pair", async () => {
  const response = await GET(request(), context);
  expect(response.status).toBe(200);
  expect(h.compare).toHaveBeenCalledWith(h.actor, "prd_a", {
    from: "bld_a",
    to: "bld_b",
    returnPage: 2,
  });
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(response.headers.get("vary")).toContain("Cookie");
  const file = await download(request(), context);
  expect(file.headers.get("content-disposition")).toContain("attachment");
  expect(file.headers.get("x-content-type-options")).toBe("nosniff");
});
it("rejects injection, duplicate fields, missing auth and over-rate inspections before comparing", async () => {
  for (const suffix of [
    "?from=bld_a&to=bld_a",
    "?from=bld_a&to=bld_b&userId=other",
    "?from=bld_a&from=bld_c&to=bld_b",
  ])
    expect((await GET(request(suffix), context)).status).toBe(400);
  expect(h.compare).not.toHaveBeenCalled();
  h.actor = null;
  expect((await download(request(), context)).status).toBe(401);
  h.actor = { id: "usr_a", role: "user" };
  h.rate.mockResolvedValue({ success: false });
  expect((await GET(request(), context)).status).toBe(429);
  expect(h.compare).not.toHaveBeenCalled();
});
it("bounds attachment size", async () => {
  h.compare.mockResolvedValue({ notes: "x".repeat(512 * 1024) });
  expect((await download(request(), context)).status).toBe(413);
});
