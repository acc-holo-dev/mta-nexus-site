import { getTableColumns } from "drizzle-orm";
import { beforeEach } from "vitest";
import { products } from "../../packages/db/src/schema";

/** Shared pg-proxy query capture for resource-commerce-repository suites. */
export const resourceCommerceRepositoryState = {
  queries: [] as { sql: string; params: unknown[] }[],
  results: [] as unknown[][][],
  options: [] as unknown[],
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createResourceCommerceRepositoryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const state = resourceCommerceRepositoryState;
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
}

export function resetResourceCommerceRepositoryState() {
  resourceCommerceRepositoryState.queries = [];
  resourceCommerceRepositoryState.results = [];
  resourceCommerceRepositoryState.options = [];
}

export function installResourceCommerceRepositoryHooks() {
  beforeEach(() => {
    resetResourceCommerceRepositoryState();
  });
}

export const resourceCommerceRepositoryRevision = new Date("2026-10-10T00:00:00Z");

export const resourceCommerceRepositoryProduct = {
  id: "prd_a",
  title: "Resource",
  slug: "resource",
  description: "Resource description",
  shortDescription: "",
  type: "script",
  status: "published",
  authorId: "usr_a",
  organizationId: null,
  price: 0,
  currency: "USD",
  licenseModel: "unlimited",
  tags: [],
  currentVersion: "1.0.0",
  ratingAverage: 0,
  ratingCount: 0,
  salesCount: 0,
  isFeatured: false,
  thumbnailUrl: null,
  screenshots: [],
  compatibility: {},
  createdAt: resourceCommerceRepositoryRevision.toISOString(),
  updatedAt: resourceCommerceRepositoryRevision.toISOString(),
};

export function resourceCommerceRepositoryProductRow(overrides = {}) {
  const data = {
    ...resourceCommerceRepositoryProduct,
    ...overrides,
  } as Record<string, unknown>;
  return Object.keys(getTableColumns(products)).map((key) => data[key]);
}

export const resourceCommerceRepositoryCommand = {
  productId: "prd_a",
  actorId: "usr_a",
  action: "archive" as const,
  expectedUpdatedAt: resourceCommerceRepositoryRevision,
  reason: "Withdraw release",
  auditId: "aud_a",
};
