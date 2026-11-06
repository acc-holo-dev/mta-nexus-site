import { getTableColumns } from "drizzle-orm";
import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createResourceActivityRepositoryDbMock } = await import(
    "./helpers/resource-activity-repository-harness"
  );
  return createResourceActivityRepositoryDbMock();
});

import { ResourceActivityRepository } from "../packages/db/src/repositories/resource-activity";
import { OrderRepository } from "../packages/db/src/repositories/orders";
import { claimFreeResourceInTransaction } from "../packages/db/src/repositories/entitlements";
import { db } from "../packages/db/src/client";
import { entitlements } from "../packages/db/src/schema";
import {
  installResourceActivityRepositoryHooks,
  resourceActivityRepositoryNow as now,
  resourceActivityRepositoryState as state,
} from "./helpers/resource-activity-repository-harness";

const activity = new ResourceActivityRepository();

installResourceActivityRepositoryHooks();

it("scopes acquisition history before pagination and masks unavailable metadata", async () => {
  state.results = [
    [[21]],
    [["ent_a", "prd_a", "direct", now.toISOString(), null, null, false, false]],
  ];
  const result = await activity.buyerHistory("usr_buyer' --", 2, "direct");
  expect(result).toMatchObject({
    total: 21,
    page: 2,
    pageSize: 20,
    filter: "direct",
    items: [{ title: null, slug: null, hasCurrentAccess: false }],
  });
  expect(state.options).toEqual([{ isolationLevel: "repeatable read", accessMode: "read only" }]);
  expect(state.queries[0].params).toContain("usr_buyer' --");
  const query = state.queries[1];
  expect(query.sql).toContain('left join "products"');
  expect(query.sql).toContain("case when");
  expect(query.sql).toContain("else null end");
  expect(query.sql).toContain('"licenses"."status" = \'active\'');
  expect(query.sql).toContain('"entitlements"."expires_at" >');
  expect(query.sql).toContain('"builds"."scanner" is not null');
  expect(query.sql).not.toContain("usr_buyer' --");
  expect(query.sql).not.toContain('"licenses"."key"');
  expect(query.sql).not.toContain('"request_id"');
  expect(query.params.slice(-2)).toEqual([20, 20]);
});

it("holds live personal publisher authority and returns bounded UTC aggregates", async () => {
  state.results = [
    [["prd_a", "Title", "archived", "usr_author", null]],
    [["usr_author", "developer"]],
    [{ acquisitions: 3, direct: 1, cart: 2, retainedGrants: 2, downloadStarts: 4 }],
    [{ day: "2026-10-10", acquisitions: 1, downloadStarts: 2 }],
  ];
  expect(await activity.publisherReport("usr_author", "prd_a", 7)).toMatchObject({
    days: 7,
    from: new Date("2026-10-04T00:00:00Z"),
    through: now,
    acquisitions: 3,
    direct: 1,
    cart: 2,
    retainedGrants: 2,
    downloadStarts: 4,
  });
  expect(state.options).toEqual([{ isolationLevel: "repeatable read" }]);
  expect(state.queries[0].sql).toContain("for share");
  expect(state.queries[1].sql).toContain("for share");
  expect(state.queries[2].sql).toContain("product.download_started");
  expect(state.queries[2].sql).not.toContain('"actor_id"');
  expect(state.queries[3].sql).toContain("generate_series");
  expect(state.queries[3].sql).toContain("at time zone 'UTC'");
  expect(state.queries[3].params.at(-1)).toBe(7);
});

it("does not return organization activity to a historical author with no current grant", async () => {
  state.results = [
    [["prd_a", "Private", "published", "usr_author", "org_a"]],
    [["usr_owner"]],
    [["usr_author", "developer"]],
    [],
  ];
  await expect(activity.publisherReport("usr_author", "prd_a", 30)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  expect(state.queries).toHaveLength(4);
  expect(state.queries.some((q) => q.sql.includes("generate_series"))).toBe(false);
});

it("allows a current organization product manager and checks live membership", async () => {
  state.results = [
    [["prd_a", "Private", "published", "usr_author", "org_a"]],
    [["usr_owner"]],
    [["usr_manager", "user"]],
    [["member", ["manage_products"]]],
    [],
    [],
  ];
  expect(await activity.publisherReport("usr_manager", "prd_a")).toMatchObject({ acquisitions: 0 });
  expect(state.queries[3].params).toEqual(["org_a", "usr_manager", 1]);
  expect(state.queries[3].sql).toContain("for share");
});

it("excludes organization products and filters completed sales before limiting", async () => {
  await new OrderRepository().pageSellerHistory("usr_former_author");
  for (const q of state.queries) expect(q.sql).toContain('"products"."organization_id" is null');
  state.queries = [];
  await new OrderRepository().listSalesBySeller("usr_former_author", 999999);
  expect(state.queries[0].sql).toContain('"products"."organization_id" is null');
  expect(state.queries[0].params).toContain("completed");
  expect(state.queries[0].params.at(-1)).toBe(100);
});

it("records cart acquisition provenance in the same grant transaction", async () => {
  const value: Record<string, unknown> = {
    id: "ent_a",
    subjectType: "user",
    subjectId: "usr_buyer",
    permission: "product.download",
    resourceId: "prd_a",
    createdAt: now.toISOString(),
  };
  const grant = Object.keys(getTableColumns(entitlements)).map((key) => value[key] ?? null);
  state.results = [
    [],
    [["prd_a"]],
    [["published", 0]],
    [["bld_a"]],
    [],
    [],
    [["usr_buyer"]],
    [["ses_buyer", "2099-01-01T00:00:00.000Z"]],
    [grant],
    [],
    [],
  ];
  await db.transaction((tx) =>
    claimFreeResourceInTransaction(tx, {
      userId: "usr_buyer",
      currentToken: "buyer-session",
      productId: "prd_a",
      entitlementId: "ent_a",
      source: "cart",
      requestId: "request-a",
    }),
  );
  const event = state.queries.find((q) =>
    q.sql.startsWith('insert into "resource_acquisition_events"'),
  );
  expect(event?.params).toContain("cart");
  expect(event?.params).toContain("request-a");
  expect(state.queries.filter((q) => q.sql.startsWith('insert into "entitlements"'))).toHaveLength(
    1,
  );
  expect(state.queries.at(-1)?.sql).toContain('"sales_count"');
});
