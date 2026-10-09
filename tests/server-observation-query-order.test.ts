import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  order: [] as SQL[],
  limit: 0,
  rows: [] as { id: string; observedAt: Date }[],
}));

vi.mock("../packages/db/src/client", () => ({
  db: {
    select: () => {
      const query = {
        from: () => query,
        where: () => query,
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
});
