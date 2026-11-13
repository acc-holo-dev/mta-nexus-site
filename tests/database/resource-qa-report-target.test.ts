import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][],
}));

vi.mock("../../site/packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    return { rows: state.rows.shift() ?? [] };
  });
  return { db: database };
});

import { db } from "../../site/packages/db/src/client";
import { lockPublicReportTarget } from "../../site/packages/db/src/repositories/report-target";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

beforeEach(() => {
  state.queries = [];
  state.rows = [];
});

it("locks a public Q&A thread through its published product and rejects own threads", async () => {
  state.rows = [[["rqt_a", "usr_asker", "prd_a"]], [["prd_a", 0]], [["bld_safe"]]];
  await expect(
    lockPublicReportTarget(db as unknown as Tx, "resource_qa_thread", "rqt_a", "usr_reporter"),
  ).resolves.toBeUndefined();

  state.rows = [[["rqt_a", "usr_asker", "prd_a"]]];
  await expect(
    lockPublicReportTarget(db as unknown as Tx, "resource_qa_thread", "rqt_a", "usr_asker"),
  ).rejects.toMatchObject({ code: "REPORT_OWN_TARGET" });
});
