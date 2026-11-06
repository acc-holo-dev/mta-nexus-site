import { beforeEach, vi } from "vitest";

/** Shared pg-proxy query capture for resource-review-repository suites. */
export const resourceReviewRepositoryState = {
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][],
  clock: null as null | (() => void),
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createResourceReviewRepositoryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    resourceReviewRepositoryState.queries.push({ sql, params });
    resourceReviewRepositoryState.clock?.();
    return { rows: resourceReviewRepositoryState.rows.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return async (callback: (tx: typeof database) => unknown) => callback(database);
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
}

export function resetResourceReviewRepositoryState() {
  resourceReviewRepositoryState.queries = [];
  resourceReviewRepositoryState.rows = [];
  resourceReviewRepositoryState.clock = null;
  vi.useRealTimers();
}

export function installResourceReviewRepositoryHooks() {
  beforeEach(() => {
    resetResourceReviewRepositoryState();
  });
}

export const resourceReviewRepositoryProduct = [
  "prd_a",
  "Resource",
  "resource",
  "published",
  "usr_publisher",
  null,
];

export const resourceReviewRepositoryInput = {
  actorId: "usr_a",
  productId: "prd_a",
  reviewId: "cmt_a",
  auditId: "aud_a",
  command: {
    action: "save" as const,
    expectedRevision: 0,
    text: "Useful resource",
    rating: 5,
  },
};
