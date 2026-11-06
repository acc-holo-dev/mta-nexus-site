import { beforeEach } from "vitest";

/** Shared pg-proxy query capture for plan-reviews-repository suites. */
export const planReviewsRepositoryState = {
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  options: [] as unknown[],
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createPlanReviewsRepositoryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const state = planReviewsRepositoryState;
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

function resetPlanReviewsRepositoryState() {
  planReviewsRepositoryState.queries = [];
  planReviewsRepositoryState.rows = [];
  planReviewsRepositoryState.options = [];
}

export function installPlanReviewsRepositoryHooks() {
  beforeEach(() => {
    resetPlanReviewsRepositoryState();
  });
}

export const planReviewsRepositoryDate = "2026-10-11T00:00:00.000Z";

export const planReviewsRepositoryTerms = {
  titleRu: "Тариф",
  titleEn: "Plan",
  descriptionRu: "Описание тарифа",
  descriptionEn: "Plan description",
  price: 900,
  currency: "USD" as const,
  durationDays: 30 as const,
  commissionBps: 750,
};

export const planReviewsRepositoryCommand = {
  requestId: "11111111-1111-4111-8111-111111111111",
  planId: "cplan_a",
  expectedRevision: 2,
  grossAmount: 10000,
  currency: "RUB" as const,
};

export const planReviewsRepositoryRow = [
  "prev_a",
  "usr_a",
  planReviewsRepositoryCommand.requestId,
  "user",
  "usr_a",
  "cplan_a",
  2,
  10000,
  "RUB",
  planReviewsRepositoryTerms,
  planReviewsRepositoryDate,
];

export const planReviewsRepositoryPlan = [
  "cplan_a",
  "plan",
  "user",
  "published",
  2,
  planReviewsRepositoryDate,
  planReviewsRepositoryDate,
];

export const planReviewsRepositorySession = [
  ["ses_current", new Date(Date.now() + 3600000).toISOString()],
];
