import { expect, it } from "vitest";
import { libraryMembershipBatchCommandSchema } from "../packages/validation/src/library-collections";
import { confirmedMembershipBatch } from "../apps/web/src/lib/library-membership-batch-confirmation";
const requestId = "67ca0352-de64-4af9-9e54-7d3c56fe8d89",
  childUUID = "77ca0352-de64-4af9-9e54-7d3c56fe8d89";
const change = {
    collectionId: "lcol_a",
    expectedRevision: 2,
    wasInCollection: false,
    inCollection: true,
  },
  command = { requestId, changes: [change] },
  current = { id: "lcol_a", name: "Core", status: "active" as const, revision: 2 };
const body = () => ({
  replayed: false,
  receipt: {
    id: "lmb_a",
    requestId,
    productId: "prd_a",
    command,
    children: [
      {
        id: "lcr_a",
        requestId: childUUID,
        command: { requestId: childUUID, action: "add", productId: "prd_a", expectedRevision: 2 },
        collection: { ...current, revision: 3 },
        createdAt: "2026-10-12T00:00:00.000Z",
      },
    ],
    createdAt: "2026-10-12T00:00:01.000Z",
  },
});
it("canonicalizes distinct changed collections and rejects unchanged/oversized/injected commands", () => {
  const other = { ...change, collectionId: "lcol_b" };
  expect(
    libraryMembershipBatchCommandSchema.parse({
      requestId: requestId.toUpperCase(),
      changes: [other, change],
    }),
  ).toEqual({ requestId, changes: [change, other] });
  for (const value of [
    { ...command, userId: "other" },
    { requestId, changes: [change, change] },
    { requestId, changes: [{ ...change, wasInCollection: true }] },
    {
      requestId,
      changes: Array.from({ length: 21 }, (_, i) => ({ ...change, collectionId: `lcol_${i}` })),
    },
    { requestId, changes: [{ ...change, expectedRevision: 2147483647 }] },
  ])
    expect(libraryMembershipBatchCommandSchema.safeParse(value).success).toBe(false);
});
it("confirms exactly every reviewed collection successor", () => {
  expect(confirmedMembershipBatch(body(), "prd_a", command, [current])?.id).toBe("lmb_a");
});
it.each([
  "foreign-resource",
  "changed-name",
  "wrong-revision",
  "changed-action",
  "extra-child",
  "partial-child",
  "foreign-child-id",
  "unknown-field",
])("refuses incomplete/mismatched batch proof %s", (kind) => {
  const value = body();
  const child = value.receipt.children[0];
  if (!child) throw Error("Missing fixture child");
  if (kind === "foreign-resource") value.receipt.productId = "prd_other";
  if (kind === "changed-name") child.collection.name = "Other";
  if (kind === "wrong-revision") child.collection.revision = 9;
  if (kind === "changed-action") child.command.action = "remove";
  if (kind === "extra-child") value.receipt.children.push(child);
  if (kind === "partial-child") value.receipt.children = [];
  if (kind === "foreign-child-id") child.collection.id = "lcol_other";
  if (kind === "unknown-field") Object.assign(value.receipt, { storageKey: "private" });
  expect(confirmedMembershipBatch(value, "prd_a", command, [current])).toBeNull();
});
