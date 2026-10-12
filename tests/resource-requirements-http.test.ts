import { NotFoundError } from "@nexus/domain";
import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  actor: { id: "usr_a" } as { id: string } | null,
  report: vi.fn(),
  rate: vi.fn(),
}));
vi.mock("@nexus/security", () => ({ consumeRateLimit: state.rate }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.actor },
}));
vi.mock("../apps/web/src/lib/services/resource-requirements-service", () => ({
  resourceRequirementsService: { report: state.report },
}));

import { GET as moderator } from "../apps/web/src/app/api/admin/resources/[id]/requirements/route";
import { GET as download } from "../apps/web/src/app/api/library/[id]/requirements/export/route";
import { GET as read } from "../apps/web/src/app/api/library/[id]/requirements/route";
import { GET as publisher } from "../apps/web/src/app/api/products/[id]/requirements/route";

const context = { params: Promise.resolve({ id: "prd_a" }) };
function request(query = "") {
  return new NextRequest(`http://nexus.test/api/library/prd_a/requirements${query}`);
}
beforeEach(() => {
  vi.clearAllMocks();
  state.actor = { id: "usr_a" };
  state.rate.mockResolvedValue({ success: true });
  state.report.mockResolvedValue({ schemaVersion: 1, nodes: [], state: "review" });
});
it("refuses unauthenticated reports and exports", async () => {
  state.actor = null;
  expect((await read(request(), context)).status).toBe(401);
  expect((await download(request(), context)).status).toBe(401);
  expect(state.report).not.toHaveBeenCalled();
});
it("makes reports private, uncached and rate limited", async () => {
  const response = await read(request("?targetMta=1.6.0"), context);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(state.rate).toHaveBeenCalledWith("resourceInspection", "usr_a");
  expect(state.report).toHaveBeenCalledWith("usr_a", "prd_a", "library", { targetMta: "1.6.0" });
});
it.each(["?buildId=bld_a", "?targetMta=1.6.0&targetMta=1.5.0", "?targetMta=invalid", "?secret=1"])(
  "rejects invalid library report query %s",
  async (query) => {
    expect((await read(request(query), context)).status).toBe(400);
    expect(state.report).not.toHaveBeenCalled();
  },
);
it("binds publisher/staff scope to the route rather than client fields", async () => {
  await publisher(request("?buildId=bld_a"), context);
  expect(state.report).toHaveBeenLastCalledWith("usr_a", "prd_a", "publisher", {
    buildId: "bld_a",
  });
  await moderator(request(), context);
  expect(state.report).toHaveBeenLastCalledWith("usr_a", "prd_a", "moderator", {});
});
it("hides private or inaccessible roots", async () => {
  state.report.mockRejectedValue(new NotFoundError("Resource"));
  const response = await read(request(), context);
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ code: "NOT_FOUND" });
});
it("exports the same authorized report without storage URLs or browser caching", async () => {
  const response = await download(request(), context);
  expect(response.status).toBe(200);
  expect(response.headers.get("content-disposition")).toBe(
    "attachment; filename=resource-requirements.json",
  );
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(await response.json()).toMatchObject({ schemaVersion: 1 });
});
it("bounds report exports", async () => {
  state.report.mockResolvedValue({ nodes: [{ title: "x".repeat(524289) }] });
  expect((await download(request(), context)).status).toBe(413);
});

it("previews and exports an exact build with session-bound access and navigation context", async () => {
  const query = "?previewBuildId=bld_b&returnFrom=bld_a&returnPage=2&targetMta=1.6.0";
  for (const route of [read, download]) {
    const response = await route(request(query), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(state.report).toHaveBeenLastCalledWith("usr_a", "prd_a", "library", {
      previewBuildId: "bld_b",
      returnFrom: "bld_a",
      returnPage: 2,
      targetMta: "1.6.0",
    });
  }
});
it.each([
  "?previewBuildId=../private",
  "?previewBuildId=bld_b&previewBuildId=bld_a",
  "?returnFrom=bld_a",
  "?returnPage=2",
  "?previewBuildId=bld_a&returnFrom=bld_a",
  "?previewBuildId=bld_b&returnPage=01",
  "?previewBuildId=bld_b&returnPage=1001",
  "?previewBuildId=bld_b&buildId=bld_a",
])("rejects malformed preview navigation %s", async (query) => {
  expect((await read(request(query), context)).status).toBe(400);
  expect(state.report).not.toHaveBeenCalled();
});
it.each([publisher, moderator])(
  "does not let buyer preview parameters enter a privileged scope",
  async (route) => {
    expect((await route(request("?previewBuildId=bld_b"), context)).status).toBe(400);
    expect(state.report).not.toHaveBeenCalled();
  },
);
it("rate limits preview inspection before loading evidence", async () => {
  state.rate.mockResolvedValue({ success: false });
  const response = await read(request("?previewBuildId=bld_b"), context);
  expect(response.status).toBe(429);
  expect(state.report).not.toHaveBeenCalled();
});
