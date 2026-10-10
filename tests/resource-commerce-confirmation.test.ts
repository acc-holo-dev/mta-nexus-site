import { expect, it } from "vitest";
import { canTransitionResource } from "@nexus/domain";
import {
  confirmedCartAcquisition,
  confirmedResourceCart,
} from "../apps/web/src/lib/resource-commerce-confirmation";
import { resourceCommerceError } from "../apps/web/src/lib/resource-commerce-i18n";

it("accepts only a confirmed acquisition of the exact selected resources", () => {
  const result = {
    kind: "free_resource_acquisition",
    acquired: [
      { productId: "a", alreadyClaimed: false },
      { productId: "b", alreadyClaimed: true },
    ],
  };
  expect(confirmedCartAcquisition(result, ["b", "a"])).toEqual(result);
  expect(confirmedCartAcquisition(result, ["a", "c"])).toBeNull();
  expect(
    confirmedCartAcquisition({ ...result, acquired: [result.acquired[0], result.acquired[0]] }, [
      "a",
      "b",
    ]),
  ).toBeNull();
  expect(
    confirmedCartAcquisition({ success: true, acquired: result.acquired }, ["a", "b"]),
  ).toBeNull();
});
it("rejects private metadata for unavailable cart resources", () => {
  const item = {
    productId: "prd_a",
    title: null,
    slug: null,
    version: null,
    available: false,
    alreadyOwned: true,
  };
  expect(confirmedResourceCart({ items: [item], limit: 20 })).toBeTruthy();
  expect(
    confirmedResourceCart({ items: [{ ...item, title: "Private draft" }], limit: 20 }),
  ).toBeNull();
  expect(confirmedResourceCart({ items: [item, item], limit: 20 })).toBeNull();
  expect(confirmedResourceCart({ items: [item], limit: 200 })).toBeNull();
});
it("cannot restore a suspended resource or publish directly", () => {
  for (const action of ["archive", "restore", "submit"] as const)
    expect(canTransitionResource("suspended", action)).toBe(false);
  expect(canTransitionResource("archived", "restore")).toBe(true);
  expect(canTransitionResource("archived", "submit")).toBe(false);
  expect(canTransitionResource("published", "submit")).toBe(false);
});
it("localizes server errors and hides unknown error text", () => {
  expect(resourceCommerceError("ru", "RESOURCE_CART_CHANGED")).toContain("другой вкладке");
  expect(resourceCommerceError("en", "DATABASE PASSWORD=private")).not.toContain("private");
});
