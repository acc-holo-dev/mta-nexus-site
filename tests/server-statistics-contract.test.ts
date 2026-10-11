import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ readStatistics: vi.fn() }));
vi.mock("@nexus/db", () => ({
  serverObservationRepository: { readStatistics: state.readStatistics },
}));
import {
  serverStatisticsService,
  type ServerStatisticsResult,
} from "../apps/web/src/lib/services/server-statistics-service";
import {
  parseServerStatisticsQuery,
  serverStatisticsHref,
} from "../apps/web/src/lib/server-statistics-contract";
import {
  serverStatisticsCsv,
  serverStatisticsIntervals,
} from "../apps/web/src/lib/server-statistics-export";
import {
  serverStatisticsCopy,
  serverStatisticsError,
} from "../apps/web/src/lib/server-statistics-copy";
const summary = {
  observationCount: 100,
  knownPlayerCount: 90,
  observedFrom: new Date("2026-10-10T01:00:00Z"),
  observedTo: new Date("2026-10-10T23:59:00Z"),
  peakPlayers: 20,
  averagePlayers: 10,
};
beforeEach(() => {
  state.readStatistics.mockReset().mockResolvedValue({
    server: {
      id: "server",
      name: "Server",
      slug: "server",
      status: "active",
      visibility: "public",
      endpointRevision: 0,
    },
    windowStart: new Date("2026-10-10T00:00:00Z"),
    windowEnd: new Date("2026-10-11T00:00:00Z"),
    previousStart: new Date("2026-10-09T00:00:00Z"),
    summary: { ...summary },
    previousSummary: { ...summary, averagePlayers: 5 },
    bucketSeconds: 3600,
    buckets: [{ ...summary, bucketAt: new Date("2026-10-10T01:00:00Z"), maxPlayers: 64 }],
    observations: [
      {
        id: "obs_1",
        observedAt: new Date("2026-10-10T01:00:00Z"),
        currentPlayers: 0,
        maxPlayers: 64,
        gameMode: '=HYPERLINK("evil")',
        mapName: "map\nnext",
        mtaVersion: "1.6",
        passworded: false,
        responding: null,
      },
    ],
    nextCursor: null,
  });
});
it.each([
  "?window=bad",
  "?window=24h&window=7d",
  "?page=2",
  "?end=invalid",
  "?end=2026-10-11T00:00:00Z",
  "?before=obs_1",
  "?before=evil%2Fid&end=2026-10-11T00:00:00.000Z",
  "?format=buckets",
])("rejects malformed or ambiguous statistics query %s", (query) => {
  expect(parseServerStatisticsQuery(new URLSearchParams(query))).toBeNull();
});
it("round trips fixed window boundaries and anchors, allowing export kinds only on downloads", () => {
  const link = serverStatisticsHref("/statistics", {
    window: "7d",
    end: "2026-10-11T00:00:00.000Z",
    before: "obs_anchor",
    format: "observations",
  });
  const params = new URL(link, "https://nexus.test").searchParams;
  expect(parseServerStatisticsQuery(params, true)).toEqual({
    window: "7d",
    end: "2026-10-11T00:00:00.000Z",
    before: "obs_anchor",
    format: "observations",
  });
  expect(parseServerStatisticsQuery(params)).toBeNull();
});
it("derives comparisons from full aggregates and preserves zero-player samples", async () => {
  const report = await serverStatisticsService.read(
    { id: "server" },
    { kind: "public" },
    { window: "24h" },
  );
  expect(state.readStatistics).toHaveBeenCalledExactlyOnceWith(
    { id: "server" },
    { kind: "public" },
    24,
    {},
  );
  expect(report).toMatchObject({
    averagePlayerChange: 5,
    averagePlayerPercentChange: 100,
    summary: { knownPlayerPercent: 90 },
    absenceMeansOffline: false,
    observations: [{ currentPlayers: 0, responding: null }],
  });
});
it("keeps empty and zero-baseline percentage comparisons undefined", async () => {
  const raw = await state.readStatistics();
  raw.previousSummary.averagePlayers = 0;
  raw.summary.observationCount = 0;
  raw.summary.averagePlayers = null;
  raw.summary.peakPlayers = null;
  state.readStatistics.mockResolvedValue(raw);
  expect(
    await serverStatisticsService.read({ id: "server" }, { kind: "public" }, { window: "24h" }),
  ).toMatchObject({
    averagePlayerChange: null,
    averagePlayerPercentChange: null,
    summary: { knownPlayerPercent: null },
  });
});
it("bounds remote text in the service and marks excluded listings without fabricating fresh telemetry", async () => {
  const raw = await state.readStatistics();
  raw.server.visibility = "private";
  raw.observations[0].gameMode = "a".repeat(1000);
  raw.observations[0].mtaVersion = "b".repeat(1000);
  state.readStatistics.mockResolvedValue(raw);
  const report = await serverStatisticsService.read(
    { id: "server" },
    { kind: "managed", actorId: "owner" },
    { window: "30d" },
  );
  expect(report?.collectionEligible).toBe(false);
  expect(report?.observations[0].gameMode?.length).toBe(240);
  expect(report?.observations[0].mtaVersion?.length).toBe(120);
});
it("does not manufacture a report for an unauthorized listing", async () => {
  state.readStatistics.mockResolvedValue(null);
  expect(
    await serverStatisticsService.read({ id: "private" }, { kind: "public" }, { window: "24h" }),
  ).toBeNull();
});
it("exports complete clipped UTC intervals and leaves missing player values blank", async () => {
  const report = await serverStatisticsService.read(
    { id: "server" },
    { kind: "public" },
    { window: "24h" },
  );
  expect(report).not.toBeNull();
  if (!report) throw new Error("Missing report");
  const intervals = serverStatisticsIntervals(report);
  expect(intervals).toHaveLength(24);
  expect(intervals[0]).toMatchObject({ observationCount: 0, peakPlayers: null });
  const csv = serverStatisticsCsv(report, "buckets");
  expect(csv.split("\r\n")).toHaveLength(26);
  expect(csv).toContain('"2026-10-10T00:00:00.000Z","2026-10-10T01:00:00.000Z","0","0",,,');
  expect(csv).not.toContain("=HYPERLINK");
  const offset: ServerStatisticsResult = {
    ...report,
    windowStart: "2026-10-10T00:30:00.000Z",
    windowEnd: "2026-10-11T00:30:00.000Z",
  };
  expect(serverStatisticsIntervals(offset)).toHaveLength(25);
  expect(serverStatisticsIntervals(offset)[0].intervalStart).toBe(offset.windowStart);
  expect(serverStatisticsIntervals(offset).at(-1)?.intervalEnd).toBe(offset.windowEnd);
});
it("quotes CSV newlines and formulas, preserves zero and false, and exports at most one displayed page", async () => {
  const report = await serverStatisticsService.read(
    { id: "server" },
    { kind: "public" },
    { window: "24h" },
  );
  if (!report) throw new Error("Missing report");
  const csv = serverStatisticsCsv(report, "observations");
  expect(csv).toContain('"0","64","\'=HYPERLINK(""evil"")"');
  expect(csv).toContain('"map\nnext"');
  expect(csv).toContain('"false",');
  report.observations = Array.from({ length: 40 }, () => ({
    ...report.observations[0],
    mapName: "map",
  }));
  expect(serverStatisticsCsv(report, "observations").split("\r\n")).toHaveLength(27);
});
it.each(["ru", "en"] as const)(
  "covers localized actions, metadata and safe errors in %s",
  (locale) => {
    expect(
      Object.values(serverStatisticsCopy(locale)).every(
        (value) => typeof value === "string" && value.length > 0,
      ),
    ).toBe(true);
    expect(serverStatisticsError(locale, "SERVER_OBSERVATION_PAGE_EXPIRED")).toBe(
      serverStatisticsCopy(locale).expired,
    );
    expect(serverStatisticsError(locale, "private SQL error")).toBe(
      serverStatisticsCopy(locale).unavailable,
    );
  },
);

it.each(["=formula", "+formula", "-formula", "@formula", "\t=formula", "\u0000=formula"])(
  "neutralizes untrusted CSV formula %s",
  async (text) => {
    const report = await serverStatisticsService.read(
      { id: "server" },
      { kind: "public" },
      { window: "24h" },
    );
    if (!report) throw new Error("Missing report");
    report.observations[0].mapName = text;
    expect(serverStatisticsCsv(report, "observations")).toContain(`"'${text}"`);
  },
);
