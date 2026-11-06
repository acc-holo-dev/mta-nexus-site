import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createFinancialRepositoryDbMock } = await import(
    "./helpers/financial-repository-harness"
  );
  return createFinancialRepositoryDbMock();
});

import { PaymentRepository } from "../packages/db/src/repositories/payments";
import {
  FinancialStatementsRepository,
  FinancialReviewRepository,
} from "../packages/db/src/repositories/financial-statements";
import {
  financialRepositoryState as state,
  installFinancialRepositoryHooks,
} from "./helpers/financial-repository-harness";

const statements = new FinancialStatementsRepository(),
  review = new FinancialReviewRepository(),
  payments = new PaymentRepository();
installFinancialRepositoryHooks();

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
