import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  queries: [] as Array<{ sql: string; params: unknown[] }>,
  rows: [] as string[][],
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  return {
    // Run the installed Drizzle SQL builder and row mapper without PostgreSQL.
    db: drizzle(async (sql, params) => {
      state.queries.push({ sql, params });
      return { rows: state.rows };
    }),
  };
});
import { OrganizationRepository } from "../packages/db/src/repositories/organizations";

const repository = new OrganizationRepository();
beforeEach(() => {
  state.queries = [];
  state.rows = [];
});

it("does not query organizations for an empty selection", async () => {
  expect(await repository.findSummariesByIds([])).toEqual([]);
  expect(state.queries).toHaveLength(0);
});

it("reads fifty distinct IDs in one projected query and maps the actual driver rows", async () => {
  const ids = Array.from({ length: 50 }, (_, index) => `org_${index}`);
  state.rows = [["org_49", "Last Organization", "last-organization"], ["org_0", "First Organization", "first-organization"]];
  const result = await repository.findSummariesByIds([...ids, ids[0]]);
  expect(result).toEqual([
    { id: "org_49", name: "Last Organization", slug: "last-organization" },
    { id: "org_0", name: "First Organization", slug: "first-organization" },
  ]);
  expect(state.queries).toHaveLength(1);
  expect(state.queries[0].sql).toMatch(/^select "id", "name", "slug" from "organizations" where "organizations"\."id" in \(/);
  expect(state.queries[0].params).toEqual(ids);
  expect(state.queries[0].sql).toContain("$50");
});

it("binds unusual IDs as parameters instead of SQL text", async () => {
  const id = "org_' ); DROP TABLE organizations; --";
  await repository.findSummariesByIds([id]);
  expect(state.queries).toHaveLength(1);
  expect(state.queries[0].params).toEqual([id]);
  expect(state.queries[0].sql).not.toContain(id);
});
