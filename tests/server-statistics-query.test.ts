import { beforeEach, afterEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  config: null as unknown,
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    return { rows: state.rows.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return async (callback: (tx: typeof database) => unknown, config: unknown) => {
            state.config = config;
            return callback(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
});
import { ServerObservationRepository } from "../packages/db/src/repositories/server-observations";
const repository = new ServerObservationRepository();
const end = new Date("2026-10-11T00:00:00.000Z");
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(end);
  state.queries = [];
  state.config = null;
  state.rows = [
    [["server", "Server", "server", "public", "active", 0]],
    [
      ["current", "8000", "7900", "2026-10-10T01:00:00Z", "2026-10-10T23:59:00Z", "100", "32.5"],
      ["previous", "20", "19", "2026-10-09T01:00:00Z", "2026-10-09T23:59:00Z", "30", "12.5"],
    ],
    [
      [
        "2026-10-10T23:00:00Z",
        "1",
        "1",
        "2026-10-10T23:59:00Z",
        "2026-10-10T23:59:00Z",
        "2",
        "2",
        "64",
      ],
    ],
    [["obs_1", "2026-10-10T23:59:00Z", 2, 64, "mode", "map", "1.6", false, true]],
  ];
});
afterEach(() => vi.useRealTimers());
it("reads both complete disjoint periods, chart and bounded samples in one authority snapshot", async () => {
  const report = await repository.readStatistics({ id: "server" }, { kind: "public" }, 24);
  expect(state.config).toEqual({ isolationLevel: "repeatable read", accessMode: "read only" });
  expect(state.queries).toHaveLength(4);
  expect(report).toMatchObject({
    summary: {
      observationCount: 8000,
      knownPlayerCount: 7900,
      averagePlayers: 32.5,
      peakPlayers: 100,
    },
    previousSummary: { observationCount: 20, averagePlayers: 12.5 },
    nextCursor: null,
  });
  expect(report?.observations).toHaveLength(1);
  expect(state.queries[0].params).toEqual(["server", "public", "unlisted", 1]);
  expect(state.queries[1].params).toContain("2026-10-10T00:00:00.000Z");
  expect(state.queries[1].params).toContain("2026-10-09T00:00:00.000Z");
  expect(state.queries[1].sql).toContain('group by "period"');
  expect(state.queries[1].sql).not.toContain("limit");
  expect(state.queries[2].sql).toContain('group by "bucket_at"');
  expect(state.queries[3].params.at(-1)).toBe(26);
  for (const query of state.queries.slice(1)) {
    expect(query.params).toContain("mta_master");
    expect(query.params).toContain(end.toISOString());
    expect(query.sql).toContain('"observed_at" <');
    expect(query.sql).not.toContain("offset");
  }
  expect(state.queries[3].sql).not.toContain("source_sequence");
  expect(state.queries[3].sql).not.toContain('"name"');
});
it("rechecks personal, organization grants and actual administrator role without trusting a caller role", async () => {
  await repository.readStatistics(
    { slug: "quoted_'" },
    { kind: "managed", actorId: "manager" },
    24,
  );
  const query = state.queries[0];
  expect(query.params).toContain("quoted_'");
  expect(query.sql).not.toContain("quoted_'");
  expect(query.sql).toContain('"users"."role"');
  expect(query.params).toContain("admin");
  expect(query.sql).toContain('"organization_members"."permissions" @>');
  expect(query.params).toContain('["manage_servers"]');
  expect(query.params).toContain("manager");
  expect(query.sql).toContain('"servers"."organization_id" is null');
});
it("does not read observations for a hidden, missing or unauthorized listing", async () => {
  state.rows = [[]];
  expect(
    await repository.readStatistics({ id: "server" }, { kind: "managed", actorId: "revoked" }, 168),
  ).toBeNull();
  expect(state.queries).toHaveLength(1);
});
it("keeps absent aggregates unknown and zero observations distinct from zero players", async () => {
  state.rows[1] = [];
  state.rows[2] = [];
  state.rows[3] = [];
  const report = await repository.readStatistics({ id: "server" }, { kind: "public" }, 720);
  expect(report?.summary).toEqual({
    observationCount: 0,
    knownPlayerCount: 0,
    observedFrom: null,
    observedTo: null,
    peakPlayers: null,
    averagePlayers: null,
  });
  expect(report?.previousSummary).toEqual(report?.summary);
});
it("resolves a case-scoped anchor at PostgreSQL microsecond precision and returns a sentinel cursor", async () => {
  state.rows.splice(3, 0, [["obs_anchor", "2026-10-10T23:59:00.000001Z"]]);
  state.rows[4] = Array.from({ length: 26 }, (_, i) => [
    `obs_${i}`,
    "2026-10-10T23:58:00Z",
    i,
    64,
    null,
    null,
    null,
    null,
    null,
  ]);
  const report = await repository.readStatistics({ id: "server" }, { kind: "public" }, 24, {
    end,
    before: "obs_anchor",
  });
  expect(report?.observations).toHaveLength(25);
  expect(report?.nextCursor).toBe("obs_24");
  expect(state.queries[3].sql).toContain("SS.US");
  expect(state.queries[3].params).toContain("server");
  expect(state.queries[4].params).toContain("2026-10-10T23:59:00.000001Z");
  expect(state.queries[4].sql).toContain(
    '("server_observations"."observed_at", "server_observations"."id") <',
  );
});
it("rejects foreign, out-of-period or removed anchors instead of returning a misleading empty page", async () => {
  state.rows.splice(3, 0, []);
  await expect(
    repository.readStatistics({ id: "server" }, { kind: "public" }, 24, {
      end,
      before: "obs_foreign",
    }),
  ).rejects.toMatchObject({ code: "SERVER_OBSERVATION_PAGE_EXPIRED", statusCode: 404 });
  expect(state.queries).toHaveLength(4);
});
it.each([new Date(NaN), new Date(end.getTime() + 1), new Date(end.getTime() - 91 * 86_400_000)])(
  "rejects unbounded period ends before any query",
  async (date) => {
    await expect(
      repository.readStatistics({ id: "server" }, { kind: "public" }, 24, { end: date }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(state.queries).toEqual([]);
  },
);
it.each([
  [24, 3600],
  [168, 21600],
  [720, 86400],
] as const)("bounds interval grouping for %s hours", async (hours, width) => {
  const report = await repository.readStatistics({ id: "server" }, { kind: "public" }, hours);
  if (!report) throw new Error("Missing statistics");
  expect(report?.bucketSeconds).toBe(width);
  expect(report.windowEnd.getTime() - report.windowStart.getTime()).toBe(hours * 3_600_000);
});
