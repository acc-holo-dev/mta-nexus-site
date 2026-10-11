import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";
import { AppError } from "@nexus/domain";
const state = vi.hoisted(() => ({
  actor: { id: "usr_a" } as { id: string } | null,
  rate: true,
  detail: vi.fn(),
  page: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.actor },
}));
vi.mock("@nexus/security", () => ({
  consumeRateLimit: vi.fn(async () => ({ success: state.rate })),
}));
vi.mock("../apps/web/src/lib/services/resource-build-workspace-service", () => ({
  resourceBuildWorkspaceService: { detail: state.detail },
}));
vi.mock("../apps/web/src/lib/services/build-package-service", () => ({
  buildPackageService: { page: state.page },
}));
import { GET as report } from "../apps/web/src/app/api/products/[id]/builds/[buildId]/package/route";
import { GET as staffReport } from "../apps/web/src/app/api/admin/resources/[id]/builds/[buildId]/package/route";
import { GET as files } from "../apps/web/src/app/api/products/[id]/builds/[buildId]/package/files/route";
import { GET as staffFiles } from "../apps/web/src/app/api/admin/resources/[id]/builds/[buildId]/package/files/route";
const context = { params: Promise.resolve({ id: "prd_a", buildId: "bld_a" }) };
const request = (suffix = "") =>
  new NextRequest(`http://nexus.test/api/products/prd_a/builds/bld_a/package${suffix}`);
beforeEach(() => {
  vi.clearAllMocks();
  state.actor = { id: "usr_a" };
  state.rate = true;
  state.detail.mockResolvedValue({
    build: {
      id: "bld_a",
      version: "2.0.0",
      packageEvidence: { private: "recorded files" },
      storageKey: "secret/storage.zip",
    },
  });
  state.page.mockResolvedValue({ files: [], total: 0 });
});
it("exports only recorded private evidence with cache, attachment and nosniff headers", async () => {
  const response = await report(request(), context);
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("Vary")).toBe("Cookie");
  expect(response.headers.get("Content-Disposition")).toContain("attachment");
  expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect(await response.json()).toEqual({
    buildId: "bld_a",
    version: "2.0.0",
    evidence: { private: "recorded files" },
  });
  expect(state.detail).toHaveBeenCalledWith("prd_a", "bld_a", state.actor, false);
});
it("does not synthesize a report for earlier versions", async () => {
  state.detail.mockResolvedValue({ build: { id: "bld_a", packageEvidence: null } });
  const response = await report(request(), context);
  expect(response.status).toBe(404);
  expect(await response.json()).toMatchObject({ code: "BUILD_PACKAGE_EVIDENCE_MISSING" });
});
it("rejects unauthenticated and throttled reports before reading private data", async () => {
  state.actor = null;
  expect((await report(request(), context)).status).toBe(401);
  state.actor = { id: "usr_a" };
  state.rate = false;
  expect((await report(request(), context)).status).toBe(429);
  expect((await files(request("/files"), context)).status).toBe(429);
  expect(state.detail).not.toHaveBeenCalled();
  expect(state.page).not.toHaveBeenCalled();
});
it("keeps current repository authority failures private", async () => {
  state.detail.mockRejectedValue(new AppError("Private resource", 404, "NOT_FOUND"));
  const response = await report(request(), context);
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ code: "NOT_FOUND" });
});
it("routes staff reads through live moderation authority", async () => {
  await staffReport(
    new NextRequest("http://nexus.test/api/admin/resources/prd_a/builds/bld_a/package"),
    context,
  );
  expect(state.detail).toHaveBeenCalledWith("prd_a", "bld_a", state.actor, true);
  await staffFiles(
    new NextRequest("http://nexus.test/api/admin/resources/prd_a/builds/bld_a/package/files"),
    context,
  );
  expect(state.page).toHaveBeenCalledWith(
    state.actor,
    "prd_a",
    "bld_a",
    { page: 1, filter: "all", baselineId: undefined },
    true,
  );
});
it("rejects duplicate, unknown, noncanonical and injected queries before file reads", async () => {
  for (const query of [
    "page=1&page=2",
    "filter=all&filter=changed",
    "baseline=../private",
    "page=0",
    "page=01",
    "filter=executed",
    "secret=true",
  ])
    expect((await files(request(`/files?${query}`), context)).status).toBe(400);
  expect(state.page).not.toHaveBeenCalled();
});
it("passes exact scoped comparison and bounded page filters", async () => {
  const response = await files(request("/files?baseline=bld_b&page=2&filter=changed"), context);
  expect(response.status).toBe(200);
  expect(state.page).toHaveBeenCalledWith(
    state.actor,
    "prd_a",
    "bld_a",
    { page: 2, filter: "changed", baselineId: "bld_b" },
    false,
  );
});
