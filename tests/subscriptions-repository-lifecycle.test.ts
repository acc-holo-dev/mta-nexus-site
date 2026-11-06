import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createSubscriptionsRepositoryDbMock } = await import(
    "./helpers/subscriptions-repository-harness"
  );
  return createSubscriptionsRepositoryDbMock();
});

import {
  SubscriptionsRepository,
  subscriptionReceipt,
} from "../packages/db/src/repositories/subscriptions";
import {
  cancellation,
  cancelledAt,
  date,
  expiresAt,
  receipt,
  snapshot,
  subscription,
  terms,
} from "./subscriptions-fixtures";
import {
  subscriptionsRepositoryCurrentToken as currentToken,
  subscriptionsRepositoryGrant as grant,
  subscriptionsRepositoryGrantValues as grantValues,
  installSubscriptionsRepositoryHooks,
  subscriptionsRepositoryMutationHead as mutationHead,
  subscriptionsRepositoryPlanValues as planValues,
  subscriptionsRepositoryReceiptValues as receiptValues,
  subscriptionsRepositorySessionRow as sessionRow,
  subscriptionsRepositoryState as state,
  subscriptionsRepositoryStored as stored,
  subscriptionsRepositoryWrites as writes,
} from "./helpers/subscriptions-repository-harness";

const repo = new SubscriptionsRepository();

installSubscriptionsRepositoryHooks();

it("ends a live period and appends a cancellation receipt without changing its terms", async () => {
  const ended = { ...grant, status: "cancelled" as const, cancelledAt },
    saved = {
      ...stored,
      action: "cancel" as const,
      snapshot: snapshot({ ...subscription, status: "cancelled", cancelledAt }),
    };
  state.rows = [
    ...mutationHead(),
    [grantValues()],
    sessionRow(),
    [[cancelledAt.toISOString()]],
    [grantValues(ended)],
    [receiptValues(saved)],
    [],
    sessionRow(),
  ];
  expect(
    (await repo.command("usr_a", cancellation, currentToken)).receipt.subscription.cancelledAt,
  ).toEqual(cancelledAt);
  expect(writes()[0]?.sql).toContain('set "status"');
  expect(writes()[0]?.params).toContain("cancelled");
  expect(writes()[0]?.params).not.toContain(JSON.stringify(terms));
});
it("refuses late cancellation and never changes expired benefits", async () => {
  state.rows = [...mutationHead(), [grantValues()], sessionRow(), [[expiresAt.toISOString()]]];
  await expect(repo.command("usr_a", cancellation, currentToken)).rejects.toMatchObject({
    code: "SUBSCRIPTION_STATE_CHANGED",
  });
  expect(writes()).toHaveLength(0);
});
it("derives configured fees from database time and restores the baseline on expiry", async () => {
  for (const [observed, bps] of [
    [date, 750],
    [expiresAt, 1000],
  ] as const) {
    state.rows = [[], [], [["usr_a"]], [[observed.toISOString()]], [grantValues()]];
    const result = await repo.dashboard("usr_a");
    expect(result.commissionBps).toBe(bps);
    expect(result.initialHoldDays).toBe(7);
    expect(result.automaticRenewal).toBe(false);
    expect(result.paidActivationAvailable).toBe(false);
  }
});
it("projects immutable receipts without request keys, actor or private JSON fields", () => {
  expect(
    subscriptionReceipt({ ...stored, snapshot: { ...snapshot(), providerSecret: "secret" } }),
  ).toEqual(receipt);
  expect(JSON.stringify(subscriptionReceipt(stored))).not.toContain("requestId");
  expect(() => subscriptionReceipt({ ...stored, subscriptionId: "other" })).toThrow();
});
it("bounds history by current financial account and stable twenty-row pagination", async () => {
  state.rows = [[], [], [["usr_a"]], [[date.toISOString()]], [[0]], []];
  const history = await repo.history("usr_a", undefined, 9999, 30);
  expect(history.page).toBe(1);
  expect(history.pageSize).toBe(20);
  expect(history.receipts).toEqual([]);
  expect(state.queries.at(-1)?.sql).toContain('inner join "account_subscriptions"');
  expect(state.queries.at(-1)?.sql).toContain('order by "subscription_receipts"."created_at" desc');
});
it("reads frozen receipt status separately from the current subscription state", async () => {
  state.rows = [
    [],
    [],
    [["usr_a"]],
    [[...receiptValues(), ...grantValues({ ...grant, status: "cancelled", cancelledAt })]],
    [[cancelledAt.toISOString()]],
  ];
  const detail = await repo.detail("usr_a", receipt.id);
  expect(detail.receipt.subscription.status).toBe("active");
  expect(detail.current.status).toBe("cancelled");
  expect(detail.receipt.subscription.terms).toEqual(terms);
  expect(
    state.queries.some((q) => q.sql.includes('"account_subscriptions"."subject_id" = $')),
  ).toBe(true);
});
it("estimates current configured fees without affecting balances or applying the fee", async () => {
  state.rows = [[], [], [["usr_a"]], [[date.toISOString()]], [grantValues()]];
  const result = await repo.estimate("usr_a", undefined, 10000, "USD");
  expect(result.subscriptionId).toBe(subscription.id);
  expect(result.estimate).toMatchObject({
    kind: "estimate",
    commissionBps: 750,
    platformFee: 750,
    sellerProceeds: 9250,
    initialHoldDays: 7,
    paidCheckoutAvailable: false,
  });
  expect(writes()).toHaveLength(0);
});
