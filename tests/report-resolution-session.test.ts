import { getTableColumns } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    return {
      rows: sql.startsWith("select") || sql.includes(" returning ") ? (state.rows.shift() ?? []) : [],
    };
  });
  const proxy: typeof database = new Proxy(database, {
    get(target, key) {
      if (key === "transaction")
        return (callback: (tx: typeof database) => unknown) => callback(proxy);
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return { db: proxy };
});

import { ReportRepository } from "../packages/db/src/repositories/reports";
import { digestSessionToken } from "../packages/db/src/repositories/sessions";
import { reports } from "../packages/db/src/schema";

const row = (table: PgTable, values: Record<string, unknown>) =>
  Object.keys(getTableColumns(table)).map((key) => values[key] ?? null);
const audit = {
  id: "aud_1",
  actorId: "mod_1",
  actorType: "admin" as const,
  action: "admin.resolve",
  targetId: "rpt_1",
  targetType: "report" as const,
};
const writes = (table: string) =>
  state.queries.filter((query) => new RegExp(`^(?:insert into|update) "${table}"`).test(query.sql));
beforeEach(() => {
  state.queries = [];
  state.rows = [];
});

it("locks the actor and initiating session before resolving a report", async () => {
  state.rows = [
    [["mod_1"]],
    [["ses_mod", "2099-01-01T00:00:00.000Z"]],
    [row(reports, {
      id: "rpt_1",
      reporterId: "member_1",
      targetType: "product",
      targetId: "prd_1",
      type: "scam",
      reason: "Unsafe",
      evidenceUrls: [],
      status: "resolved",
      moderatorNotes: "Reviewed",
      createdAt: "2026-10-26T00:00:00.000Z",
      resolvedAt: "2026-10-26T00:00:00.000Z",
    })],
  ];
  const result = await new ReportRepository().resolve(
    "rpt_1",
    "resolved",
    "Reviewed",
    audit,
    "staff-token",
  );
  expect(result?.status).toBe("resolved");
  expect(state.queries[0].sql).toContain('from "users"');
  expect(state.queries[0].sql).toContain("for share");
  expect(state.queries[0].sql).not.toContain('"role"');
  expect(state.queries[1].sql).toContain('from "sessions"');
  expect(state.queries[1].sql).toContain("for update");
  expect(state.queries[1].params).toContain("mod_1");
  expect(state.queries[1].params).toContain(digestSessionToken("staff-token"));
  const update = state.queries.findIndex((query) => query.sql.startsWith('update "reports"'));
  expect(update).toBeGreaterThan(1);
  expect(writes("audit_events")).toHaveLength(1);
});

it("refuses a missing or expired initiating session before changing the report", async () => {
  for (const session of [[], [["ses_mod", "2000-01-01T00:00:00.000Z"]]] as unknown[][][]) {
    state.queries = [];
    state.rows = [[["mod_1"]], session];
    await expect(
      new ReportRepository().resolve("rpt_1", "resolved", "Reviewed", audit, "staff-token"),
    ).rejects.toMatchObject({ statusCode: 401, code: "UNAUTHORIZED" });
    expect(writes("reports")).toHaveLength(0);
    expect(writes("audit_events")).toHaveLength(0);
  }
});
