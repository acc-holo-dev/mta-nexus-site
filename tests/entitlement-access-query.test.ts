import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createEntitlementAccessQueryDbMock } = await import(
    "./helpers/entitlement-access-query-harness"
  );
  return createEntitlementAccessQueryDbMock();
});

import { EntitlementRepository } from "../packages/db/src/repositories/entitlements";
import {
  entitlementAccessQueryNow as now,
  entitlementAccessQueryState as state,
  expectQueryOrder,
  installEntitlementAccessQueryLifecycle,
  queryMatching,
} from "./helpers/entitlement-access-query-harness";

installEntitlementAccessQueryLifecycle();

const repository = new EntitlementRepository();

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
  state.results = [[], [["resource"]], productRows as unknown[][]];
  await expect(
    repository.claimFreeResource({
      currentToken: "claim-token",
      entitlementId: "new-entitlement",
      userId: "user",
      productId: "resource",
    }),
  ).rejects.toThrow(message);
  const advisory = queryMatching(/pg_advisory_xact_lock\(hashtext\(\$1\)\)/u);
  expect(advisory.params).toEqual(["free-resource:user:resource"]);
  const parent = queryMatching(/^select "id" from "products" /u);
  expect(parent.sql).toContain("for no key update");
  const availability = queryMatching(/^select "status", "price" from "products" /u);
  expect(availability.params).toEqual(["resource", 1]);
  expectQueryOrder(advisory, parent, availability);
  expect(
    state.queries.some((query) => / from "(?:builds|entitlements|licenses)" /u.test(query.sql)),
  ).toBe(false);
  expect(state.queries.some((query) => /^(insert|update|delete)/u.test(query.sql))).toBe(false);
});
