import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createLibraryCollectionReceiptDetailRepositoryDbMock } = await import(
    "./helpers/library-collection-receipt-detail-repository-harness"
  );
  return createLibraryCollectionReceiptDetailRepositoryDbMock();
});

import { readLibraryCollectionReceiptDetail } from "../packages/db/src/repositories/library-collection-receipt-detail";
import {
  installLibraryCollectionReceiptDetailRepositoryHooks,
  libraryCollectionReceiptDetailRepositoryPrefix as prefix,
  libraryCollectionReceiptDetailRepositoryRow as row,
  libraryCollectionReceiptDetailRepositorySnapshot as snapshot,
  libraryCollectionReceiptDetailRepositoryState as state,
  libraryCollectionReceiptDetailRepositoryText as text,
} from "./helpers/library-collection-receipt-detail-repository-harness";

installLibraryCollectionReceiptDetailRepositoryHooks();

it("offers only exact inverse differences while retaining all unrelated current references", async () => {
  state.rows = [
    ...prefix(),
    [row()],
    [["lcol_a", "Later", "active", 9]],
    [["prd_added"], ["prd_later"]],
    [
      {
        productId: "prd_added",
        title: "PRIVATE",
        available: false,
        hasAccess: false,
        storageKey: "PRIVATE",
      },
      { productId: "prd_removed", title: "Accessible", available: true, hasAccess: true },
    ],
  ];
  const report = await readLibraryCollectionReceiptDetail("usr_a", "lcr_a");
  expect(report.receipt?.collection).toEqual(snapshot);
  expect(report.currentCollection).toMatchObject({ name: "Later", revision: 9 });
  expect(report.resources).toEqual([
    {
      productId: "prd_added",
      currentTitle: null,
      currentAvailable: false,
      inCollection: true,
      restoreAction: "remove",
      status: "ready",
    },
    {
      productId: "prd_removed",
      currentTitle: "Accessible",
      currentAvailable: true,
      inCollection: false,
      restoreAction: "add",
      status: "ready",
    },
  ]);
  expect(report.restoration?.items).toEqual([
    {
      productId: "prd_added",
      title: null,
      available: false,
      inCollection: true,
      canAdd: false,
      canRemove: true,
    },
    {
      productId: "prd_later",
      title: null,
      available: false,
      inCollection: true,
      canAdd: false,
      canRemove: false,
    },
    {
      productId: "prd_removed",
      title: "Accessible",
      available: true,
      inCollection: false,
      canAdd: true,
      canRemove: false,
    },
  ]);
  expect(JSON.stringify(report)).not.toContain("PRIVATE");
  expect(state.queries).toHaveLength(6);
  expect(state.queries[2]?.params).toEqual(["usr_a", "lcr_a", 1]);
  expect(state.queries[3]?.params).toContain("usr_a");
  expect(state.queries[4]?.params.at(-1)).toBe(201);
  expect(state.options).toEqual([{ isolationLevel: "repeatable read", accessMode: "read only" }]);
  expect(text()).toContain("transaction_timestamp()");
  expect(text()).toContain("'product.download'");
  expect(text()).toContain("'published'");
  expect(state.queries.at(-1)?.params).toContain("clean");
  expect(text()).not.toMatch(/insert into|update |delete from|for update/iu);
});
it("allows reviewing an inverse whose projected count exceeds capacity without proposing unrelated removals", async () => {
  const refs = Array.from({ length: 200 }, (_, i) => [`prd_unrelated_${i}`]);
  state.rows = [
    ...prefix(),
    [row()],
    [["lcol_a", "Current", "active", 9]],
    refs,
    [{ productId: "prd_removed", title: "Accessible", available: true, hasAccess: true }],
  ];
  const report = await readLibraryCollectionReceiptDetail("usr_a", "lcr_a");
  expect(report.restoration?.itemCount).toBe(200);
  expect(report.restoration?.items.filter((item) => item.canAdd)).toHaveLength(1);
  expect(report.restoration?.items.filter((item) => item.canRemove)).toHaveLength(0);
  expect(report.resources[0]?.status).toBe("already-restored");
  expect(report.restoration?.items).toHaveLength(202);
});
it("marks restored references as already desired and masks lost-access restoration candidates", async () => {
  state.rows = [
    ...prefix(),
    [row()],
    [["lcol_a", "Current", "active", 9]],
    [],
    [{ productId: "prd_removed", title: "PRIVATE", available: false, hasAccess: false }],
  ];
  const report = await readLibraryCollectionReceiptDetail("usr_a", "lcr_a");
  expect(report.resources.map((item) => item.status)).toEqual(["already-restored", "no-access"]);
  expect(report.restoration?.items.every((item) => !item.canAdd && !item.canRemove)).toBe(true);
  expect(JSON.stringify(report)).not.toContain("PRIVATE");
});
it.each([
  ["archived", 9],
  ["active", 2147483647],
] as const)(
  "keeps archived/terminal proof readable without enabling changes: %s/%s",
  async (status, revision) => {
    state.rows = [
      ...prefix(),
      [row()],
      [["lcol_a", "Current", status, revision]],
      [["prd_added"]],
      [{ productId: "prd_removed", title: "Accessible", available: true, hasAccess: true }],
    ];
    const report = await readLibraryCollectionReceiptDetail("usr_a", "lcr_a");
    expect(report.resources.every((item) => item.status === "read-only")).toBe(true);
    expect(report.restoration?.items.every((item) => !item.canAdd && !item.canRemove)).toBe(true);
  },
);
