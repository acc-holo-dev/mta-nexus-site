import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
import { observationBrowserFixture } from "./helpers/server-observation-browser-fixture";
const state = vi.hoisted(() => ({ read: vi.fn(), session: vi.fn(), rate: vi.fn() }));
vi.mock("../apps/web/src/lib/services/server-statistics-service", () => ({
  serverStatisticsService: { observations: state.read },
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: state.session },
}));
vi.mock("@nexus/security", () => ({ consumeRateLimit: state.rate }));
import { GET as publicGet } from "../apps/web/src/app/api/servers/[id]/observations/route";
import { GET as privateGet } from "../apps/web/src/app/api/workspace/servers/[id]/observations/route";
import { GET as publicExport } from "../apps/web/src/app/api/servers/[id]/observations/export/route";
import { GET as privateExport } from "../apps/web/src/app/api/workspace/servers/[id]/observations/export/route";
const request = (query = "", cookie = "") =>
  new NextRequest(`https://nexus.test/api/servers/server/observations${query}`, {
    headers: { cookie },
  });
const params = { params: Promise.resolve({ id: "server" }) };
beforeEach(() => {
  vi.clearAllMocks();
  state.read.mockResolvedValue(observationBrowserFixture());
  state.session.mockResolvedValue({ id: "owner", role: "admin" });
  state.rate.mockResolvedValue({ success: true });
});
it("keeps public scope independent of a privileged session and emits no-store telemetry", async () => {
  const response = await publicGet(
    request("?players=zero&responding=unknown", "nexus_session=admin"),
    params,
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(state.session).not.toHaveBeenCalled();
  expect(state.read).toHaveBeenCalledWith(
    { id: "server" },
    { kind: "public" },
    expect.objectContaining({ players: "zero", responding: "unknown" }),
  );
  expect((await response.json()).absenceMeansOffline).toBe(false);
});
it("binds managed reads to the actual session actor, with shared filters and rate limits", async () => {
  await privateGet(
    request("?endUtc=2026-10-10T12:34&window=7d&q=Lua&password=no", "nexus_session=token"),
    params,
  );
  expect(state.read).toHaveBeenCalledWith(
    { id: "server" },
    { kind: "managed", actorId: "owner" },
    expect.objectContaining({
      end: "2026-10-10T12:34:00.000Z",
      window: "7d",
      query: "Lua",
      password: "no",
    }),
  );
  expect(state.rate).toHaveBeenCalledExactlyOnceWith("search", "server-observations:owner");
});
it.each([privateGet, privateExport])(
  "requires authentication before any private read/export",
  async (get) => {
    state.session.mockResolvedValue(null);
    const response = await get(request("", "nexus_locale=ru"), params);
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("UNAUTHORIZED");
    expect(state.read).not.toHaveBeenCalled();
  },
);
it.each([publicGet, publicExport, privateGet, privateExport])(
  "masks inaccessible or revoked targets with the same 404",
  async (get) => {
    state.read.mockResolvedValue(null);
    const response = await get(request(), params);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ code: "NOT_FOUND", error: "Server not found" });
  },
);
it.each([
  "?q=a&q=b",
  "?window=7d&window=24h",
  "?actorId=other",
  "?players=offline",
  "?format=all",
  "?cursor=bad",
  "?endUtc=2026-02-30T12:00",
])("rejects ambiguous/injected filters %s before storage", async (query) => {
  expect((await publicGet(request(query), params)).status).toBe(400);
  expect(state.read).not.toHaveBeenCalled();
});
it("rechecks fixed period/cursors and neutralizes remote formulas in both export modes", async () => {
  const fixture = observationBrowserFixture();
  fixture.observations[0].gameMode = "=REMOTE()";
  state.read.mockResolvedValue(fixture);
  const query = new URLSearchParams({
    end: fixture.windowEnd,
    q: "Lua",
    players: "known",
    cursor: fixture.nextCursor ?? "",
  });
  for (const get of [publicExport, privateExport]) {
    const response = await get(request(`?${query}`), params);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="mta-server-observations-24h.csv"',
    );
    expect(await response.text()).toContain('"\'=REMOTE()"');
  }
  expect(
    state.read.mock.calls.every(
      ([, , query]) =>
        query.end === fixture.windowEnd && query.cursor.createdAt.endsWith("123456Z"),
    ),
  ).toBe(true);
});
it("rate limits before queries and localizes failures without leaking internal reasons", async () => {
  state.rate.mockResolvedValueOnce({ success: false });
  const limited = await publicGet(request(), params);
  expect(limited.status).toBe(429);
  expect(limited.headers.get("retry-after")).toBe("30");
  expect(state.read).not.toHaveBeenCalled();
  state.read.mockRejectedValueOnce(new AppError("PRIVATE_SQL", 400, "INVALID_CURSOR"));
  const invalid = await publicGet(request("", "nexus_locale=ru"), params);
  expect(invalid.status).toBe(400);
  expect(await invalid.text()).toContain("Некорректные фильтры");
  state.read.mockRejectedValueOnce(new Error("PRIVATE_SQL"));
  const failed = await publicGet(request(), params);
  expect(failed.status).toBe(503);
  expect(failed.headers.get("retry-after")).toBe("30");
  expect(await failed.text()).not.toContain("PRIVATE_SQL");
});
