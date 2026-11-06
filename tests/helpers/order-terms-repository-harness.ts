import { beforeEach } from "vitest";

/** Shared pg-proxy query capture for order-terms-repository suites. */
export const orderTermsRepositoryState = {
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  options: [] as unknown[],
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createOrderTermsRepositoryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const state = orderTermsRepositoryState;
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
}

export function resetOrderTermsRepositoryState() {
  orderTermsRepositoryState.queries = [];
  orderTermsRepositoryState.rows = [];
  orderTermsRepositoryState.options = [];
}

export function installOrderTermsRepositoryHooks() {
  beforeEach(() => {
    resetOrderTermsRepositoryState();
  });
}

export const orderTermsRepositoryDate = "2026-10-11T00:00:00Z";

export const orderTermsRepositoryTerms = {
  version: 1,
  recordedAt: "2026-10-11T00:00:00.000Z",
  product: { id: "prd_a", title: "Frozen", slug: "resource" },
  seller: { type: "user", id: "usr_seller" },
  line: { unitPrice: 100, currency: "USD" },
  baseline: { commissionBps: 1000, holdDays: 7, licenseModel: "single_server" },
};

export const orderTermsRepositoryRoot = [
  "ord_a",
  "NUMBER",
  "pending",
  100,
  "USD",
  orderTermsRepositoryDate,
];

export const orderTermsRepositoryInput = {
  id: "ord_a",
  buyerId: "usr_buyer",
  orderNumber: "NUMBER",
  status: "pending" as const,
  totalAmount: 100,
  currency: "USD",
  items: [{ id: "itm_a", orderId: "ord_a", productId: "prd_a", unitPrice: 100, currency: "USD" }],
};
