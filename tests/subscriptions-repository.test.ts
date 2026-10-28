import { createHash } from "node:crypto";
import { getTableColumns } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][],
  options: [] as unknown[],
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    return { rows: state.rows.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return async (fn: (tx: typeof database) => unknown, options: unknown) => {
            state.options.push(options);
            return fn(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
});

import {
  SubscriptionsRepository,
  subscriptionReceipt,
} from "../packages/db/src/repositories/subscriptions";
import {
  accountSubscriptions,
  commercialPlans,
  subscriptionReceipts,
} from "../packages/db/src/schema";
import {
  activation,
  cancellation,
  cancelledAt,
  date,
  expiresAt,
  plan,
  receipt,
  snapshot,
  subscription,
  terms,
} from "./subscriptions-fixtures";

const currentToken = "subscription-current-token";
const sessionRow = () => [["ses_subscription", new Date(Date.now() + 3600000).toISOString()]];
const repo = new SubscriptionsRepository(),
  hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
const grant = {
  ...subscription,
  actorId: "usr_a",
  termsSnapshot: terms,
} as typeof accountSubscriptions.$inferSelect;
const stored = {
  id: receipt.id,
  actorId: "usr_a",
  requestId: activation.requestId,
  subscriptionId: subscription.id,
  action: "activate",
  commandDigest: hash({
    action: "activate",
    subjectType: "user",
    subjectId: "usr_a",
    planId: activation.planId,
    expectedRevision: 2,
  }),
  snapshot: snapshot(),
  createdAt: date,
} as typeof subscriptionReceipts.$inferSelect;
const values = (columns: object, row: object) =>
  Object.keys(columns).map((key) => {
    const v = (row as Record<string, unknown>)[key];
    return v instanceof Date ? v.toISOString() : (v ?? null);
  });
const grantValues = (row = grant) => values(getTableColumns(accountSubscriptions), row),
  receiptValues = (row = stored) => values(getTableColumns(subscriptionReceipts), row),
  planValues = (row = plan) => values(getTableColumns(commercialPlans), row);
const mutationHead = () => [[], [], [], [], [["usr_a"]], []] as unknown[][];
const writes = () => state.queries.filter((q) => /^(?:insert|update|delete)/u.test(q.sql));
beforeEach(() => {
  state.rows = [];
  state.queries = [];
  state.options = [];
});
it("activates with stable request/account locks and database-generated terms and dates", async () => {
  state.rows = [
    ...mutationHead(),
    [planValues()],
    [[terms, "published"]],
    [],
    sessionRow(),
    [[date.toISOString()]],
    [[0]],
    [grantValues()],
    [receiptValues()],
    [],
  ];
  const result = await repo.command("usr_a", activation, currentToken);
  expect(result.replayed).toBe(false);
  expect(result.receipt.subscription.terms).toEqual(terms);
  expect(state.options).toEqual([{ isolationLevel: "read committed" }]);
  expect(state.queries.filter((q) => q.sql.includes("pg_advisory_xact_lock"))).toHaveLength(2);
  const sessionQuery = state.queries.find((q) => q.sql.includes('from "sessions"'));
  expect(sessionQuery?.sql).toContain("for update");
  expect(sessionQuery?.params).toContain(createHash("sha256").update(currentToken).digest("hex"));
  expect(sessionQuery?.params).not.toContain(currentToken);
  const subscriptionLock = state.queries.findIndex(
    (q) => q.sql.includes('from "account_subscriptions"') && q.sql.includes("for update"),
  );
  const sessionLock = state.queries.findIndex((q) => q.sql.includes('from "sessions"'));
  expect(sessionLock).toBeGreaterThan(subscriptionLock);
  expect(sessionLock).toBeLessThan(
    state.queries.findIndex((q) => /^(?:insert|update|delete)/u.test(q.sql)),
  );
  expect(writes()).toHaveLength(3);
  expect(writes()[0]?.sql).toContain('"account_subscriptions"');
  expect(writes()[0]?.params).not.toContain(JSON.stringify(terms));
  expect(writes()[2]?.params).toContain("commerce.subscription_activated_free");
  expect(
    state.queries.some((q) => /payments|licenses|ledger_entries|entitlements/u.test(q.sql)),
  ).toBe(false);
});
it("rejects an absent initiating token without opening a transaction", async () => {
  await expect(repo.command("usr_a", activation, "")).rejects.toMatchObject({
    code: "UNAUTHORIZED",
  });
  expect(state.options).toEqual([]);
  expect(state.queries).toEqual([]);
});
it("replays an exact request without requiring the plan to remain published", async () => {
  state.rows = [[], [], [], [], [["usr_a"]], [receiptValues()], sessionRow()];
  expect((await repo.command("usr_a", activation, currentToken)).replayed).toBe(true);
  expect(writes()).toHaveLength(0);
  expect(state.queries.some((q) => q.sql.includes('from "commercial_plans"'))).toBe(false);
});
it("rejects reused requests with changed plan revisions", async () => {
  state.rows = [[], [], [], [], [["usr_a"]], [receiptValues()], sessionRow()];
  await expect(
    repo.command("usr_a", { ...activation, expectedRevision: 3 }, currentToken),
  ).rejects.toMatchObject({ code: "SUBSCRIPTION_REQUEST_CONFLICT" });
  expect(writes()).toHaveLength(0);
});
it("rejects paid terms before reading or modifying any subscription", async () => {
  state.rows = [...mutationHead(), [planValues()], [[{ ...terms, price: 1000 }, "published"]]];
  await expect(repo.command("usr_a", activation, currentToken)).rejects.toMatchObject({
    code: "SUBSCRIPTION_PAYMENT_REQUIRED",
  });
  expect(writes()).toHaveLength(0);
});
it("refuses stale plan versions and a mismatched account scope", async () => {
  for (const changed of [
    { ...plan, revision: 3 },
    { ...plan, scope: "organization" as const },
  ]) {
    state.rows = [...mutationHead(), [planValues(changed as typeof plan)]];
    await expect(repo.command("usr_a", activation, currentToken)).rejects.toMatchObject({
      code: "SUBSCRIPTION_PLAN_CHANGED",
    });
  }
  expect(writes()).toHaveLength(0);
});
it("does not allow overlapping active periods", async () => {
  state.rows = [
    ...mutationHead(),
    [planValues()],
    [[terms, "published"]],
    [grantValues()],
    sessionRow(),
    [[date.toISOString()]],
  ];
  await expect(repo.command("usr_a", activation, currentToken)).rejects.toMatchObject({
    code: "SUBSCRIPTION_ALREADY_ACTIVE",
  });
  expect(writes()).toHaveLength(0);
});
it("retires an expired row before creating a new period and records expiry atomically", async () => {
  state.rows = [
    ...mutationHead(),
    [planValues()],
    [[terms, "published"]],
    [grantValues()],
    sessionRow(),
    [[expiresAt.toISOString()]],
    [],
    [],
    [[1]],
    [grantValues()],
    [receiptValues()],
    [],
  ];
  expect((await repo.command("usr_a", activation, currentToken)).replayed).toBe(false);
  expect(writes()[0]?.sql).toContain('update "account_subscriptions"');
  expect(writes()[0]?.params).toContain("expired");
  expect(writes()[1]?.params).toContain("commerce.subscription_expired");
  expect(writes()).toHaveLength(5);
});
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
it("enforces the bounded period quota while leaving cancellation independent", async () => {
  state.rows = [
    ...mutationHead(),
    [planValues()],
    [[terms, "published"]],
    [],
    sessionRow(),
    [[date.toISOString()]],
    [[500]],
  ];
  await expect(repo.command("usr_a", activation, currentToken)).rejects.toMatchObject({
    code: "SUBSCRIPTION_LIMIT",
  });
  expect(writes()).toHaveLength(0);
});
it("checks live financial authority before reading retry receipts", async () => {
  state.rows = [
    [],
    [],
    [],
    [],
    [["org_a", "usr_other", "Organization"]],
    [["usr_a"]],
    [["developer"]],
  ];
  await expect(
    repo.command("usr_a", { ...activation, organizationId: "org_a" }, currentToken),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(state.queries.some((q) => q.sql.includes('from "subscription_receipts"'))).toBe(false);
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
