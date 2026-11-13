import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { confirmedCollectionCommand } from "../../site/src/lib/library-collections-confirmation";
import { libraryCollectionCommandSchema } from "../../packages/validation/src/library-collections";
import {
  libraryCollectionsContractCurrent as current,
  libraryCollectionsContractRequestId as requestId,
} from "../helpers/library-collections-contract-harness";

it("binds an independent copy to reviewed source, count, digest, UUID and new name", () => {
  const command = {
    requestId,
    action: "duplicate" as const,
    sourceCollectionId: current.id,
    expectedRevision: 4,
    expectedItemCount: 200,
    sourceDigest: "a".repeat(64),
    name: "Copy",
  };
  expect(libraryCollectionCommandSchema.parse(command)).toEqual(command);
  for (const change of [
    { sourceCollectionId: "../other" },
    { sourceDigest: "a".repeat(63) },
    { sourceDigest: "A".repeat(64) },
    { expectedItemCount: 201 },
    { expectedItemCount: -1 },
    { expectedItemCount: 0.5 },
    { expectedRevision: 0 },
    { userId: "usr_other" },
    { productIds: ["prd_a"] },
  ])
    expect(libraryCollectionCommandSchema.safeParse({ ...command, ...change }).success).toBe(false);
  const body = {
    replayed: true,
    receipt: {
      id: "lcr_copy",
      requestId,
      command,
      collection: { id: "lcol_copy", name: "Copy", status: "active", revision: 1 },
      createdAt: "2026-10-12T00:00:00.000Z",
    },
  };
  expect(confirmedCollectionCommand(body, command, current)).toBe("lcol_copy");
  for (const change of [
    { id: current.id },
    { revision: 2 },
    { status: "archived" },
    { name: "Other" },
  ])
    expect(
      confirmedCollectionCommand(
        {
          ...body,
          receipt: { ...body.receipt, collection: { ...body.receipt.collection, ...change } },
        },
        command,
        current,
      ),
    ).toBeNull();
  expect(confirmedCollectionCommand(body, command, { ...current, revision: 5 })).toBeNull();
  expect(confirmedCollectionCommand(body, command)).toBeNull();
  for (const change of [
    { sourceCollectionId: "lcol_other" },
    { expectedItemCount: 199 },
    { sourceDigest: "b".repeat(64) },
  ])
    expect(
      confirmedCollectionCommand(
        { ...body, receipt: { ...body.receipt, command: { ...command, ...change } } },
        command,
        current,
      ),
    ).toBeNull();
});
it("permits an empty copy and a source at the terminal integer revision", () => {
  expect(
    libraryCollectionCommandSchema.safeParse({
      requestId,
      action: "duplicate",
      sourceCollectionId: current.id,
      expectedRevision: 2_147_483_647,
      expectedItemCount: 0,
      sourceDigest: "a".repeat(64),
      name: "Empty",
    }).success,
  ).toBe(true);
});

it("normalizes selected copy commands and verifies exact source proof in destination acknowledgements", () => {
  const command = libraryCollectionCommandSchema.parse({
    requestId,
    action: "copy-items",
    sourceCollectionId: "lcol_source",
    expectedSourceRevision: 7,
    productIds: ["prd_b", "prd_a"],
    expectedRevision: 4,
  });
  expect("productIds" in command && command.productIds).toEqual(["prd_a", "prd_b"]);
  const body = {
    replayed: false,
    receipt: {
      id: "lcr_a",
      requestId,
      command,
      collection: { ...current, revision: 5 },
      createdAt: "2026-10-12T00:00:00.000Z",
    },
  };
  expect(confirmedCollectionCommand(body, command, current)).toBe("lcol_a");
  expect(
    confirmedCollectionCommand(
      { ...body, receipt: { ...body.receipt, command: { ...command, expectedSourceRevision: 8 } } },
      command,
      current,
    ),
  ).toBeNull();
  const migration = readFileSync(
    "packages/db/migrations/0074_library_collection_item_copies.sql",
    "utf8",
  );
  expect(migration).toContain("action='copy-items'");
  expect(migration).toContain("source.revision");
  expect(migration).toContain("collection_id=source.id AND product_id=");
  expect(migration).toContain("user_id=NEW.user_id");
  expect(migration).toContain("receipts are immutable");
  expect(migration).toContain("BETWEEN 1 AND 20");
  const journal = JSON.parse(readFileSync("packages/db/migrations/meta/_journal.json", "utf8"));
  expect(
    journal.entries.filter(
      (entry: { tag: string }) => entry.tag === "0074_library_collection_item_copies",
    ),
  ).toHaveLength(1);
});

it("requires the recorded source successor when confirming a move and excludes terminal source writes", () => {
  const command = libraryCollectionCommandSchema.parse({
    requestId,
    action: "move-items",
    sourceCollectionId: "lcol_source",
    expectedSourceRevision: 7,
    productIds: ["prd_a"],
    expectedRevision: 4,
  });
  const body = {
    replayed: false,
    receipt: {
      id: "lcr_a",
      requestId,
      command,
      collection: { ...current, revision: 5 },
      createdAt: "2026-10-12T00:00:00.000Z",
      sourceCollection: { id: "lcol_source", revision: 8 },
    },
  };
  expect(confirmedCollectionCommand(body, command, current)).toBe("lcol_a");
  for (const sourceCollection of [
    undefined,
    { id: "lcol_other", revision: 8 },
    { id: "lcol_source", revision: 7 },
  ])
    expect(
      confirmedCollectionCommand(
        { ...body, receipt: { ...body.receipt, sourceCollection } },
        command,
        current,
      ),
    ).toBeNull();
  expect(
    libraryCollectionCommandSchema.safeParse({ ...command, expectedSourceRevision: 2147483647 })
      .success,
  ).toBe(false);
  const migration = readFileSync(
    "packages/db/migrations/0075_library_collection_item_moves.sql",
    "utf8",
  );
  expect(migration).toContain("Move receipt must prove removal from its source");
  // Parentheses are required: bare `revision-CASE ... END THEN` is a PL/pgSQL parse error.
  expect(migration).toContain("source.revision-(CASE WHEN action='move-items' THEN 1 ELSE 0 END)");
  expect(migration).not.toContain(
    "source.revision-CASE WHEN action='move-items' THEN 1 ELSE 0 END THEN",
  );
  expect(migration).toContain("library_collection_receipts_source_history_idx");
  expect(migration).toContain("user_id=NEW.user_id");
  const journal = JSON.parse(readFileSync("packages/db/migrations/meta/_journal.json", "utf8"));
  expect(
    journal.entries.filter(
      (entry: { tag: string }) => entry.tag === "0075_library_collection_item_moves",
    ),
  ).toHaveLength(1);
});

it("canonicalizes one to twenty disjoint reconciliation changes and confirms the exact immutable successor", () => {
  const input = {
    requestId,
    action: "reconcile-items",
    expectedRevision: 4,
    addProductIds: ["prd_b", "prd_a"],
    removeProductIds: ["prd_old"],
  };
  const command = libraryCollectionCommandSchema.parse(input);
  expect(command).toEqual({ ...input, addProductIds: ["prd_a", "prd_b"] });
  const current = { id: "lcol_a", name: "Core", status: "active" as const, revision: 4 };
  const body = {
    replayed: true,
    receipt: {
      id: "lcr_a",
      requestId,
      command,
      collection: { ...current, revision: 5 },
      createdAt: "2026-10-13T00:00:00.000Z",
    },
  };
  expect(confirmedCollectionCommand(body, command, current)).toBe("lcol_a");
  expect(
    confirmedCollectionCommand(
      {
        ...body,
        receipt: { ...body.receipt, command: { ...input, removeProductIds: ["prd_other"] } },
      },
      command,
      current,
    ),
  ).toBeNull();
  for (const value of [
    { ...input, addProductIds: [], removeProductIds: [] },
    { ...input, addProductIds: ["prd_old"] },
    { ...input, addProductIds: ["prd_a", "prd_a"] },
    { ...input, ownerId: "other" },
    { ...input, expectedRevision: 2147483647 },
    { ...input, addProductIds: Array.from({ length: 20 }, (_, i) => `prd_${i}`) },
  ])
    expect(libraryCollectionCommandSchema.safeParse(value).success).toBe(false);
});
