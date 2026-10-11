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
