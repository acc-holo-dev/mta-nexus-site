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
  resourceRequirementsService: { collectionReport: state.report },
}));

import { GET as download } from "../apps/web/src/app/api/library/collections/[id]/requirements/export/route";
import { GET as read } from "../apps/web/src/app/api/library/collections/[id]/requirements/route";

const context = { params: Promise.resolve({ id: "lcol_a" }) };
function request(query = "") {
  return new NextRequest(`http://nexus.test/api/library/collections/lcol_a/requirements${query}`);
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
  expect(state.report).toHaveBeenCalledWith("usr_a", "lcol_a", { targetMta: "1.6.0" });
});
it.each(["?buildId=bld_a", "?targetMta=1.6.0&targetMta=1.5.0", "?targetMta=invalid", "?secret=1"])(
  "rejects invalid library report query %s",
  async (query) => {
    expect((await read(request(query), context)).status).toBe(400);
    expect(state.report).not.toHaveBeenCalled();
  },
);
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
    "attachment; filename=collection-requirements.json",
  );
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(await response.json()).toMatchObject({ schemaVersion: 1 });
});
it("bounds report exports", async () => {
  state.report.mockResolvedValue({ nodes: [{ title: "x".repeat(524289) }] });
  expect((await download(request(), context)).status).toBe(413);
});

it("rejects rate-limited graph reads before querying the collection", async () => {
  state.rate.mockResolvedValue({ success: false });
  expect((await read(request(), context)).status).toBe(429);
  expect(state.report).not.toHaveBeenCalled();
});
