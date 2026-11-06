import { expect } from "vitest";

/** Shared pg-proxy query capture for entitlement-access repository suites. */
export const entitlementAccessQueryState = {
  queries: [] as { sql: string; params: unknown[] }[],
  results: [] as unknown[][][],
  failure: null as Error | null,
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createEntitlementAccessQueryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    entitlementAccessQueryState.queries.push({ sql, params });
    if (entitlementAccessQueryState.failure) throw entitlementAccessQueryState.failure;
    return { rows: entitlementAccessQueryState.results.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        // This only records transaction SQL; lock/concurrency acceptance uses real PostgreSQL tests.
        if (key === "transaction")
          return async (callback: (tx: typeof database) => unknown) => callback(database);
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
}

export function resetEntitlementAccessQueryState() {
  entitlementAccessQueryState.queries = [];
  entitlementAccessQueryState.results = [];
  entitlementAccessQueryState.failure = null;
}

export const entitlementAccessQueryNow = new Date("2026-10-09T10:00:00Z");

export function queryMatching(pattern: RegExp) {
  const query = entitlementAccessQueryState.queries.find((item) => pattern.test(item.sql));
  if (!query) throw new Error(`Missing expected query: ${pattern.source}`);
  return query;
}

export function expectQueryOrder(
  ...queries: (typeof entitlementAccessQueryState.queries)[number][]
) {
  for (let index = 1; index < queries.length; index++)
    expect(entitlementAccessQueryState.queries.indexOf(queries[index - 1])).toBeLessThan(
      entitlementAccessQueryState.queries.indexOf(queries[index]),
    );
}

export function expectAcquisitionAuthorizationOrder() {
  const parent = queryMatching(/^select "id" from "products" /u);
  const availability = queryMatching(/^select "status", "price" from "products" /u);
  const build = queryMatching(/^select "id" from "builds" /u);
  const actor = queryMatching(/^select "id" from "users" /u);
  const session = queryMatching(/^select "id", "expires_at" from "sessions" /u);
  expect(actor.sql).toContain("for share");
  expect(session.sql).toContain("for update");
  const accessQueries = entitlementAccessQueryState.queries.filter((query) =>
    / from "(?:entitlements|licenses)" /u.test(query.sql),
  );
  expect(accessQueries.length).toBeGreaterThan(0);
  for (const query of accessQueries) {
    expect(query.sql).toContain("for share");
    expectQueryOrder(parent, availability, build, query, actor, session);
  }
  return session;
}

export const entitlementGrantRow = [
  "existing-entitlement",
  "user",
  "user",
  "product.download",
  "resource",
  null,
  "{}",
  entitlementAccessQueryNow.toISOString(),
];
