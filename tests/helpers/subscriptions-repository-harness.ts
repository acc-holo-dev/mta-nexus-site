import { createHash } from "node:crypto";
import { getTableColumns } from "drizzle-orm";
import { beforeEach } from "vitest";
import {
  accountSubscriptions,
  commercialPlans,
  subscriptionReceipts,
} from "../../packages/db/src/schema";
import {
  activation,
  date,
  plan,
  receipt,
  snapshot,
  subscription,
  terms,
} from "../subscriptions-fixtures";

/** Shared pg-proxy query capture for subscriptions-repository suites. */
export const subscriptionsRepositoryState = {
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][],
  options: [] as unknown[],
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createSubscriptionsRepositoryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    subscriptionsRepositoryState.queries.push({ sql, params });
    return { rows: subscriptionsRepositoryState.rows.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return async (fn: (tx: typeof database) => unknown, options: unknown) => {
            subscriptionsRepositoryState.options.push(options);
            return fn(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
}

export function resetSubscriptionsRepositoryState() {
  subscriptionsRepositoryState.rows = [];
  subscriptionsRepositoryState.queries = [];
  subscriptionsRepositoryState.options = [];
}

export function installSubscriptionsRepositoryHooks() {
  beforeEach(() => {
    resetSubscriptionsRepositoryState();
  });
}

export const subscriptionsRepositoryCurrentToken = "subscription-current-token";
export const subscriptionsRepositorySessionRow = () => [
  ["ses_subscription", new Date(Date.now() + 3600000).toISOString()],
];
export const subscriptionsRepositoryHash = (v: unknown) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");

export const subscriptionsRepositoryGrant = {
  ...subscription,
  actorId: "usr_a",
  termsSnapshot: terms,
} as typeof accountSubscriptions.$inferSelect;

export const subscriptionsRepositoryStored = {
  id: receipt.id,
  actorId: "usr_a",
  requestId: activation.requestId,
  subscriptionId: subscription.id,
  action: "activate",
  commandDigest: subscriptionsRepositoryHash({
    action: "activate",
    subjectType: "user",
    subjectId: "usr_a",
    planId: activation.planId,
    expectedRevision: 2,
  }),
  snapshot: snapshot(),
  createdAt: date,
} as typeof subscriptionReceipts.$inferSelect;

export function subscriptionsRepositoryValues(columns: object, row: object) {
  return Object.keys(columns).map((key) => {
    const v = (row as Record<string, unknown>)[key];
    return v instanceof Date ? v.toISOString() : (v ?? null);
  });
}

export const subscriptionsRepositoryGrantValues = (
  row = subscriptionsRepositoryGrant,
) => subscriptionsRepositoryValues(getTableColumns(accountSubscriptions), row);

export const subscriptionsRepositoryReceiptValues = (
  row = subscriptionsRepositoryStored,
) => subscriptionsRepositoryValues(getTableColumns(subscriptionReceipts), row);

export const subscriptionsRepositoryPlanValues = (row = plan) =>
  subscriptionsRepositoryValues(getTableColumns(commercialPlans), row);

export const subscriptionsRepositoryMutationHead = () =>
  [[], [], [], [], [["usr_a"]], []] as unknown[][];

export const subscriptionsRepositoryWrites = () =>
  subscriptionsRepositoryState.queries.filter((q) => /^(?:insert|update|delete)/u.test(q.sql));
