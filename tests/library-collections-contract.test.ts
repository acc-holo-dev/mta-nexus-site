import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { confirmedCollectionCommand } from "../apps/web/src/lib/library-collections-confirmation";
import {
  libraryCollectionError,
  libraryCollectionsCopy,
} from "../apps/web/src/lib/library-collections-i18n";
import {
  collectionHref,
  collectionId,
  collectionPageParams,
  collectionsQuery,
} from "../apps/web/src/lib/library-collections-query";
import { libraryCollectionCommandSchema } from "../packages/validation/src/library-collections";

const requestId = "67ca0352-de64-4af9-9e54-7d3c56fe8d89",
  current = { id: "lcol_a", name: "Core", status: "active" as const, revision: 4 };
const create = { requestId, action: "create" as const, name: "Core" };
const reply = (command = create, collection = { ...current, revision: 1 }) => ({
  replayed: false,
  receipt: {
    id: "lcr_a",
    requestId,
    command,
    collection,
    createdAt: "2026-10-11T00:00:00.000Z",
  },
});
it("normalizes names and UUIDs and accepts all six explicit commands", () => {
  expect(
    libraryCollectionCommandSchema.parse({
      ...create,
      name: "  Core  ",
      requestId: requestId.toUpperCase(),
    }),
  ).toEqual(create);
  for (const action of ["rename", "archive", "restore", "add", "remove"])
    expect(
      libraryCollectionCommandSchema.safeParse({
        requestId,
        action,
        expectedRevision: 4,
        ...(action === "rename" ? { name: "Core" } : {}),
        ...(action === "add" || action === "remove" ? { productId: "prd_a" } : {}),
      }).success,
    ).toBe(true);
});
it.each(["", " ", "x".repeat(81), "name\nsecret", "name\u0000secret"])(
  "rejects invalid private name %j",
  (name) => {
    expect(libraryCollectionCommandSchema.safeParse({ ...create, name }).success).toBe(false);
  },
);
it.each([
  "userId",
  "organizationId",
  "price",
  "entitlement",
  "status",
  "revision",
  "downloadToken",
])("forbids client field %s", (key) => {
  expect(libraryCollectionCommandSchema.safeParse({ ...create, [key]: "override" }).success).toBe(
    false,
  );
});
it.each([0, -1, 1.5, NaN, 2_147_483_647])("rejects invalid revision %j", (expectedRevision) => {
  expect(
    libraryCollectionCommandSchema.safeParse({
      requestId,
      action: "remove",
      productId: "prd_a",
      expectedRevision,
    }).success,
  ).toBe(false);
});
it.each(["../other", "usr a", "prd%", "x".repeat(161)])("rejects unsafe reference %s", (id) => {
  expect(() => collectionId(id)).toThrow();
});
it("bounds pages and literal searches without accepting account or SQL controls", () => {
  expect(collectionsQuery(new URLSearchParams("page=2&q=100%25_%5C"), "detail")).toMatchObject({
    page: 2,
    q: "100%_\\",
  });
  for (const q of [
    "page=0",
    "page=1&page=2",
    "userId=other",
    "status=deleted",
    "page=10000",
    "q=x&limit=999",
  ])
    expect(() => collectionsQuery(new URLSearchParams(q), "detail")).toThrow();
  expect(() => collectionPageParams({ page: ["1", "2"] })).toThrow();
  expect(collectionHref("lcol_a", "history", { page: "2" })).toBe(
    "/workspace/library/collections/lcol_a/history?page=2",
  );
});
it("confirms creation only with a complete matching private receipt", () => {
  expect(confirmedCollectionCommand(reply(), create)).toBe(current.id);
  for (const body of [
    null,
    {},
    { ...reply(), replayed: undefined },
    {
      ...reply(),
      receipt: { ...reply().receipt, requestId: "67ca0352-de64-4af9-9e54-7d3c56fe8d88" },
    },
    reply(create, { ...current, revision: 2 }),
    reply(create, { ...current, name: "Other", revision: 1 }),
  ])
    expect(confirmedCollectionCommand(body, create)).toBeNull();
});
it("does not confirm another collection, revision, action or hidden grant", () => {
  const command = { requestId, action: "archive" as const, expectedRevision: 4 },
    body = {
      ...reply(),
      receipt: {
        ...reply().receipt,
        command,
        collection: { ...current, status: "archived", revision: 5 },
      },
    };
  expect(confirmedCollectionCommand(body, command, current)).toBe(current.id);
  for (const change of [
    { id: "lcol_other" },
    { revision: 6 },
    { status: "active" },
    { name: "Changed" },
    { entitlement: "ent_a" },
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
});
it("keeps own RU/EN copy and actionable state errors", () => {
  expect(libraryCollectionsCopy("ru").title).toContain("коллекции");
  expect(libraryCollectionsCopy("en").subtitle).toContain("do not grant");
  expect(libraryCollectionError("ru", "COLLECTION_CONFLICT")).toContain("изменилась");
  expect(libraryCollectionError("en", "COLLECTION_ITEM_LIMIT")).toContain("limit");
});
it.each(["add-many", "remove-many"] as const)(
  "canonicalizes and strictly bounds %s commands",
  (action) => {
    const command = { requestId, action, productIds: ["prd_b", "prd_a"], expectedRevision: 4 };
    expect(libraryCollectionCommandSchema.parse(command)).toMatchObject({
      productIds: ["prd_a", "prd_b"],
    });
    for (const productIds of [
      [],
      ["prd_a", "prd_a"],
      ["../unsafe"],
      Array.from({ length: 21 }, (_, i) => `prd_${i}`),
    ])
      expect(libraryCollectionCommandSchema.safeParse({ ...command, productIds }).success).toBe(
        false,
      );
    expect(
      libraryCollectionCommandSchema.safeParse({ ...command, productId: "prd_a" }).success,
    ).toBe(false);
    const parsed = libraryCollectionCommandSchema.parse(command);
    const body = {
      replayed: true,
      receipt: {
        id: "lcr_a",
        requestId,
        command: parsed,
        collection: { ...current, revision: 5 },
        createdAt: "2026-10-11T00:00:00.000Z",
      },
    };
    expect(confirmedCollectionCommand(body, parsed, current)).toBe(current.id);
    expect(
      confirmedCollectionCommand(
        {
          ...body,
          receipt: { ...body.receipt, command: { ...parsed, productIds: ["prd_other"] } },
        },
        parsed,
        current,
      ),
    ).toBeNull();
  },
);
it("accepts twenty maximum-length references within the bounded command body", () => {
  const command = libraryCollectionCommandSchema.parse({
    requestId,
    action: "add-many",
    expectedRevision: 4,
    productIds: Array.from(
      { length: 20 },
      (_, i) => `prd_${String(i).padStart(2, "0")}_${"a".repeat(153)}`,
    ),
  });
  expect(Buffer.byteLength(JSON.stringify(command))).toBeLessThan(8192);
  expect(Buffer.byteLength(JSON.stringify(command))).toBeGreaterThan(2048);
});
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
