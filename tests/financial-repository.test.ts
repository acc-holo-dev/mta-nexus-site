import { createHash } from "node:crypto";
import { getTableColumns } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  results: [] as unknown[][],
  options: [] as unknown[],
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    return { rows: state.results.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return async (callback: (tx: typeof database) => unknown, options?: unknown) => {
            state.options.push(options);
            return callback(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
});
import { LedgerRepository } from "../packages/db/src/repositories/ledger";
import { PaymentRepository } from "../packages/db/src/repositories/payments";
import {
  FinancialStatementsRepository,
  FinancialReviewRepository,
} from "../packages/db/src/repositories/financial-statements";
import { ledgerEntries } from "../packages/db/src/schema";
const ledger = new LedgerRepository(),
  statements = new FinancialStatementsRepository(),
  review = new FinancialReviewRepository(),
  payments = new PaymentRepository();
const lines = [
  {
    id: "leg_a",
    accountId: "user:usr_a",
    amount: 90,
    currency: "USD",
    referenceType: "fee" as const,
    referenceId: "ref_a",
    description: "Credit",
  },
  {
    id: "leg_b",
    accountId: "platform:nexus",
    amount: -90,
    currency: "USD",
    referenceType: "fee" as const,
    referenceId: "ref_a",
    description: "Debit",
  },
];
function record(line: (typeof lines)[number], balanceAfter: number) {
  const value: Record<string, unknown> = {
    ...line,
    batchId: "post_a",
    balanceAfter,
    createdAt: "2026-10-11T00:00:00.000Z",
  };
  return Object.keys(getTableColumns(ledgerEntries)).map((key) => value[key]);
}
beforeEach(() => {
  state.queries = [];
  state.results = [];
  state.options = [];
});
it("serializes references before account locks and posts the whole batch atomically", async () => {
  state.results = [[], [], [], [], [], [], [record(lines[0], 90)], [record(lines[1], -90)]];
  expect(await ledger.post("post_a", lines)).toMatchObject([
    { balanceAfter: 90 },
    { balanceAfter: -90 },
  ]);
  expect(state.queries[2].sql).toContain('from "orders"');
  expect(state.queries[2].sql).toContain("for no key update");
  expect(state.queries[3].params).toEqual(["ledger-account:platform:nexus:USD"]);
  expect(state.queries[4].params).toEqual(["ledger-account:user:usr_a:USD"]);
  expect(state.queries[5].sql).toContain('insert into "ledger_posting_batches"');
  expect(state.queries.map((q) => q.sql).join("\n")).not.toMatch(
    /update "(?:orders|payments|entitlements)"/u,
  );
});
it("exact replay returns existing records without a second posting", async () => {
  const digest = createHash("sha256").update(JSON.stringify(lines)).digest("hex");
  state.results = [[], [[digest]], [record(lines[0], 90), record(lines[1], -90)]];
  expect(await ledger.post("post_a", [...lines].reverse())).toHaveLength(2);
  expect(state.queries).toHaveLength(3);
  expect(state.queries.some((q) => q.sql.startsWith("insert"))).toBe(false);
});
it("rejects key reuse with changed contents", async () => {
  state.results = [[], [["different"]]];
  await expect(ledger.post("post_a", lines)).rejects.toMatchObject({
    code: "LEDGER_REQUEST_CONFLICT",
  });
  expect(state.queries).toHaveLength(2);
});
it("a cancelled order cannot acquire journal references", async () => {
  state.results = [[], [], [["ref_a", "cancelled"]]];
  await expect(ledger.post("post_a", lines)).rejects.toMatchObject({ code: "ORDER_NOT_PAYABLE" });
  expect(state.queries.some((q) => q.sql.startsWith("insert"))).toBe(false);
});
it("refuses unbalanced input before opening a transaction", async () => {
  await expect(
    ledger.post("post_a", [lines[0], { ...lines[1], amount: -80 }]),
  ).rejects.toMatchObject({ code: "LEDGER_POSTING_INVALID" });
  expect(state.queries).toHaveLength(0);
});
it("sums only the requested account and currency", async () => {
  state.results = [[["90"]]];
  expect(await ledger.getAccountBalance("user:usr_a", "EUR")).toBe(90);
  expect(state.queries[0].params).toEqual(["user:usr_a", "EUR"]);
  expect(state.queries[0].sql).toContain("sum(");
});
it("scopes statements in SQL and leaves hold/withdrawable totals unknown", async () => {
  state.results = [[["usr_a"]], [["USD", "90", "100", "-10", 21, 1]], []];
  const result = await statements.statement("usr_a", 2, "USD");
  expect(result).toMatchObject({
    page: 2,
    pageSize: 20,
    availability: "unreconciled",
    totals: [{ currency: "USD", balance: "90", held: null, available: null }],
  });
  const query = state.queries.at(-1);
  expect(query?.params).toEqual(["user:usr_a", "USD", 20, 20]);
  expect(query?.sql).not.toContain('"description"');
});
it("product management alone does not grant access to organization finances", async () => {
  state.results = [[["org_a", "owner", "Organization"]], [["usr_a"]], [["member"]]];
  await expect(statements.statement("usr_a", 1, undefined, "org_a")).rejects.toMatchObject({
    statusCode: 404,
  });
  expect(state.queries).toHaveLength(3);
});
it.each(["admin", "owner"])("accepts a current organization %s", async (role) => {
  state.results = [[["org_a", "other", "Organization"]], [["usr_a"]], [[role]], [], []];
  expect(await statements.statement("usr_a", 1, undefined, "org_a")).toMatchObject({
    scope: { id: "org:org_a" },
  });
  expect(state.queries[2].sql).toContain("for share");
});
it("a stale admin or a general moderator cannot read financial reconciliation", async () => {
  for (const role of ["moderator", "user"]) {
    state.results = [[[role]]];
    await expect(review.page("usr_a")).rejects.toMatchObject({ statusCode: 403 });
  }
  expect(state.queries.every((q) => q.sql.includes('from "users"'))).toBe(true);
});
it("filters inconsistencies before pagination and omits private payment data", async () => {
  state.results = [[["admin"]], [{ total: 21 }], []];
  expect(await review.page("usr_a", 2)).toMatchObject({ page: 2, pageSize: 20, total: 21 });
  const query = state.queries.at(-1);
  expect(query?.sql).toContain('"missingCapture" OR');
  expect(query?.params.slice(-2)).toEqual([20, 20]);
  for (const field of ["provider_transaction_id", "failure_reason", "buyer_id"])
    expect(query?.sql).not.toContain(field);
});
it("does not fabricate financial payment transitions without a provider", async () => {
  for (const status of ["authorized", "completed", "refunded", "disputed"] as const)
    await expect(payments.updateStatus("pay_a", status)).rejects.toMatchObject({
      code: "PAYMENT_CONFIRMATION_REQUIRED",
    });
  expect(state.queries).toHaveLength(0);
});
it("pending attempt cancellation is terminal and replay does not rewrite failure history", async () => {
  state.results = [[["ord_a"]], [["ord_a"]], [["cancelled"]]];
  await payments.updateStatus("pay_a", "cancelled", "changed");
  expect(state.queries.some((q) => q.sql.startsWith("update"))).toBe(false);
  state.results = [[["ord_a"]], [["ord_a"]], [["completed"]]];
  await expect(payments.updateStatus("pay_a", "cancelled")).rejects.toMatchObject({
    code: "PAYMENT_STATE_CHANGED",
  });
});
