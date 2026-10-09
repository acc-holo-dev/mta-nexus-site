import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  order: [] as SQL[],
  where: null as SQL | null,
  limit: 0,
  rows: [] as { id: string; observedAt: Date }[],
}));

vi.mock("../packages/db/src/client", () => ({
  db: {
    select: () => {
      const query = {
        from: () => query,
        where(condition: SQL) { state.where = condition; return query; },
        orderBy(...fields: SQL[]) { state.order = fields; return query; },
        limit(value: number) {
          state.limit = value;
          return Promise.resolve([...state.rows]);
        },
      };
      return query;
    },
  },
}));

import { ServerObservationRepository } from "../packages/db/src/repositories/server-observations";

const dialect = new PgDialect();
const repository = new ServerObservationRepository();
const ORDER = [
  '"server_observations"."observed_at" desc',
  '"server_observations"."id" desc',
];

beforeEach(() => {
  state.order = [];
  state.where = null;
  state.limit = 0;
  state.rows = [];
});

describe("bounded deterministic observation history queries", () => {
  it("uses an ID tie-breaker on the latest-first history query", async () => {
    await repository.listRecent("srv_test", 96);
    expect(state.limit).toBe(96);
    expect(state.order.map(item => dialect.sqlToQuery(item).sql)).toEqual(ORDER);
  });

  it("returns chronological history after a deterministic latest-first query", async () => {
    const at = new Date("2026-10-09T12:00:00Z");
    state.rows = [{ id: "obs_b", observedAt: at }, { id: "obs_a", observedAt: at }];
    const selected = await repository.listWindow("srv_test", 24, 10);
    expect(state.limit).toBe(10);
    expect(state.order.map(item => dialect.sqlToQuery(item).sql)).toEqual(ORDER);
    expect(selected.map(item => item.id)).toEqual(["obs_a", "obs_b"]);
  });

  it("keeps the existing 500-observation limit", async () => {
    await repository.listWindow("srv_test", 24 * 30, 50_000);
    expect(state.limit).toBe(500);
  });

  it.each([
    [Number.NaN, 96],
    [Number.POSITIVE_INFINITY, 96],
    [-9, 1],
    [1.9, 1],
    [5_000, 500],
  ])("bounds recent history limit %s", async (input, expected) => {
    await repository.listRecent("srv_test", input);
    expect(state.limit).toBe(expected);
  });

  it.each([
    [Number.NaN, 500],
    [Number.NEGATIVE_INFINITY, 500],
    [-9, 1],
    [1.9, 1],
    [9_999, 500],
  ])("bounds history window limit %s", async (input, expected) => {
    await repository.listWindow("srv_test", 24, input);
    expect(state.limit).toBe(expected);
  });

  // The PostgreSQL timestamp encoder maps Date to ISO text in SQL params.
  function capturedSince(): number {
    if (!state.where) throw new Error("Missing SQL predicate");
    const params = dialect.sqlToQuery(state.where).params;
    const stamp = params.find(value =>
      typeof value === "string" && value.length >= 20 &&
      value[4] === "-" && value[7] === "-" && value[10] === "T",
    );
    if (typeof stamp !== "string") throw new Error("Missing ISO timestamp SQL parameter");
    const parsed = Date.parse(stamp);
    expect(Number.isFinite(parsed)).toBe(true);
    return parsed;
  }

  it.each([
    Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY,
  ])("uses a valid 24h history window for invalid hours %s", async (hours) => {
    await repository.listWindow("srv_test", hours, 20);
    const elapsed = Date.now() - capturedSince();
    expect(elapsed).toBeGreaterThanOrEqual(24 * 3_600_000 - 1_000);
    expect(elapsed).toBeLessThanOrEqual(24 * 3_600_000 + 1_000);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])(
    "uses valid peak-player window hours for %s",
    async (hours) => {
      // Verify the constructed SQL without a live PostgreSQL dependency.
      await repository.getPeakPlayers("srv_test", hours);
      expect(Number.isFinite(capturedSince())).toBe(true);
    },
  );
});
