import { ForbiddenError } from "@nexus/domain";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "./browser-mutation-headers";

const state = vi.hoisted(() => ({
  actor: { id: "usr_admin" } as { id: string } | null,
  rate: vi.fn(),
  list: vi.fn(),
  namespaces: vi.fn(),
  discover: vi.fn(),
  detail: vi.fn(),
  cleanup: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.actor },
}));
vi.mock("@nexus/security", () => ({ consumeRateLimit: state.rate }));
vi.mock("../apps/web/src/lib/services/storage-maintenance-service", () => ({
  storageMaintenanceService: state,
}));

import { POST as discover } from "../apps/web/src/app/api/admin/storage/discovery/route";
import { GET as namespaces } from "../apps/web/src/app/api/admin/storage/namespaces/route";
import { POST as cleanup } from "../apps/web/src/app/api/admin/storage/objects/[id]/cleanup/route";
import { GET as list } from "../apps/web/src/app/api/admin/storage/route";

const context = { params: Promise.resolve({ id: "smo_a" }) };
function request(path: string, body?: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`http://nexus.test/api/admin/storage${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(body === undefined ? {} : browserMutationHeaders()),
      "content-type": "application/json",
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
beforeEach(() => {
  stubBrowserMutationOrigin();
  vi.clearAllMocks();
  state.actor = { id: "usr_admin" };
  state.rate.mockResolvedValue({ success: true });
  state.list.mockResolvedValue({ items: [] });
  state.namespaces.mockResolvedValue({ owners: [] });
  state.discover.mockResolvedValue({ observed: 1 });
  state.cleanup.mockResolvedValue({ state: "deleted" });
});
afterEach(() => {
  vi.unstubAllEnvs();
});
it("rejects signed-out discovery and inventory before touching the service", async () => {
  state.actor = null;
  expect((await list(request(""))).status).toBe(401);
  expect((await discover(request("/discovery", { ownerId: "usr_a", offset: 0 }))).status).toBe(401);
  expect(state.list).not.toHaveBeenCalled();
  expect(state.discover).not.toHaveBeenCalled();
});
it("keeps inventory private, uncached and read-only", async () => {
  const response = await list(request("?view=eligible&page=2"));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(state.list).toHaveBeenCalledWith("usr_admin", 2, "eligible");
  expect(state.discover).not.toHaveBeenCalled();
  expect(state.cleanup).not.toHaveBeenCalled();
  expect(state.rate).toHaveBeenCalledWith("resourceInspection", "usr_admin");
});
it("maps live permission refusals without exposing inventory", async () => {
  state.list.mockRejectedValue(new ForbiddenError());
  const response = await list(request(""));
  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({ code: "FORBIDDEN" });
});
it("requires strict metadata and explicit per-object confirmation", async () => {
  for (const body of [
    { expectedRevision: 1 },
    { expectedRevision: 1, confirmation: "delete_unreferenced", key: "forged" },
  ])
    expect((await cleanup(request("/objects/smo_a/cleanup", body), context)).status).toBe(400);
  expect(state.cleanup).not.toHaveBeenCalled();
});
it("passes the authenticated actor and expected revision to the cleanup service", async () => {
  expect(
    (
      await cleanup(
        request("/objects/smo_a/cleanup", {
          expectedRevision: 2,
          confirmation: "delete_unreferenced",
        }),
        context,
      )
    ).status,
  ).toBe(200);
  expect(state.cleanup).toHaveBeenCalledWith("usr_admin", "smo_a", 2);
  expect(state.rate).toHaveBeenCalledWith("moderationAction", "usr_admin");
});
it("blocks cross-site cleanup", async () => {
  expect(
    (
      await cleanup(
        request(
          "/objects/smo_a/cleanup",
          { expectedRevision: 1, confirmation: "delete_unreferenced" },
          { "sec-fetch-site": "cross-site" },
        ),
        context,
      )
    ).status,
  ).toBe(403);
  expect(state.cleanup).not.toHaveBeenCalled();
});
it("blocks cleanup on the mutation rate limit", async () => {
  state.rate.mockResolvedValue({ success: false });
  expect(
    (
      await cleanup(
        request("/objects/smo_a/cleanup", {
          expectedRevision: 1,
          confirmation: "delete_unreferenced",
        }),
        context,
      )
    ).status,
  ).toBe(429);
  expect(state.cleanup).not.toHaveBeenCalled();
});
it("rejects oversized JSON without invoking discovery", async () => {
  expect(
    (await discover(request("/discovery", { ownerId: "x".repeat(40000), offset: 0 }))).status,
  ).toBe(413);
  expect(state.discover).not.toHaveBeenCalled();
});
it("rejects duplicate namespace offsets", async () => {
  expect((await namespaces(request("/namespaces?offset=0&offset=1"))).status).toBe(400);
  expect(state.namespaces).not.toHaveBeenCalled();
});
