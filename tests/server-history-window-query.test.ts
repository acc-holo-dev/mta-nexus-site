import { getTableColumns } from "drizzle-orm";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { serverObservations } from "../packages/db/src/schema";
const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  results: [] as unknown[][][],
  config: null as unknown,
  failure: null as Error | null,
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    if (state.failure) throw state.failure;
    return { rows: state.results.shift() ?? [] };
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
const now = new Date("2026-10-09T12:00:00Z");
const sample = {
  id: "recent",
  serverId: "server",
  source: "mta_master",
  observedAt: now.toISOString(),
  currentPlayers: 2,
  maxPlayers: 100,
  createdAt: now.toISOString(),
};
const row = Object.keys(getTableColumns(serverObservations)).map(
  (key) => sample[key as keyof typeof sample] ?? null,
);
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  state.queries = [];
  state.config = null;
  state.failure = null;
  state.results = [
    [["8000", "7900", "2026-09-10T00:00:00Z", now.toISOString(), "100", "32.5"]],
    [row],
    [["2026-09-10T00:00:00Z", "100", "90", "100", "32.5", "100"]],
  ];
});
afterEach(() => vi.useRealTimers());
it("reads exact full-window statistics and bounded samples in one configured snapshot", async () => {
  const result = await repository.readWindow("server", 720);
  expect(state.config).toEqual({ isolationLevel: "repeatable read", accessMode: "read only" });
  expect(state.queries).toHaveLength(3);
  expect(result.summary).toMatchObject({
    observationCount: 8000,
    knownPlayerCount: 7900,
    peakPlayers: 100,
    averagePlayers: 32.5,
  });
  expect(result.summary.observedFrom).toEqual(new Date("2026-09-10T00:00:00Z"));
  expect(result.observations[0]).toMatchObject({ id: "recent", currentPlayers: 2 });
  expect(result.buckets[0]).toMatchObject({
    bucketAt: new Date("2026-09-10T00:00:00Z"),
    peakPlayers: 100,
  });
  expect(state.queries[0].sql).not.toContain("limit");
  expect(state.queries[1].params.at(-1)).toBe(500);
  expect(state.queries[1].sql).toContain(
    'order by "server_observations"."observed_at" desc, "server_observations"."id" desc',
  );
  expect(state.queries[2].sql).toContain('group by "bucket_at" order by "bucket_at"');
  expect(state.queries[2].sql).not.toContain("limit");
  for (const query of state.queries) {
    expect(query.params).toContain("server");
    expect(query.params).toContain("mta_master");
    expect(query.params).toContain("2026-09-09T12:00:00.000Z");
    expect(query.params).toContain(now.toISOString());
    expect(query.sql).toContain('"observed_at" >=');
    expect(query.sql).toContain('"observed_at" <=');
  }
});
it.each([
  [24, 3600],
  [168, 21600],
  [720, 86400],
  [NaN, 3600],
  [Infinity, 3600],
  [-3, 3600],
  [10000, 86400],
] as const)("chooses a bounded UTC bucket width for %s hours", async (hours, width) => {
  const result = await repository.readWindow("server", hours, 1.9);
  expect(result.bucketSeconds).toBe(width);
  expect(result.sampleLimit).toBe(1);
  expect(state.queries[2].params.slice(0, 2)).toEqual([width, width]);
  expect(result.windowEnd).toEqual(now);
  expect(result.windowEnd.getTime() - result.windowStart.getTime()).toBeLessThanOrEqual(
    744 * 3600000,
  );
});
it("keeps empty aggregates and unknown values null", async () => {
  state.results = [[["0", "0", null, null, null, null]], [], []];
  const result = await repository.readWindow("server");
  expect(result.summary).toEqual({
    observationCount: 0,
    knownPlayerCount: 0,
    observedFrom: null,
    observedTo: null,
    peakPlayers: null,
    averagePlayers: null,
  });
  expect(result.observations).toEqual([]);
  expect(result.buckets).toEqual([]);
});
it("binds unusual server IDs and non-finite sample limits without generating invalid SQL", async () => {
  await repository.readWindow("server_' --", 24, Infinity);
  for (const query of state.queries) {
    expect(query.params).toContain("server_' --");
    expect(query.sql).not.toContain("server_' --");
  }
  expect(state.queries[1].params.at(-1)).toBe(500);
});
it("propagates a database failure without a partial summary", async () => {
  state.failure = new Error("Database unavailable");
  await expect(repository.readWindow("server")).rejects.toThrow();
  expect(state.queries).toHaveLength(1);
});
