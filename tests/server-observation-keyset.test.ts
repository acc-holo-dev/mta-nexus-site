import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

const state = vi.hoisted(() => ({
  selected: null as Record<string, unknown> | null,
  condition: null as SQL | null,
  ordering: [] as SQL[],
  limit: 0,
}));
vi.mock("../packages/db/src/client", () => ({
  db: {
    select(selection: Record<string, unknown>) {
      state.selected = selection;
      const chain = {
        from: () => chain,
        where(condition: SQL) { state.condition = condition; return chain; },
        orderBy(...ordering: SQL[]) { state.ordering = ordering; return chain; },
        limit(limit: number) {
          state.limit = limit;
          return Promise.resolve([{ id: "srv_one", ipAddress: "play.example", port: 22003 }]);
        },
      };
      return chain;
    },
  },
}));
import { ServerRepository } from "../packages/db/src/repositories/servers";

const repo = new ServerRepository();
const dialect = new PgDialect();
beforeEach(() => {
  state.selected = null;
  state.condition = null;
  state.ordering = [];
  state.limit = 0;
});
describe("bounded ID-keyset observation page", () => {
  it("selects the minimal endpoint projection and stable ascending id", async () => {
    expect(await repo.listObservableAfter(101)).toEqual([
      { id: "srv_one", ipAddress: "play.example", port: 22003 },
    ]);
    expect(Object.keys(state.selected ?? {}).sort()).toEqual(["id", "ipAddress", "port"]);
    expect(state.ordering.map(value => dialect.sqlToQuery(value).sql))
      .toEqual(['"servers"."id" asc']);
    expect(state.limit).toBe(101);
    const sql = dialect.sqlToQuery(state.condition as SQL);
    expect(sql.params).toEqual(["active", "private"]);
  });

  it("uses an indexed id greater-than cursor, not OFFSET", async () => {
    await repo.listObservableAfter(51, "srv_002");
    const sql = dialect.sqlToQuery(state.condition as SQL);
    expect(sql.sql).toContain('"servers"."id" >');
    expect(sql.params).toEqual(["active", "private", "srv_002"]);
  });

  it.each([[NaN,501], [Infinity,501], [-3,1], [9.9,9], [10_000,501]])(
    "bounds page limit %s to %s", async (requested, expected) => {
      await repo.listObservableAfter(requested);
      expect(state.limit).toBe(expected);
    },
  );
});
