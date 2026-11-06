import { createHash } from "node:crypto";
import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createLibraryCollectionReceiptDetailRepositoryDbMock } = await import(
    "./helpers/library-collection-receipt-detail-repository-harness"
  );
  return createLibraryCollectionReceiptDetailRepositoryDbMock();
});

import { readLibraryCollectionReceiptDetail } from "../packages/db/src/repositories/library-collection-receipt-detail";
import { libraryCollectionCommandSchema } from "../packages/validation/src/library-collections";
import {
  installLibraryCollectionReceiptDetailRepositoryHooks,
  libraryCollectionReceiptDetailRepositoryCommand as command,
  libraryCollectionReceiptDetailRepositoryPrefix as prefix,
  libraryCollectionReceiptDetailRepositoryRequestId as requestId,
  libraryCollectionReceiptDetailRepositoryRow as row,
  libraryCollectionReceiptDetailRepositorySnapshot as snapshot,
  libraryCollectionReceiptDetailRepositoryState as state,
} from "./helpers/library-collection-receipt-detail-repository-harness";

installLibraryCollectionReceiptDetailRepositoryHooks();

it.each(["digest", "hidden", "identity", "request", "future"])(
  "neutralizes malformed immutable proof before current metadata lookups: %s",
  async (kind) => {
    const proof = row();
    if (kind === "digest") proof[3] = "0".repeat(64);
    if (kind === "hidden") proof[4] = { ...command, storageKey: "PRIVATE" };
    if (kind === "identity") proof[5] = { ...snapshot, id: "lcol_foreign" };
    if (kind === "request") proof[1] = "77ca0352-de64-4af9-9e54-7d3c56fe8d89";
    if (kind === "future") proof[4] = { requestId, action: "future-action" };
    state.rows = [...prefix(), [proof]];
    const report = await readLibraryCollectionReceiptDetail("usr_a", "lcr_a");
    expect(report).toMatchObject({
      receipt: null,
      currentCollection: null,
      restoration: null,
      resources: [],
    });
    expect(state.queries).toHaveLength(3);
    expect(JSON.stringify(report)).not.toContain("PRIVATE");
  },
);
it("does not invent reversible state for ordinary add/remove receipts with unknown prior membership", async () => {
  const proof = libraryCollectionCommandSchema.parse({
    requestId,
    action: "add",
    productId: "prd_a",
    expectedRevision: 2,
  });
  state.rows = [
    ...prefix(),
    [row(proof, createHash("sha256").update(JSON.stringify(proof)).digest("hex"))],
    [["lcol_a", "Current", "active", 9]],
  ];
  const report = await readLibraryCollectionReceiptDetail("usr_a", "lcr_a");
  expect(report.receipt?.command).toEqual(proof);
  expect(report.restoration).toBeNull();
  expect(state.queries).toHaveLength(4);
});
it("rejects foreign/unknown receipt IDs and deleted actors before resource inspection", async () => {
  await expect(readLibraryCollectionReceiptDetail("usr_a", "../private")).rejects.toMatchObject({
    statusCode: 400,
  });
  expect(state.queries).toHaveLength(0);
  state.rows = [...prefix(), []];
  await expect(readLibraryCollectionReceiptDetail("usr_a", "lcr_foreign")).rejects.toMatchObject({
    statusCode: 404,
  });
  expect(state.queries).toHaveLength(3);
  state.queries = [];
  state.rows = [[]];
  await expect(readLibraryCollectionReceiptDetail("usr_deleted", "lcr_a")).rejects.toMatchObject({
    statusCode: 404,
  });
  expect(state.queries).toHaveLength(1);
});
it("preserves proof with a missing current collection and rejects invalid snapshot time/count", async () => {
  state.rows = [...prefix(), [row()], []];
  expect((await readLibraryCollectionReceiptDetail("usr_a", "lcr_a")).receipt?.collection).toEqual(
    snapshot,
  );
  state.rows = [[["usr_a"]], [{ observedAt: "invalid" }]];
  await expect(readLibraryCollectionReceiptDetail("usr_a", "lcr_a")).rejects.toMatchObject({
    code: "COLLECTION_SNAPSHOT_INVALID",
  });
  state.rows = [
    ...prefix(),
    [row()],
    [["lcol_a", "Current", "active", 9]],
    Array.from({ length: 201 }, (_, i) => [`prd_${i}`]),
  ];
  await expect(readLibraryCollectionReceiptDetail("usr_a", "lcr_a")).rejects.toMatchObject({
    code: "COLLECTION_SNAPSHOT_INVALID",
  });
});
