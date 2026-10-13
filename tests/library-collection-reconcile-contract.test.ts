import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { libraryCollectionReconcilePreviewSchema } from "../packages/validation/src/library-collections";
const report = {
  schemaVersion: 1,
  generatedAt: "2026-10-13T00:00:00.000Z",
  collection: { id: "lcol_a", name: "Own", status: "active", revision: 1 },
  itemCount: 1,
  itemLimit: 200,
  batchLimit: 20,
  items: [
    {
      productId: "prd_a",
      title: null,
      available: false,
      inCollection: true,
      inManifest: false,
      canAdd: false,
      canRemove: true,
    },
  ],
};
it("strictly validates union membership and masks inaccessible labels", () => {
  expect(libraryCollectionReconcilePreviewSchema.safeParse(report).success).toBe(true);
  for (const body of [
    { ...report, itemCount: 2 },
    { ...report, ownerId: "other" },
    { ...report, items: [report.items[0], report.items[0]] },
    { ...report, items: [{ ...report.items[0], title: "private" }] },
    { ...report, items: [{ ...report.items[0], canAdd: true }] },
    { ...report, items: [{ ...report.items[0], inManifest: true }] },
    { ...report, items: [{ ...report.items[0], inCollection: false }] },
  ])
    expect(libraryCollectionReconcilePreviewSchema.safeParse(body).success).toBe(false);
});
it("retains prior immutable/move guards and adds bounded disjoint reconciliation postconditions", () => {
  const sql = readFileSync(
    "packages/db/migrations/0078_library_collection_reconciliation.sql",
    "utf8",
  );
  expect(sql).toContain("action='reconcile-items'");
  expect(sql).toContain("NOT BETWEEN 1 AND 20");
  expect(sql).toContain("count(DISTINCT value)");
  expect(sql).toContain("Reconciliation additions must match committed membership");
  expect(sql).toContain("Reconciliation removals must match committed membership");
  expect(sql).toContain("Collection command receipts are immutable");
  expect(sql).toContain("Move receipt must prove removal from its source");
  expect(sql).toContain("NEW.created_at:=clock_timestamp()");
});
