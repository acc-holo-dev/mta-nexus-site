import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createEntitlementAccessQueryDbMock } = await import(
    "./helpers/entitlement-access-query-harness"
  );
  return createEntitlementAccessQueryDbMock();
});

import { EntitlementRepository } from "../packages/db/src/repositories/entitlements";
import {
  entitlementAccessGrantRow,
  entitlementAccessQueryNow as now,
  entitlementAccessQueryState as state,
  expectAcquisitionAuthorizationOrder,
  expectQueryOrder,
  installEntitlementAccessQueryLifecycle,
  queryMatching,
} from "./helpers/entitlement-access-query-harness";

installEntitlementAccessQueryLifecycle();

const repository = new EntitlementRepository();
const grantRow = entitlementAccessGrantRow(now);

it("keeps the safe published build gate before checking or creating a claim", async () => {
  state.results = [[], [["resource"]], [["published", 0]], []];
  await expect(
    repository.claimFreeResource({
      currentToken: "claim-token",
      entitlementId: "new-entitlement",
      userId: "user",
      productId: "resource",
    }),
  ).rejects.toThrow("Resource is not currently available for download");
  const availability = queryMatching(/^select "status", "price" from "products" /u);
  const build = queryMatching(/^select "id" from "builds" /u);
  expect(build.params).toEqual(expect.arrayContaining(["resource", "published", "clean"]));
  expect(build.sql).toContain('"builds"."scanner" is not null');
  expect(build.sql).toContain('"builds"."scanned_at" is not null');
  expect(availability.sql).toContain("for no key update");
  expect(build.sql).toContain("for share");
  expect(build.sql).toContain('btrim("builds"."scanner") <> \'\'');
  expectQueryOrder(availability, build);
  expect(state.queries.some((query) => / from "(?:entitlements|licenses)" /u.test(query.sql))).toBe(
    false,
  );
  expect(state.queries.some((query) => /^(insert|update|delete)/u.test(query.sql))).toBe(false);
});

it("returns an existing full grant after the projected product and safe build checks", async () => {
  state.results = [
    [],
    [["resource"]],
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
  const availability = queryMatching(/^select "status", "price" from "products" /u);
  const build = queryMatching(/^select "id" from "builds" /u);
  const grant = queryMatching(/^select .* from "entitlements" /u);
  expect(grant.sql).toContain('"metadata"');
  expect(grant.params).toEqual([
    "user",
    "user",
    "resource",
    "product.download",
    now.toISOString(),
    1,
  ]);
  expect(grant.sql).toContain('"entitlements"."expires_at" > $5');
  expectQueryOrder(availability, build, grant);
  expectAcquisitionAuthorizationOrder();
  expect(state.queries.some((query) => / from "licenses" /u.test(query.sql))).toBe(false);
  expect(state.queries.some((query) => /^(insert|update|delete)/u.test(query.sql))).toBe(false);
});

it("locks a finite grant's legacy fallback before the actor and initiating session", async () => {
  const finiteGrant = [...grantRow];
  finiteGrant[5] = "2026-11-01T10:00:00Z";
  state.results = [
    [],
    [["resource"]],
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
  const grant = queryMatching(/^select .* from "entitlements" /u);
  const legacy = queryMatching(/^select "product_id", "expires_at" from "licenses" /u);
  expect(legacy.sql).toContain("for share");
  expect(legacy.sql).not.toContain('"key"');
  expectQueryOrder(grant, legacy);
  expectAcquisitionAuthorizationOrder();
  expect(state.queries.some((query) => /^(insert|update|delete)/u.test(query.sql))).toBe(false);
});

it("creates a full grant and increments the counter only after all preflight checks", async () => {
  const newRow = [...grantRow];
  newRow[0] = "new-entitlement";
  state.results = [
    [],
    [["resource"]],
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
  const session = expectAcquisitionAuthorizationOrder();
  const grant = queryMatching(/^insert into "entitlements" /u);
  expect(grant.sql).toContain('returning "id", "subject_type"');
  const event = queryMatching(/^insert into "resource_acquisition_events" /u);
  expect(event.params).toContain("new-entitlement");
  expect(event.params).toContain("direct");
  const counter = queryMatching(/^update "products" /u);
  expect(counter.sql).toContain('"products"."sales_count" + 1');
  expect(counter.params).toContain("resource");
  expectQueryOrder(session, grant, event, counter);
});

it.each([new Date("2026-11-01T10:00:00Z"), null])(
  "preserves existing license access without creating a permanent grant or acquisition",
  async (expiresAt) => {
    state.results = [
      [],
      [["resource"]],
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
    const query = queryMatching(/^select "product_id", "expires_at" from "licenses" /u);
    expectAcquisitionAuthorizationOrder();
    expect(query.sql).toContain("for share");
    expect(query.sql).not.toContain('"key"');
    expect(query.params).toContain("active");
    expect(query.params).toContain(now.toISOString());
    expect(
      state.queries.some((q) => q.sql.startsWith("insert") || q.sql.startsWith("update")),
    ).toBe(false);
  },
);
