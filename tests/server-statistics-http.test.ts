import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
import { statisticsFixture } from "./helpers/server-statistics-fixture";
const state = vi.hoisted(() => ({ read: vi.fn(), session: vi.fn(), rate: vi.fn() }));
vi.mock("../apps/web/src/lib/services/server-statistics-service", () => ({
  serverStatisticsService: { read: state.read },
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: state.session },
}));
vi.mock("@nexus/security", () => ({ consumeRateLimit: state.rate }));
import { GET as publicGet } from "../apps/web/src/app/api/servers/[id]/statistics/route";
import { GET as managedGet } from "../apps/web/src/app/api/workspace/servers/[id]/statistics/route";
import { GET as publicExport } from "../apps/web/src/app/api/servers/[id]/statistics/export/route";
import { GET as managedExport } from "../apps/web/src/app/api/workspace/servers/[id]/statistics/export/route";
const params = { params: Promise.resolve({ id: "server" }) };
const request = (query = "", cookie = "") =>
  new NextRequest(`https://nexus.test/api/servers/server/statistics${query}`, {
    headers: { cookie },
  });
beforeEach(() => {
  state.read.mockReset().mockResolvedValue(statisticsFixture());
  state.session.mockReset().mockResolvedValue({ id: "owner", role: "admin" });
  state.rate.mockReset().mockResolvedValue({ success: true });
});
it("keeps public authority independent of an authenticated administrator cookie", async () => {
  const response = await publicGet(request("?window=7d", "nexus_session=admin"), params);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(state.session).not.toHaveBeenCalled();
  expect(state.read).toHaveBeenCalledExactlyOnceWith(
    { id: "server" },
    { kind: "public" },
    { window: "7d" },
  );
});
it("passes only the authenticated actor ID to a repository that rechecks current managed authority", async () => {
  await managedGet(request("", "nexus_session=token"), params);
  expect(state.read).toHaveBeenCalledExactlyOnceWith(
    { id: "server" },
    { kind: "managed", actorId: "owner" },
    { window: "24h" },
  );
  expect(state.rate).toHaveBeenCalledExactlyOnceWith("search", "server-statistics:owner");
});
it.each([managedGet, managedExport])(
  "requires a session before private statistics or exports",
  async (get) => {
    state.session.mockResolvedValue(null);
    const response = await get(request("", "nexus_locale=ru"), params);
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "UNAUTHORIZED" });
    expect(state.read).not.toHaveBeenCalled();
  },
);
it.each([publicGet, managedGet, publicExport, managedExport])(
  "hides revoked or private scope exactly like a missing listing",
  async (get) => {
    state.read.mockResolvedValue(null);
    const response = await get(request(), params);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ code: "NOT_FOUND", error: "Server not found" });
  },
);
it.each([
  "?window=365d",
  "?window=24h&window=7d",
  "?before=obs_1",
  "?page=999999",
  "?format=observations",
  "?end=bad",
])("rejects unsafe query %s before storage access", async (query) => {
  const response = await publicGet(request(query), params);
  expect(response.status).toBe(400);
  expect(state.read).not.toHaveBeenCalled();
});
it("rate limits before reading statistics and gives a retry hint", async () => {
  state.rate.mockResolvedValue({ success: false });
  const response = await managedGet(request(), params);
  expect(response.status).toBe(429);
  expect(response.headers.get("retry-after")).toBe("30");
  expect(state.read).not.toHaveBeenCalled();
});
it("returns expired anchors explicitly with RU errors and no database details", async () => {
  state.read.mockRejectedValue(new AppError("private SQL", 404, "SERVER_OBSERVATION_PAGE_EXPIRED"));
  const response = await publicGet(
    request("?end=2026-10-11T00:00:00.000Z&before=obs_1", "nexus_locale=ru"),
    params,
  );
  expect(response.status).toBe(404);
  const text = await response.text();
  expect(text).toContain("больше недоступна");
  expect(text).not.toContain("private SQL");
});
it("does not present an unknown failure as an empty successful window", async () => {
  state.read.mockRejectedValue(new Error("private SQL"));
  const response = await publicGet(request(), params);
  expect(response.status).toBe(503);
  expect(response.headers.get("retry-after")).toBe("30");
  expect(await response.text()).not.toContain("private SQL");
});
it.each([publicExport, managedExport])(
  "exports CSV through the same live scope with fixed, safe attachment metadata",
  async (get) => {
    const response = await get(
      request("?end=2026-10-11T00:00:00.000Z&format=observations"),
      params,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="mta-server-statistics-24h-observations.csv"',
    );
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    const text = await response.text();
    expect(text).toContain("observed_at_utc");
    expect(text).not.toContain("Server <private>");
  },
);
