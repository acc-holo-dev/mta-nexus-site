import { getTableColumns } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  results: [] as unknown[][][],
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
import { CommercialPlanRepository } from "../packages/db/src/repositories/commercial-plans";
import { OrderOperationsRepository } from "../packages/db/src/repositories/order-operations";
import { PaymentRepository } from "../packages/db/src/repositories/payments";
import { commercialPlans } from "../packages/db/src/schema";

const plans = new CommercialPlanRepository(),
  operations = new OrderOperationsRepository();
const now = "2026-10-10T12:00:00.000Z",
  cancelled = "2026-10-10T12:00:00.001Z";
const terms = {
  titleRu: "Тариф",
  titleEn: "Seller plan",
  descriptionRu: "Описание тарифа",
  descriptionEn: "Published plan terms",
  price: 999,
  currency: "USD" as const,
  durationDays: 30 as const,
  commissionBps: 750,
};
const command = {
  requestId: "123e4567-e89b-42d3-a456-426614174000",
  expectedUpdatedAt: now,
  reason: "No longer needed",
};
const input = { buyerId: "usr_buyer", orderId: "ord_a", command, auditId: "aud_a" };
function root(status = "draft", revision = 2) {
  const record: Record<string, unknown> = {
    id: "cplan_a",
    slug: "seller-plan",
    scope: "user",
    status,
    revision,
    updatedAt: now,
    createdAt: now,
  };
  return Object.keys(getTableColumns(commercialPlans)).map((key) => record[key]);
}
beforeEach(() => {
  state.queries = [];
  state.results = [];
  state.options = [];
});
it("public catalog joins exactly the current published revision and projects known terms", async () => {
  state.results = [
    [[21]],
    [["cplan_a", "seller-plan", "user", "published", 2, now, { ...terms, secret: "PRIVATE" }]],
  ];
  const result = await plans.catalog("user", 2);
  expect(result).toMatchObject({
    page: 2,
    total: 21,
    plans: [{ titleEn: terms.titleEn, commissionBps: 750 }],
  });
  expect(JSON.stringify(result)).not.toContain("PRIVATE");
  expect(state.options[0]).toEqual({ isolationLevel: "repeatable read", accessMode: "read only" });
  const query = state.queries[1];
  expect(query.sql).toContain(
    '"commercial_plan_revisions"."revision" = "commercial_plans"."revision"',
  );
  expect(query.params).toEqual(["user", "published", "published", 20, 20]);
  expect(query.sql).not.toContain("actor_id");
});
it.each(["moderator", "user"])(
  "denies current %s even with a cached administrator session",
  async (role) => {
    state.results = [[root()], [["usr_admin", role]]];
    await expect(
      plans.command({
        actorId: "usr_admin",
        planId: "cplan_a",
        auditId: "aud_a",
        command: { action: "publish", expectedRevision: 2, reason: "Terms checked" },
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.queries[0].sql).toContain("for no key update");
    expect(state.queries[1].sql).toContain("for share");
    expect(state.queries.some((query) => query.sql.startsWith("insert"))).toBe(false);
  },
);
it("rejects a stale plan revision without altering terms or emitting audit", async () => {
  state.results = [[root()], [["usr_admin", "admin"]]];
  await expect(
    plans.command({
      actorId: "usr_admin",
      planId: "cplan_a",
      auditId: "aud_a",
      command: { action: "publish", expectedRevision: 1, reason: "Terms checked" },
    }),
  ).rejects.toMatchObject({ code: "COMMERCIAL_PLAN_CONFLICT" });
  expect(state.queries).toHaveLength(2);
});
it("editing a published plan appends a draft snapshot and audits within its transaction", async () => {
  state.results = [
    [root("published")],
    [["usr_admin", "admin"]],
    [[terms]],
    [],
    [],
    [],
    [["cplan_a", "seller-plan", "user", "draft", 3, now, { ...terms, price: 2000 }]],
  ];
  expect(
    await plans.command({
      actorId: "usr_admin",
      planId: "cplan_a",
      auditId: "aud_a",
      command: {
        action: "save",
        expectedRevision: 2,
        terms: { ...terms, price: 2000 },
        reason: "Price changed",
      },
    }),
  ).toMatchObject({ plan: { status: "draft", revision: 3, price: 2000 } });
  expect(state.queries[3].sql).toContain('insert into "commercial_plan_revisions"');
  expect(state.queries[3].params).toContain(JSON.stringify({ ...terms, price: 2000 }));
  expect(state.queries[5].params).toContain("commerce.plan_save");
  expect(state.queries.some((q) => q.sql.startsWith('update "commercial_plan_revisions"'))).toBe(
    false,
  );
});
it("does not publish directly from archive", async () => {
  state.results = [[root("archived")], [["usr_admin", "admin"]]];
  await expect(
    plans.command({
      actorId: "usr_admin",
      planId: "cplan_a",
      auditId: "aud_a",
      command: { action: "publish", expectedRevision: 2, reason: "Terms checked" },
    }),
  ).rejects.toMatchObject({ code: "COMMERCIAL_PLAN_STATE_CHANGED" });
  expect(state.queries).toHaveLength(2);
});
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
  state.results = [[], [["ord_a", "pending", now]], [], [], [], [[cancelled]], [], []];
  expect(await operations.cancel(input)).toEqual({
    kind: "unpaid_order_cancelled",
    orderId: "ord_a",
    requestId: command.requestId,
    cancelledAt: new Date(cancelled),
  });
  expect(state.queries[0].sql).toContain("pg_advisory_xact_lock");
  expect(state.queries[1].sql).toContain("for no key update");
  expect(state.queries[5].sql).toContain("date_trunc('milliseconds'");
  expect(state.queries[6].sql).toContain('insert into "order_cancellation_receipts"');
  expect(state.queries[7].params).toContain("order.unpaid_cancelled");
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
    [["ord_a", now, command.reason, cancelled]],
  ];
  expect(await operations.cancel(input)).toMatchObject({ cancelledAt: new Date(cancelled) });
  expect(state.queries).toHaveLength(3);
});
it.each([{ reason: "Different reason" }, { expectedUpdatedAt: cancelled }])(
  "rejects reuse of a receipt key with different intent %j",
  (change) => {
    state.results = [
      [],
      [["ord_a", "cancelled", cancelled]],
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
    state.results = [[], [["ord_a", status, now]], []];
    return expect(operations.cancel(input)).rejects.toMatchObject({ code: "ORDER_STATE_CHANGED" });
  },
);
it("requires reconciliation even for a failed payment attempt", async () => {
  state.results = [[], [["ord_a", "pending", now]], [], [["pay_failed"]], []];
  await expect(operations.cancel(input)).rejects.toMatchObject({
    code: "ORDER_RECONCILIATION_REQUIRED",
  });
  expect(state.queries.some((q) => q.sql.startsWith("update"))).toBe(false);
});
it("requires reconciliation for an order financial entry without a payment attempt", async () => {
  state.results = [[], [["ord_a", "pending", now]], [], [], [["ledger_a"]]];
  await expect(operations.cancel(input)).rejects.toMatchObject({
    code: "ORDER_RECONCILIATION_REQUIRED",
  });
});
it("does not write a receipt after a failed compare-and-swap", async () => {
  state.results = [[], [["ord_a", "pending", now]], [], [], [], []];
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
