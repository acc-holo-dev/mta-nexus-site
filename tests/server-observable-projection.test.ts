import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

const state = vi.hoisted(() => ({
  selection: null as Record<string, unknown> | null,
  condition: null as SQL | null,
  ordering: [] as SQL[],
  limit: 0,
}));

vi.mock("../packages/db/src/client", () => ({
  db: {
    select(selection: Record<string, unknown>) {
      state.selection = selection;
      const query = {
        from: () => query,
        where(condition: SQL) { state.condition = condition; return query; },
        orderBy(...fields: SQL[]) { state.ordering = fields; return query; },
        limit(limit: number) { state.limit = limit; return Promise.resolve([
          { id: "srv_1", ipAddress: "203.0.113.7", port: 22003, endpointRevision: 0 },
        ]); },
      };
      return query;
    },
  },
}));

import { ServerRepository } from "../packages/db/src/repositories/servers";

const repository = new ServerRepository();
const dialect = new PgDialect();

beforeEach(() => {
  state.selection = null;
  state.condition = null;
  state.ordering = [];
  state.limit = 0;
});

describe("observable server endpoint query", () => {
  it("selects only the three collector fields and preserves the eligible listing filter", async () => {
    const rows = await repository.listObservable(501);
    expect(Object.keys(state.selection ?? {}).sort()).toEqual(["endpointRevision", "id", "ipAddress", "port"]);
    expect(rows).toEqual([{ id: "srv_1", ipAddress: "203.0.113.7", port: 22003, endpointRevision: 0 }]);
    expect(state.condition).not.toBeNull();
    const where = dialect.sqlToQuery(state.condition as SQL);
    expect(where.sql).toContain('"servers"."status"');
    expect(where.sql).toContain('"servers"."visibility"');
    expect(where.params).toEqual(["active", "private"]);
    expect(state.ordering.map(item => dialect.sqlToQuery(item).sql)).toEqual([
      '"servers"."updated_at" desc',
      '"servers"."id" desc',
    ]);
    expect(state.limit).toBe(501);
  });

  it.each([
    [undefined, 501],
    [Number.NaN, 501],
    [Number.POSITIVE_INFINITY, 501],
    [-5, 1],
    [1.9, 1],
    [1000, 501],
  ])("clamps observable limit %s to %s", async (input, expected) => {
    await repository.listObservable(input);
    expect(state.limit).toBe(expected);
  });
});
