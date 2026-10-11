import { nextLibrarySelection, type LibrarySelectionBatchPreview } from "@nexus/domain";
import {
  librarySelectionBatchChoiceSchema,
  librarySelectionBatchCommandSchema,
} from "@nexus/validation";
import {
  confirmedSelectionBatchPreview,
  confirmedSelectionBatchResult,
} from "../apps/web/src/lib/library-selection-batches-confirmation";
import { expect, it } from "vitest";
const choice = { mode: "fixed" as const, productIds: ["prd_a"] };
const previous = { revision: 0, mode: "latest" as const, buildId: null };
const preview: LibrarySelectionBatchPreview = {
  collection: { id: "lcol_a", name: "Core", status: "active", revision: 4 },
  choice,
  previewDigest: "a".repeat(64),
  changedCount: 1,
  items: [
    {
      productId: "prd_a",
      title: "Core",
      version: "1.0",
      targetBuildId: "bld_a",
      previous,
      next: { revision: 1, mode: "fixed", buildId: "bld_a" },
    },
  ],
};
const command = {
  ...choice,
  requestId: "acba226a-f44b-458f-bde2-28b98798a070",
  previewDigest: preview.previewDigest,
};
const snapshot = {
  collectionId: "lcol_a",
  collectionRevision: 4,
  mode: "fixed",
  items: preview.items.map(({ productId, previous, next }) => ({ productId, previous, next })),
};
const result = {
  replayed: false,
  receipt: {
    id: "lsbr_a",
    requestId: command.requestId,
    command,
    snapshot,
    createdAt: "2026-10-12T00:00:00.000Z",
  },
};
it("advances only changed selections and keeps unchanged choices at their original revision", () => {
  expect(nextLibrarySelection(previous, "latest", "bld_a")).toEqual(previous);
  expect(nextLibrarySelection(previous, "fixed", "bld_a")).toEqual({
    revision: 1,
    mode: "fixed",
    buildId: "bld_a",
  });
  expect(
    nextLibrarySelection({ revision: 5, mode: "fixed", buildId: "bld_a" }, "fixed", "bld_a")
      .revision,
  ).toBe(5);
  expect(
    nextLibrarySelection({ revision: 5, mode: "fixed", buildId: "bld_a" }, "latest", "bld_b"),
  ).toEqual({ revision: 6, mode: "latest", buildId: null });
});
it("canonicalizes group order and UUID casing without accepting duplicates", () => {
  expect(
    librarySelectionBatchChoiceSchema.parse({ mode: "latest", productIds: ["prd_b", "prd_a"] })
      .productIds,
  ).toEqual(["prd_a", "prd_b"]);
  expect(
    librarySelectionBatchCommandSchema.parse({
      ...command,
      requestId: command.requestId.toUpperCase(),
    }).requestId,
  ).toBe(command.requestId);
  expect(
    librarySelectionBatchChoiceSchema.safeParse({ ...choice, productIds: ["prd_a", "prd_a"] })
      .success,
  ).toBe(false);
});
it.each([
  { productIds: [] },
  { productIds: Array.from({ length: 21 }, (_, i) => `prd_${i}`) },
  { productIds: ["../private"] },
  { productIds: ["prd_a", 42] },
])("rejects invalid group membership %j", ({ productIds }) => {
  expect(librarySelectionBatchChoiceSchema.safeParse({ ...choice, productIds }).success).toBe(
    false,
  );
});
it.each([
  { userId: "other" },
  { mode: "installed" },
  { previewDigest: "guess" },
  { requestId: "not-uuid" },
  { expectedRevision: 1 },
])("rejects untrusted command fields %j", (patch) => {
  expect(librarySelectionBatchCommandSchema.safeParse({ ...command, ...patch }).success).toBe(
    false,
  );
});
it("accepts a bound preview and rejects foreign identities or changed choices", () => {
  expect(confirmedSelectionBatchPreview(preview, "lcol_a", choice)).toEqual(preview);
  expect(confirmedSelectionBatchPreview(preview, "lcol_b", choice)).toBeNull();
  expect(
    confirmedSelectionBatchPreview(preview, "lcol_a", { mode: "latest", productIds: ["prd_a"] }),
  ).toBeNull();
});
it.each(["count", "member", "revision", "build", "duplicate"])(
  "rejects a malformed %s preview",
  (field) => {
    const bad = structuredClone(preview);
    if (field === "count") bad.changedCount = 0;
    if (field === "member") bad.items[0].productId = "prd_b";
    if (field === "revision") bad.items[0].next.revision = 2;
    if (field === "build") bad.items[0].next.buildId = "bld_other";
    if (field === "duplicate") bad.items.push(bad.items[0]);
    expect(confirmedSelectionBatchPreview(bad, "lcol_a", choice)).toBeNull();
  },
);
it("confirms exact immutable receipts for original requests and replays", () => {
  expect(confirmedSelectionBatchResult(result, command, preview)).toBe(true);
  expect(confirmedSelectionBatchResult({ ...result, replayed: true }, command, preview)).toBe(true);
});
it.each(["scope", "collectionRevision", "request", "next", "omitted", "mode"])(
  "rejects mismatched %s acknowledgements",
  (field) => {
    const bad = structuredClone(result);
    if (field === "scope") bad.receipt.snapshot.collectionId = "lcol_b";
    if (field === "collectionRevision") bad.receipt.snapshot.collectionRevision = 5;
    if (field === "request") bad.receipt.requestId = "98adf392-81d0-42df-8092-4b9c216459bd";
    if (field === "next") bad.receipt.snapshot.items[0].next.revision = 2;
    if (field === "omitted") bad.receipt.snapshot.items = [];
    if (field === "mode") bad.receipt.command.mode = "latest" as "fixed";
    expect(confirmedSelectionBatchResult(bad, command, preview)).toBe(false);
  },
);
