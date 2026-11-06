import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createCommercialOperationsRepositoryDbMock } = await import(
    "./helpers/commercial-operations-repository-harness"
  );
  return createCommercialOperationsRepositoryDbMock();
});

import { OrderOperationsRepository } from "../packages/db/src/repositories/order-operations";
import { PaymentRepository } from "../packages/db/src/repositories/payments";
import { digestSessionToken } from "../packages/db/src/repositories/sessions";
import {
  commercialOperationsRepositoryBuyerAuthorization as buyerAuthorization,
  commercialOperationsRepositoryCancelled as cancelled,
  commercialOperationsRepositoryCommand as command,
  installCommercialOperationsRepositoryHooks,
  commercialOperationsRepositoryInput as input,
  commercialOperationsRepositoryNow as now,
  commercialOperationsRepositoryState as state,
} from "./helpers/commercial-operations-repository-harness";

const operations = new OrderOperationsRepository();

installCommercialOperationsRepositoryHooks();

it("scopes order ownership before payment queries or receipt lookup", async () => {
  await expect(operations.buyerDetail("usr_other' --", "ord_a")).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  expect(state.queries).toHaveLength(1);
  expect(state.queries[0].params).toContain("usr_other' --");
  expect(state.queries[0].sql).not.toContain("usr_other' --");
  state.queries = [];
  await expect(operations.cancel({ ...input, buyerId: "usr_other" })).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  expect(state.queries).toHaveLength(2);
  expect(state.queries[1].params).toContain("usr_other");
});
it("bounds payment archive and never selects provider transactions, failures or secrets", async () => {
  state.results = [
    [["ord_a", "N-1", "pending", now]],
    [[21]],
    [],
    [["pay_a", "failed", 999, "USD", now, now]],
  ];
  expect(await operations.buyerDetail("usr_buyer", "ord_a", 2)).toMatchObject({
    canCancel: false,
    page: 2,
    total: 21,
    attempts: [{ id: "pay_a", status: "failed" }],
  });
  expect(state.options).toEqual([{ isolationLevel: "repeatable read", accessMode: "read only" }]);
  const query = state.queries.at(-1);
  expect(query?.params.slice(-2)).toEqual([20, 20]);
  for (const column of ["provider_transaction_id", "failure_reason", "provider", "buyer_id"])
    expect(query?.sql).not.toContain(`"${column}"`);
});
it("cancels once and saves the durable result with atomic audit, without access or refund writes", async () => {
  state.results = [
    [],
    [["ord_a", "pending", now]],
    ...buyerAuthorization,
    [],
    [],
    [],
    [["ses_buyer", "2099-01-01T00:00:00.000Z"]],
    [[cancelled]],
    [],
    [],
    [["ses_buyer", "2099-01-01T00:00:00.000Z"]],
  ];
  expect(await operations.cancel(input)).toEqual({
    kind: "unpaid_order_cancelled",
    orderId: "ord_a",
    requestId: command.requestId,
    cancelledAt: new Date(cancelled),
  });
  expect(state.queries[0].sql).toContain("pg_advisory_xact_lock");
  expect(state.queries[1].sql).toContain("for no key update");
  expect(state.queries[2].sql).toContain('from "users"');
  expect(state.queries[2].sql).toContain("for share");
  expect(state.queries[3].sql).toContain('from "sessions"');
  expect(state.queries[3].sql).toContain("for update");
  expect(state.queries[3].params).toContain(digestSessionToken(input.currentToken));
  expect(state.queries[3].params).not.toContain(input.currentToken);
  expect(state.queries[8].sql).toContain("date_trunc('milliseconds'");
  expect(state.queries[9].sql).toContain('insert into "order_cancellation_receipts"');
  expect(state.queries[10].params).toContain("order.unpaid_cancelled");
  expect(
    state.queries.some((q) =>
      /insert into "(?:licenses|entitlements|ledger_entries|payments)"/u.test(q.sql),
    ),
  ).toBe(false);
});
it("replays the exact stored cancellation without checking changed status or writing twice", async () => {
  state.results = [
    [],
    [["ord_a", "cancelled", cancelled]],
    ...buyerAuthorization,
    [["ord_a", now, command.reason, cancelled]],
    [["ses_buyer", "2099-01-01T00:00:00.000Z"]],
  ];
  expect(await operations.cancel(input)).toMatchObject({ cancelledAt: new Date(cancelled) });
  expect(state.queries).toHaveLength(6);
});
it("does not expose a stored cancellation when the session expires during receipt lookup", async () => {
  state.results = [
    [],
    [["ord_a", "cancelled", cancelled]],
    ...buyerAuthorization,
    [["ord_a", now, command.reason, cancelled]],
    [],
  ];
  await expect(operations.cancel(input)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
});
it.each([{ reason: "Different reason" }, { expectedUpdatedAt: cancelled }])(
  "rejects reuse of a receipt key with different intent %j",
  (change) => {
    state.results = [
      [],
      [["ord_a", "cancelled", cancelled]],
      ...buyerAuthorization,
      [["ord_a", now, command.reason, cancelled]],
    ];
    return expect(
      operations.cancel({ ...input, command: { ...command, ...change } }),
    ).rejects.toMatchObject({ code: "ORDER_REQUEST_CONFLICT" });
  },
);
it.each(["processing", "completed", "refunded", "cancelled", "failed"])(
  "does not cancel an order in %s state",
  (status) => {
    state.results = [[], [["ord_a", status, now]], ...buyerAuthorization, []];
    return expect(operations.cancel(input)).rejects.toMatchObject({ code: "ORDER_STATE_CHANGED" });
  },
);
it("requires reconciliation even for a failed payment attempt", async () => {
  state.results = [
    [],
    [["ord_a", "pending", now]],
    ...buyerAuthorization,
    [],
    [["pay_failed"]],
    [],
  ];
  await expect(operations.cancel(input)).rejects.toMatchObject({
    code: "ORDER_RECONCILIATION_REQUIRED",
  });
  expect(state.queries.some((q) => q.sql.startsWith("update"))).toBe(false);
});
it("requires reconciliation for an order financial entry without a payment attempt", async () => {
  state.results = [[], [["ord_a", "pending", now]], ...buyerAuthorization, [], [], [["ledger_a"]]];
  await expect(operations.cancel(input)).rejects.toMatchObject({
    code: "ORDER_RECONCILIATION_REQUIRED",
  });
});
it("does not write a receipt after a failed compare-and-swap", async () => {
  state.results = [
    [],
    [["ord_a", "pending", now]],
    ...buyerAuthorization,
    [],
    [],
    [],
    [["ses_buyer", "2099-01-01T00:00:00.000Z"]],
    [],
  ];
  await expect(operations.cancel(input)).rejects.toMatchObject({ code: "ORDER_STATE_CHANGED" });
  expect(state.queries.some((q) => q.sql.startsWith("insert"))).toBe(false);
});
it.each([
  ["cancelled", 999, "USD"],
  ["completed", 999, "USD"],
  ["pending", 998, "USD"],
  ["pending", 999, "EUR"],
])(
  "guards new payment attempts against the locked order %s/%s/%s",
  async (status, total, currency) => {
    state.results = [[[status, total, currency]]];
    await expect(
      new PaymentRepository().create({
        id: "pay_a",
        orderId: "ord_a",
        provider: "provider",
        amount: 999,
        currency: "USD",
        status: "pending",
      }),
    ).rejects.toMatchObject({ code: "ORDER_NOT_PAYABLE" });
    expect(state.queries).toHaveLength(1);
    expect(state.queries[0].sql).toContain("for no key update");
  },
);
