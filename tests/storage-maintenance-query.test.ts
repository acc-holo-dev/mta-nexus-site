import { expect, it } from "vitest";
import {
  storageCleanupSchema,
  storageDiscoverySchema,
  storageOffset,
  storageParse,
  storageQuery,
} from "../apps/web/src/lib/storage-maintenance-query";

it("defaults to a private bounded inventory", () => {
  expect(storageQuery(new URLSearchParams())).toEqual({ page: 1, view: "all" });
  expect(storageOffset(new URLSearchParams())).toBe(0);
});
it.each(["page=0", "page=100000", "page=1&page=2", "view=unknown", "owner=usr_a"])(
  "rejects invalid list query %s",
  (query) => {
    expect(() => storageQuery(new URLSearchParams(query))).toThrow();
  },
);
it.each(["offset=-1", "offset=1.2", "offset=10001", "offset=0&offset=1", "extra=1"])(
  "rejects unsafe discovery query %s",
  (query) => {
    expect(() => storageOffset(new URLSearchParams(query))).toThrow();
  },
);
it("requires an explicit confirmation and a valid revision", () => {
  expect(() => storageParse(storageCleanupSchema, { expectedRevision: 1 })).toThrow();
  expect(() =>
    storageParse(storageCleanupSchema, {
      expectedRevision: 0,
      confirmation: "delete_unreferenced",
    }),
  ).toThrow();
  expect(
    storageParse(storageCleanupSchema, {
      expectedRevision: 1,
      confirmation: "delete_unreferenced",
    }),
  ).toMatchObject({ expectedRevision: 1 });
});
it("rejects caller-supplied object identities and namespace traversal", () => {
  expect(() =>
    storageParse(storageDiscoverySchema, { ownerId: "../outside", offset: 0 }),
  ).toThrow();
  expect(() =>
    storageParse(storageDiscoverySchema, { ownerId: "usr_a", offset: 0, sha256Hash: "forged" }),
  ).toThrow();
});
