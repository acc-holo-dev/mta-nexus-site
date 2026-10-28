import { afterEach, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  results: [] as unknown[][][],
  failure: null as Error | null,
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    if (state.failure) throw state.failure;
    return { rows: state.results.shift() ?? [] };
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
});

import { EntitlementRepository } from "../packages/db/src/repositories/entitlements";

const repository = new EntitlementRepository();
const now = new Date("2026-10-09T10:00:00Z");
beforeEach(() => {
  state.queries = [];
  state.results = [];
  state.failure = null;
  vi.useFakeTimers();
  vi.setSystemTime(now);
});
afterEach(() => {
  vi.useRealTimers();
});

it.each(["user", "server", "organization"] as const)(
  "reads one ID for a direct %s entitlement and skips license fallback",
  async (type) => {
    state.results = [[["entitlement-1"]]];
    expect(
      await repository.hasEntitlement({ type, id: "subject-1" }, "resource-1", "module.runtime"),
    ).toBe(true);
    expect(state.queries).toHaveLength(1);
    expect(state.queries[0].sql).toMatch(/^select "id" from "entitlements" /);
    expect(state.queries[0].params).toEqual([
      type,
      "subject-1",
      "resource-1",
      "module.runtime",
      now.toISOString(),
      1,
    ]);
    expect(state.queries[0].sql).toContain('"entitlements"."expires_at" is null');
    expect(state.queries[0].sql).toContain('"entitlements"."expires_at" > $5');
  },
);

it.each(["server", "organization"] as const)(
  "denies an absent %s entitlement without checking user licenses",
  async (type) => {
    expect(
      await repository.hasEntitlement({ type, id: "subject-1" }, "resource-1", "product.download"),
    ).toBe(false);
    expect(state.queries).toHaveLength(1);
  },
);

it.each([
  ["product.download", true, true],
  ["product.update", true, true],
  ["module.runtime", true, false],
  ["module.runtime", false, false],
  ["custom.permission", true, false],
] as const)(
  "checks matching active license rights for %s (match=%s)",
  async (permission, matches, implicit) => {
    state.results = [[], matches ? [["matching-license"]] : []];
    expect(
      await repository.hasEntitlement({ type: "user", id: "user-1" }, "resource-1", permission),
    ).toBe(matches);
    expect(state.queries).toHaveLength(2);
    const query = state.queries[1];
    expect(query.sql).toMatch(/^select "id" from "licenses" /);
    expect(query.sql).toContain('"licenses"."expires_at" is null');
    expect(query.sql).toContain('"licenses"."expires_at" > $4');
    expect(query.sql).not.toContain('"key"');
    expect(query.sql).not.toContain('select "entitlements"');
    if (implicit) {
      expect(query.params).toEqual(["user-1", "resource-1", "active", now.toISOString(), 1]);
      expect(query.sql).not.toContain(" @> ");
    } else {
      expect(query.params).toEqual([
        "user-1",
        "resource-1",
        "active",
        now.toISOString(),
        JSON.stringify([permission]),
        1,
      ]);
      expect(query.sql).toContain('"licenses"."entitlements" @> $5::jsonb');
      expect(query.sql).toContain("limit $6");
    }
  },
);

it("binds an unusual license permission as JSON data rather than SQL source", async () => {
  const permission = "module.runtime' OR TRUE --";
  state.results = [[], []];
  expect(
    await repository.hasEntitlement({ type: "user", id: "user-1" }, "resource-1", permission),
  ).toBe(false);
  const query = state.queries[1];
  expect(query.params).toContain(JSON.stringify([permission]));
  expect(query.sql).not.toContain(permission);
  expect(query.sql).toContain('"licenses"."entitlements" @> $5::jsonb');
});

it("denies missing direct grants and licenses and safely binds unusual identifiers", async () => {
  const subject = "user_' --";
  expect(
    await repository.hasEntitlement(
      { type: "user", id: subject },
      "resource_' --",
      "permission_' --",
    ),
  ).toBe(false);
  expect(state.queries).toHaveLength(2);
  expect(state.queries[0].params).toContain(subject);
  expect(state.queries[1].params).toContain(subject);
  for (const query of state.queries) expect(query.sql).not.toContain(subject);
});

it("propagates a database error without granting access or querying the fallback", async () => {
  state.failure = new Error("Database unavailable");
  await expect(
    repository.hasEntitlement({ type: "user", id: "user" }, "resource", "product.download"),
  ).rejects.toThrow();
  expect(state.queries).toHaveLength(1);
});

it.each([
  [[], "was not found"],
  [[["draft", 0]], "was not found"],
  [[["published", 500]], "Only free resources can be claimed without a payment provider"],
])("reads only status and price and rejects an unavailable claim", async (productRows, message) => {
  state.results = [[], productRows as unknown[][]];
  await expect(
    repository.claimFreeResource({
      currentToken: "claim-token",
      entitlementId: "new-entitlement",
      userId: "user",
      productId: "resource",
    }),
  ).rejects.toThrow(message);
  expect(state.queries).toHaveLength(2);
  expect(state.queries[0].sql).toContain("pg_advisory_xact_lock(hashtext($1))");
  expect(state.queries[0].params).toEqual(["free-resource:user:resource"]);
  expect(state.queries[1].sql).toMatch(/^select "status", "price" from "products" /);
  expect(state.queries[1].params).toEqual(["resource", 1]);
});

it("keeps the safe published build gate before checking or creating a claim", async () => {
  state.results = [[], [["published", 0]], []];
  await expect(
    repository.claimFreeResource({
      currentToken: "claim-token",
      entitlementId: "new-entitlement",
      userId: "user",
      productId: "resource",
    }),
  ).rejects.toThrow("Resource is not currently available for download");
  expect(state.queries).toHaveLength(3);
  expect(state.queries[2].sql).toMatch(/^select "id" from "builds" /);
  expect(state.queries[2].params).toContain("resource");
  expect(state.queries[2].params).toContain("published");
  expect(state.queries[2].params).toContain("clean");
  expect(state.queries[2].sql).toContain('"builds"."scanner" is not null');
  expect(state.queries[2].sql).toContain('"builds"."scanned_at" is not null');
  expect(state.queries[1].sql).toContain("for no key update");
  expect(state.queries[2].sql).toContain("for share");
  expect(state.queries[2].sql).toContain('btrim("builds"."scanner") <> \'\'');
  expect(state.queries.some((query) => /^(insert|update|delete)/u.test(query.sql))).toBe(false);
});

const grantRow = [
  "existing-entitlement",
  "user",
  "user",
  "product.download",
  "resource",
  null,
  "{}",
  now.toISOString(),
];
it("returns an existing full grant after the projected product and safe build checks", async () => {
  state.results = [
    [],
    [["published", 0]],
    [["safe-build"]],
    [grantRow],
    [["user"]],
    [["ses", "2099-01-01T00:00:00Z"]],
  ];
  expect(
    await repository.claimFreeResource({
      currentToken: "claim-token",
      entitlementId: "unused-id",
      userId: "user",
      productId: "resource",
    }),
  ).toMatchObject({
    alreadyClaimed: true,
    entitlement: {
      id: "existing-entitlement",
      subjectType: "user",
      subjectId: "user",
      resourceId: "resource",
      permission: "product.download",
      expiresAt: null,
      metadata: {},
      createdAt: now,
    },
  });
  expect(state.queries).toHaveLength(6);
  expect(state.queries[3].sql).toContain('"metadata"');
  expect(state.queries[3].params).toEqual([
    "user",
    "user",
    "resource",
    "product.download",
    now.toISOString(),
    1,
  ]);
  expect(state.queries[3].sql).toContain('"entitlements"."expires_at" > $5');
});

it("locks a finite grant's legacy fallback before the actor and initiating session", async () => {
  const finiteGrant = [...grantRow];
  finiteGrant[5] = "2026-11-01T10:00:00Z";
  state.results = [
    [],
    [["published", 0]],
    [["safe-build"]],
    [finiteGrant],
    [["resource", null]],
    [["user"]],
    [["ses", "2099-01-01T00:00:00Z"]],
  ];
  expect(
    await repository.claimFreeResource({
      currentToken: "claim-token",
      entitlementId: "unused-id",
      userId: "user",
      productId: "resource",
    }),
  ).toMatchObject({ alreadyClaimed: true, accessSource: "entitlement" });
  expect(state.queries).toHaveLength(7);
  expect(state.queries[4].sql).toMatch(/^select "product_id", "expires_at" from "licenses" /);
  expect(state.queries[4].sql).toContain("for share");
  expect(state.queries[4].sql).not.toContain('"key"');
  expect(state.queries[5].sql).toContain('from "users"');
  expect(state.queries[6].sql).toContain('from "sessions"');
});

it("creates a full grant and increments the counter only after all preflight checks", async () => {
  const newRow = [...grantRow];
  newRow[0] = "new-entitlement";
  state.results = [
    [],
    [["published", 0]],
    [["safe-build"]],
    [],
    [],
    [["user"]],
    [["ses", "2099-01-01T00:00:00Z"]],
    [newRow],
    [],
    [],
  ];
  expect(
    await repository.claimFreeResource({
      currentToken: "claim-token",
      entitlementId: "new-entitlement",
      userId: "user",
      productId: "resource",
    }),
  ).toMatchObject({
    alreadyClaimed: false,
    entitlement: { id: "new-entitlement", resourceId: "resource" },
  });
  expect(state.queries).toHaveLength(10);
  expect(state.queries[7].sql).toMatch(/^insert into "entitlements" /);
  expect(state.queries[7].sql).toContain('returning "id", "subject_type"');
  expect(state.queries[8].sql).toMatch(/^insert into "resource_acquisition_events" /);
  expect(state.queries[8].params).toContain("new-entitlement");
  expect(state.queries[8].params).toContain("direct");
  expect(state.queries[9].sql).toContain('"products"."sales_count" + 1');
  expect(state.queries[9].params).toContain("resource");
});

it.each([new Date("2026-11-01T10:00:00Z"), null])(
  "preserves existing license access without creating a permanent grant or acquisition",
  async (expiresAt) => {
    state.results = [
      [],
      [["published", 0]],
      [["safe-build"]],
      [],
      [["resource", expiresAt?.toISOString() ?? null]],
      [["user"]],
      [["ses", "2099-01-01T00:00:00Z"]],
    ];
    expect(
      await repository.claimFreeResource({
        currentToken: "claim-token",
        entitlementId: "unused",
        userId: "user",
        productId: "resource",
      }),
    ).toEqual({
      entitlement: null,
      alreadyClaimed: true,
      accessSource: "license",
      license: { productId: "resource", expiresAt },
    });
    expect(state.queries).toHaveLength(7);
    const query = state.queries[4];
    expect(query.sql).toMatch(/^select "product_id", "expires_at" from "licenses" /);
    expect(query.sql).toContain("for share");
    expect(query.sql).not.toContain('"key"');
    expect(query.params).toContain("active");
    expect(query.params).toContain(now.toISOString());
    expect(
      state.queries.some((q) => q.sql.startsWith("insert") || q.sql.startsWith("update")),
    ).toBe(false);
  },
);
