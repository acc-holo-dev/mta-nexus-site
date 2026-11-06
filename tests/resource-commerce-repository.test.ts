import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createResourceCommerceRepositoryDbMock } = await import(
    "./helpers/resource-commerce-repository-harness"
  );
  return createResourceCommerceRepositoryDbMock();
});

import { ResourceCartRepository } from "../packages/db/src/repositories/resource-cart";
import {
  installResourceCommerceRepositoryHooks,
  resourceCommerceRepositoryState as state,
} from "./helpers/resource-commerce-repository-harness";

const cart = new ResourceCartRepository();

installResourceCommerceRepositoryHooks();

it("replays a durable acquisition without rereading the cart or mutating grants", async () => {
  const result = {
    kind: "free_resource_acquisition" as const,
    acquired: [{ productId: "prd_a", alreadyClaimed: false }],
  };
  state.results = [
    [],
    [[["prd_a"], result, "a".repeat(64)]],
    [["usr_a"]],
    [["ses", "2099-01-01T00:00:00Z"]],
  ];
  expect(
    await cart.acquire({
      userId: "usr_a",
      currentToken: "cart-token",
      productIds: ["prd_a"],
      requestId: "key",
      entitlementIds: ["ent_a"],
      auditId: "aud_a",
      reviewDigest: "a".repeat(64),
    }),
  ).toEqual({ ...result, requestId: "key" });
  expect(state.queries).toHaveLength(4);
  expect(state.queries[1].sql).toContain('"resource_cart_acquisitions"');
  expect(state.queries[1].params).toContain("usr_a");
});

it("refuses receipt key reuse for another selection", async () => {
  state.results = [
    [],
    [[["prd_other"], { kind: "free_resource_acquisition", acquired: [] }]],
    [["usr_a"]],
    [["ses", "2099-01-01T00:00:00Z"]],
  ];
  await expect(
    cart.acquire({
      userId: "usr_a",
      currentToken: "cart-token",
      productIds: ["prd_a"],
      requestId: "key",
      entitlementIds: ["ent_a"],
      auditId: "aud_a",
      reviewDigest: "a".repeat(64),
    }),
  ).rejects.toMatchObject({ code: "RESOURCE_CART_REQUEST_CONFLICT" });
  expect(state.queries).toHaveLength(4);
});

it("detects a second tab's added item before any grant is inserted", async () => {
  state.results = [[], [], [["prd_a"], ["prd_b"]]];
  await expect(
    cart.acquire({
      userId: "usr_a",
      currentToken: "cart-token",
      productIds: ["prd_a"],
      requestId: "key",
      entitlementIds: ["ent_a"],
      auditId: "aud_a",
      reviewDigest: "a".repeat(64),
    }),
  ).rejects.toMatchObject({ code: "RESOURCE_CART_CHANGED" });
  expect(state.queries.some((query) => query.sql.startsWith("insert"))).toBe(false);
});

it("serializes cart capacity and treats duplicate adds as a no-op", async () => {
  state.results = [[], [], [[20]]];
  await expect(cart.add("usr_a", "prd_a", "cart-token")).rejects.toMatchObject({
    code: "RESOURCE_CART_FULL",
  });
  expect(state.queries.some((query) => query.sql.startsWith("insert"))).toBe(false);
  state.queries = [];
  state.results = [[], [["prd_a"]], [["usr_a"]], [["ses", "2099-01-01T00:00:00Z"]]];
  await cart.add("usr_a", "prd_a", "cart-token");
  expect(state.queries).toHaveLength(4);
});

it("hides unavailable metadata and scopes every ownership probe to the buyer", async () => {
  await cart.get("usr_a");
  const query = state.queries[0];
  expect(query.sql).toContain("case when");
  expect(query.sql).toContain("else null end");
  expect(query.sql).toContain('"resource_cart_items"."user_id"');
  expect(query.sql).toContain('"licenses"."status" = \'active\'');
  expect(query.sql).not.toContain('"licenses"."key"');
  expect(query.params).toContain("usr_a");
  expect(query.sql).toContain("limit");
});
