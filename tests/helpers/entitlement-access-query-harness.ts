import { afterEach, beforeEach, expect, vi } from "vitest";

type QueryRecord = { sql: string; params: unknown[] };

/** Shared pg-proxy capture for entitlement access / claim repository suites. */
export const entitlementAccessQueryState = {
  queries: [] as QueryRecord[],
  results: [] as unknown[][][],
  failure: null as Error | null,
};

function resetEntitlementAccessQueryState() {
  const state = entitlementAccessQueryState;
  state.queries = [];
  state.results = [];
  state.failure = null;
}

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createEntitlementAccessQueryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const state = entitlementAccessQueryState;
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    if (state.failure) throw state.failure;
    return { rows: state.results.shift() ?? [] };
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

export const entitlementAccessQueryNow = new Date("2026-10-09T10:00:00Z");

export function queryMatching(pattern: RegExp) {
  const state = entitlementAccessQueryState;
  const query = state.queries.find((item) => pattern.test(item.sql));
  if (!query) throw new Error(`Missing expected query: ${pattern.source}`);
  return query;
}

export function expectQueryOrder(...queries: QueryRecord[]) {
  const state = entitlementAccessQueryState;
  for (let index = 1; index < queries.length; index++)
    expect(state.queries.indexOf(queries[index - 1])).toBeLessThan(
      state.queries.indexOf(queries[index]),
    );
}

export function expectAcquisitionAuthorizationOrder() {
  const state = entitlementAccessQueryState;
  const parent = queryMatching(/^select "id" from "products" /u);
  const availability = queryMatching(/^select "status", "price" from "products" /u);
  const build = queryMatching(/^select "id" from "builds" /u);
  const actor = queryMatching(/^select "id" from "users" /u);
  const session = queryMatching(/^select "id", "expires_at" from "sessions" /u);
  expect(actor.sql).toContain("for share");
  expect(session.sql).toContain("for update");
  const accessQueries = state.queries.filter((query) =>
    / from "(?:entitlements|licenses)" /u.test(query.sql),
  );
  expect(accessQueries.length).toBeGreaterThan(0);
  for (const query of accessQueries) {
    expect(query.sql).toContain("for share");
    expectQueryOrder(parent, availability, build, query, actor, session);
  }
  return session;
}

export function entitlementAccessGrantRow(now: Date) {
  return [
    "existing-entitlement",
    "user",
    "user",
    "product.download",
    "resource",
    null,
    "{}",
    now.toISOString(),
  ] as const;
}

export function installEntitlementAccessQueryLifecycle() {
  beforeEach(() => {
    resetEntitlementAccessQueryState();
    vi.useFakeTimers();
    vi.setSystemTime(entitlementAccessQueryNow);
  });
  afterEach(() => {
    vi.useRealTimers();
  });
}
