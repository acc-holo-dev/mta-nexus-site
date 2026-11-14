import { collectionCommandItemResults, LIBRARY_COLLECTION_BATCH_LIMIT } from "@nexus/domain";
import { expect, it } from "vitest";
import { confirmedCollectionCommand } from "../../src/lib/library-collections-confirmation";
import {
  libraryCollectionError,
  libraryCollectionsCopy,
} from "../../src/lib/library-collections-i18n";
import {
  collectionHref,
  collectionId,
  collectionPageParams,
  collectionsQuery,
} from "../../src/lib/library-collections-query";
import { libraryCollectionCommandSchema } from "../../packages/validation/src/library-collections";
import {
  libraryCollectionsContractCreate as create,
  libraryCollectionsContractCurrent as current,
  libraryCollectionsContractRequestId as requestId,
} from "../helpers/library-collections-contract-harness";

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
it("keeps own RU/EN copy and actionable state errors", () => {
  expect(libraryCollectionsCopy("ru").title).toContain("коллекции");
  expect(libraryCollectionsCopy("en").subtitle).toContain("do not grant");
  expect(libraryCollectionError("ru", "COLLECTION_CONFLICT")).toContain("изменилась");
  expect(libraryCollectionError("en", "COLLECTION_ITEM_LIMIT")).toContain("limit");
  expect(libraryCollectionError("en", "COLLECTION_ITEM_LIMIT")).toContain(
    libraryCollectionsCopy("en").itemLimitNext,
  );
  expect(libraryCollectionError("en", "COLLECTION_LIMIT")).toContain(
    libraryCollectionsCopy("en").collectionLimitNext,
  );
  expect(libraryCollectionsCopy("en").toCollection).not.toBe(
    libraryCollectionsCopy("en").resourceCollections,
  );
  expect(libraryCollectionsCopy("en").emptyFilteredItems).not.toBe(
    libraryCollectionsCopy("en").emptyItems,
  );
  expect(
    collectionCommandItemResults({
      requestId,
      action: "add-many",
      productIds: ["prd_a", "prd_b"],
      expectedRevision: 1,
    }),
  ).toEqual([
    { productId: "prd_a", outcome: "added" },
    { productId: "prd_b", outcome: "added" },
  ]);
  expect(LIBRARY_COLLECTION_BATCH_LIMIT).toBe(20);
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
