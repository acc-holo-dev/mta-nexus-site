import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ page: vi.fn(), read: vi.fn() }));
vi.mock("@nexus/db", () => ({
  serverObservationRepository: { pageObservations: state.page, readStatistics: state.read },
}));
import { serverStatisticsService } from "../apps/web/src/lib/services/server-statistics-service";
import { parseServerStatisticsQuery } from "../apps/web/src/lib/server-statistics-contract";
import {
  parseServerObservationBrowserQuery,
  serverObservationBrowserHref,
} from "../apps/web/src/lib/server-observation-browser-contract";
import { serverObservationBrowserCsv } from "../apps/web/src/lib/server-statistics-export";
import {
  serverObservationBrowserCopy,
  serverObservationBrowserError,
} from "../apps/web/src/lib/server-observation-browser-copy";
const end = "2026-10-11T00:00:00.000Z",
  exact = "2026-10-10T23:59:00.123456Z",
  context = "a".repeat(64);
beforeEach(() => {
  vi.clearAllMocks();
  state.page.mockResolvedValue({
    server: {
      id: "server",
      name: "Server",
      slug: "server",
      visibility: "public",
      status: "active",
      endpointRevision: 0,
    },
    context,
    windowStart: new Date("2026-10-10T00:00:00Z"),
    windowEnd: new Date(end),
    observations: [
      {
        id: "obs",
        observedAt: exact,
        currentPlayers: 0,
        maxPlayers: null,
        gameMode: '=HYPERLINK("remote")',
        mapName: "map\nnext",
        mtaVersion: null,
        passworded: false,
        responding: null,
      },
    ],
    nextCursor: { createdAt: exact, id: "obs" },
    previousCursor: null,
  });
});
it.each(["2026-10-10T12:34", "2026-10-10T12:34:56", "2026-10-10T12:34:56.123"])(
  "normalizes a native UTC period form without applying the host timezone: %s",
  (endUtc) => {
    const parsed = parseServerStatisticsQuery(new URLSearchParams({ window: "7d", endUtc }));
    expect(parsed?.end).toMatch(/^2026-10-10T12:34:\d{2}\.\d{3}Z$/u);
    expect(parsed).not.toHaveProperty("endUtc");
  },
);
it.each([
  "?endUtc=2026-02-30T12:00",
  "?endUtc=2026-10-10T25:00",
  "?endUtc=2026-10-10T12:00Z",
  "?endUtc=2026-10-10T12:00&end=2026-10-10T00:00:00.000Z",
  "?q=a&q=b",
  "?page=2",
  "?before=obs",
  "?format=observations",
  "?ownerId=other",
  "?q=%00",
  "?players=offline",
  "?password=maybe",
  "?responding=false",
])("rejects malformed/injected browser query %s", (value) =>
  expect(parseServerObservationBrowserQuery(new URLSearchParams(value))).toBeNull(),
);
it("binds cursor parsing to a fixed end, exact UTC precision, singleton fields and an explicit direction", () => {
  const cursor = JSON.stringify({
    id: "obs",
    createdAt: exact,
    context,
    direction: "older",
    version: 1,
  });
  expect(parseServerObservationBrowserQuery(new URLSearchParams({ cursor }))).toBeNull();
  expect(
    parseServerObservationBrowserQuery(new URLSearchParams({ end, cursor }))?.cursor?.createdAt,
  ).toBe(exact);
  for (const extra of [
    { direction: "sideways" },
    { context: "bad" },
    { createdAt: "2026-10-10T23:59:00.123Z" },
    { actorId: "foreign" },
  ])
    expect(
      parseServerObservationBrowserQuery(
        new URLSearchParams({
          end,
          cursor: JSON.stringify({
            id: "obs",
            createdAt: exact,
            context,
            direction: "older",
            version: 1,
            ...extra,
          }),
        }),
      ),
    ).toBeNull();
});
it("preserves period/search/unknown/zero filters in pagination and export links", async () => {
  const input = parseServerObservationBrowserQuery(
    new URLSearchParams({
      end,
      q: "+Lua&_",
      players: "zero",
      password: "unknown",
      responding: "no",
    }),
  );
  if (!input) throw Error("Expected query");
  const report = await serverStatisticsService.observations(
    { id: "server" },
    { kind: "managed", actorId: "manager" },
    input,
  );
  if (!report) throw Error("Expected report");
  expect(state.read).not.toHaveBeenCalled();
  expect(state.page).toHaveBeenCalledWith(
    { id: "server" },
    { kind: "managed", actorId: "manager" },
    24,
    expect.objectContaining({
      end: new Date(end),
      query: "+Lua&_",
      players: "zero",
      password: "unknown",
      responding: "no",
    }),
  );
  const link = serverObservationBrowserHref(
    "/observations",
    { ...input, end: report.windowEnd },
    report.nextCursor,
  );
  const parsed = parseServerObservationBrowserQuery(
    new URL(link, "https://nexus.test").searchParams,
  );
  expect(parsed).toMatchObject({
    query: "+Lua&_",
    players: "zero",
    password: "unknown",
    responding: "no",
    cursor: { createdAt: exact, context, direction: "older" },
  });
  expect(report.observations[0].currentPlayers).toBe(0);
  expect(report.observations[0].observedAt).toBe(exact);
  expect(report.absenceMeansOffline).toBe(false);
});
it("exports only the bounded filtered page, escaping formulas and preserving false, zero and blanks", async () => {
  const input = parseServerObservationBrowserQuery(new URLSearchParams({ end }));
  if (!input) throw Error("Expected query");
  const report = await serverStatisticsService.observations(
    { id: "server" },
    { kind: "public" },
    input,
  );
  if (!report) throw Error("Expected report");
  const csv = serverObservationBrowserCsv(report);
  expect(csv).toContain('"0",,"\'=HYPERLINK(""remote"")"');
  expect(csv).toContain('"map\nnext",,"false",');
  report.observations = Array.from({ length: 40 }, () => ({
    ...report.observations[0],
    mapName: "map",
  }));
  expect(serverObservationBrowserCsv(report).split("\r\n")).toHaveLength(27);
});
it("does not manufacture a report for a revoked listing and marks private/inactive collection as paused", async () => {
  const input = parseServerObservationBrowserQuery(new URLSearchParams({ end }));
  if (!input) throw Error("Expected query");
  const raw = await state.page();
  raw.server.visibility = "private";
  state.page.mockResolvedValueOnce(raw);
  expect(
    (
      await serverStatisticsService.observations(
        { id: "server" },
        { kind: "managed", actorId: "owner" },
        input,
      )
    )?.collectionEligible,
  ).toBe(false);
  state.page.mockResolvedValueOnce(null);
  expect(
    await serverStatisticsService.observations({ id: "server" }, { kind: "public" }, input),
  ).toBeNull();
});
it("keeps RU/EN copy complete and maps private cursor and infrastructure errors safely", () => {
  expect(Object.keys(serverObservationBrowserCopy("ru"))).toEqual(
    Object.keys(serverObservationBrowserCopy("en")),
  );
  expect(serverObservationBrowserError("ru", "INVALID_CURSOR")).toBe(
    serverObservationBrowserCopy("ru").invalid,
  );
  expect(serverObservationBrowserError("en", "INTERNAL_ERROR")).toBe(
    serverObservationBrowserCopy("en").unavailable,
  );
});
