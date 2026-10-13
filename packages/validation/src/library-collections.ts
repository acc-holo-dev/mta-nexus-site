import {
  LIBRARY_COLLECTION_BATCH_LIMIT,
  LIBRARY_COLLECTION_ITEM_LIMIT,
  LIBRARY_COLLECTION_COMPARISON_FILTERS,
  LIBRARY_COLLECTION_INVENTORY_FILTERS,
} from "@nexus/domain";
import { z } from "zod";

const requestId = z
  .string()
  .uuid()
  .transform((v) => v.toLowerCase());
const expectedRevision = z.number().int().min(1).max(2_147_483_646);
export const libraryCollectionIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,160}$/u);
export const libraryMembershipBatchCommandSchema = z
  .object({
    requestId,
    changes: z
      .array(
        z
          .object({
            collectionId: libraryCollectionIdSchema,
            expectedRevision,
            wasInCollection: z.boolean(),
            inCollection: z.boolean(),
          })
          .strict()
          .refine(
            (change) => change.wasInCollection !== change.inCollection,
            "Membership must change",
          ),
      )
      .min(1)
      .max(LIBRARY_COLLECTION_BATCH_LIMIT)
      .refine(
        (changes) => new Set(changes.map((change) => change.collectionId)).size === changes.length,
        "Duplicate collections",
      )
      .transform((changes) =>
        [...changes].sort((a, b) =>
          a.collectionId < b.collectionId ? -1 : a.collectionId > b.collectionId ? 1 : 0,
        ),
      ),
  })
  .strict();
// Reject invisible control characters; names are rendered as text, never HTML.
// biome-ignore lint/suspicious/noControlCharactersInRegex: Reject control characters in private labels.
const safeName = /^[^\u0000-\u001f\u007f]*$/u;
const name = z.string().trim().min(1).max(80).regex(safeName);
export const libraryCollectionComparisonQuerySchema = z
  .object({
    to: libraryCollectionIdSchema.optional(),
    page: z.number().int().min(1).max(9999),
    filter: z.enum(LIBRARY_COLLECTION_COMPARISON_FILTERS),
    q: z
      .string()
      .max(80)
      .regex(safeName)
      .transform((value) => value.trim()),
    transfer: z.enum(["copy", "move"]),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.to && (value.page !== 1 || value.filter !== "all" || value.q !== ""))
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choose a destination before filtering",
        path: ["to"],
      });
  });
export const libraryCollectionSnapshotSchema = z
  .object({
    id: libraryCollectionIdSchema,
    name: z.string().min(1).max(80).regex(safeName),
    status: z.enum(["active", "archived"]),
    revision: z.number().int().min(1).max(2_147_483_647),
  })
  .strict();
const productIds = z
  .array(libraryCollectionIdSchema)
  .min(1)
  .max(LIBRARY_COLLECTION_BATCH_LIMIT)
  .refine((ids) => new Set(ids).size === ids.length, "Duplicate references")
  .transform((ids) => [...ids].sort());
const reconcileIds = z
  .array(libraryCollectionIdSchema)
  .max(LIBRARY_COLLECTION_BATCH_LIMIT)
  .refine((ids) => new Set(ids).size === ids.length, "Duplicate references")
  .transform((ids) => [...ids].sort());
export const libraryCollectionCommandSchema = z
  .discriminatedUnion("action", [
    z.object({ requestId, action: z.literal("create"), name }).strict(),
    z
      .object({
        requestId,
        action: z.literal("duplicate"),
        name,
        sourceCollectionId: libraryCollectionIdSchema,
        expectedRevision: z.number().int().min(1).max(2_147_483_647),
        expectedItemCount: z.number().int().min(0).max(LIBRARY_COLLECTION_ITEM_LIMIT),
        sourceDigest: z.string().regex(/^[a-f0-9]{64}$/u),
      })
      .strict(),
    z.object({ requestId, action: z.literal("rename"), name, expectedRevision }).strict(),
    z.object({ requestId, action: z.literal("archive"), expectedRevision }).strict(),
    z.object({ requestId, action: z.literal("restore"), expectedRevision }).strict(),
    z
      .object({
        requestId,
        action: z.literal("add"),
        productId: libraryCollectionIdSchema,
        expectedRevision,
      })
      .strict(),
    z
      .object({
        requestId,
        action: z.literal("remove"),
        productId: libraryCollectionIdSchema,
        expectedRevision,
      })
      .strict(),
    z
      .object({
        requestId,
        action: z.literal("copy-items"),
        sourceCollectionId: libraryCollectionIdSchema,
        expectedSourceRevision: z.number().int().min(1).max(2_147_483_647),
        productIds,
        expectedRevision,
      })
      .strict(),
    z
      .object({
        requestId,
        action: z.literal("move-items"),
        sourceCollectionId: libraryCollectionIdSchema,
        expectedSourceRevision: expectedRevision,
        productIds,
        expectedRevision,
      })
      .strict(),
    z.object({ requestId, action: z.literal("add-many"), productIds, expectedRevision }).strict(),
    z
      .object({ requestId, action: z.literal("remove-many"), productIds, expectedRevision })
      .strict(),
    z
      .object({
        requestId,
        action: z.literal("reconcile-items"),
        addProductIds: reconcileIds,
        removeProductIds: reconcileIds,
        expectedRevision,
      })
      .strict(),
  ])
  .superRefine((command, ctx) => {
    if (
      command.action === "reconcile-items" &&
      (command.addProductIds.length + command.removeProductIds.length < 1 ||
        command.addProductIds.length + command.removeProductIds.length >
          LIBRARY_COLLECTION_BATCH_LIMIT ||
        command.addProductIds.some((id) => command.removeProductIds.includes(id)))
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Reconciliation needs one to twenty distinct changes",
      });
  });

export const libraryCollectionReceiptSchema = z
  .object({
    id: libraryCollectionIdSchema,
    requestId: z.string().uuid(),
    command: libraryCollectionCommandSchema,
    collection: libraryCollectionSnapshotSchema,
    sourceCollection: z
      .object({
        id: libraryCollectionIdSchema,
        revision: z.number().int().min(1).max(2_147_483_647),
      })
      .strict()
      .optional(),
    createdAt: z.string().datetime(),
  })
  .strict();

/** Full immutable group proof; current collection state is deliberately excluded. */
export const libraryMembershipBatchReceiptSchema = z
  .object({
    id: libraryCollectionIdSchema,
    requestId: z.string().uuid(),
    productId: libraryCollectionIdSchema,
    command: libraryMembershipBatchCommandSchema,
    children: z.array(libraryCollectionReceiptSchema).min(1).max(LIBRARY_COLLECTION_BATCH_LIMIT),
    createdAt: z.string().datetime(),
  })
  .strict()
  .superRefine((receipt, ctx) => {
    const invalid = () =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Inconsistent membership proof" });
    if (
      receipt.requestId !== receipt.command.requestId ||
      receipt.children.length !== receipt.command.changes.length ||
      new Set(receipt.children.map((child) => child.id)).size !== receipt.children.length ||
      new Set(receipt.children.map((child) => child.requestId)).size !== receipt.children.length
    )
      invalid();
    for (const [index, change] of receipt.command.changes.entries()) {
      const child = receipt.children[index];
      if (
        !child ||
        child.sourceCollection !== undefined ||
        child.requestId === receipt.requestId ||
        child.command.requestId !== child.requestId ||
        (child.command.action !== "add" && child.command.action !== "remove") ||
        child.command.action !== (change.inCollection ? "add" : "remove") ||
        child.command.productId !== receipt.productId ||
        child.command.expectedRevision !== change.expectedRevision ||
        child.collection.id !== change.collectionId ||
        child.collection.status !== "active" ||
        child.collection.revision !== change.expectedRevision + 1
      )
        invalid();
    }
  });
export const libraryMembershipBatchResultSchema = z
  .object({
    replayed: z.boolean(),
    receipt: libraryMembershipBatchReceiptSchema,
  })
  .strict();

export const libraryCollectionManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    generatedAt: z.string().datetime(),
    collection: libraryCollectionSnapshotSchema,
    productIds: z
      .array(libraryCollectionIdSchema)
      .max(LIBRARY_COLLECTION_ITEM_LIMIT)
      .refine((ids) => new Set(ids).size === ids.length, "Duplicate resource references")
      .transform((ids) => [...ids].sort()),
  })
  .strict();
export const libraryCollectionImportPreviewSchema = z
  .object({
    schemaVersion: z.literal(1),
    generatedAt: z.string().datetime(),
    collection: libraryCollectionSnapshotSchema,
    itemCount: z.number().int().min(0).max(LIBRARY_COLLECTION_ITEM_LIMIT),
    itemLimit: z.literal(LIBRARY_COLLECTION_ITEM_LIMIT),
    batchLimit: z.literal(LIBRARY_COLLECTION_BATCH_LIMIT),
    items: z
      .array(
        z
          .object({
            productId: libraryCollectionIdSchema,
            title: z.string().max(400).nullable(),
            available: z.boolean(),
            inCollection: z.boolean(),
            canAdd: z.boolean(),
          })
          .strict(),
      )
      .max(LIBRARY_COLLECTION_ITEM_LIMIT),
  })
  .strict()
  .superRefine((preview, ctx) => {
    if (
      new Set(preview.items.map((item) => item.productId)).size !== preview.items.length ||
      preview.items.some(
        (item) =>
          (!item.available && item.title !== null) ||
          (item.canAdd &&
            (item.inCollection ||
              preview.collection.status !== "active" ||
              preview.collection.revision >= 2147483647 ||
              preview.itemCount >= preview.itemLimit)),
      )
    )
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid import preview" });
  });

export const libraryCollectionReconcilePreviewSchema = z
  .object({
    schemaVersion: z.literal(1),
    generatedAt: z.string().datetime(),
    collection: libraryCollectionSnapshotSchema,
    itemCount: z.number().int().min(0).max(LIBRARY_COLLECTION_ITEM_LIMIT),
    itemLimit: z.literal(LIBRARY_COLLECTION_ITEM_LIMIT),
    batchLimit: z.literal(LIBRARY_COLLECTION_BATCH_LIMIT),
    items: z
      .array(
        z
          .object({
            productId: libraryCollectionIdSchema,
            title: z.string().max(400).nullable(),
            available: z.boolean(),
            inCollection: z.boolean(),
            inManifest: z.boolean(),
            canAdd: z.boolean(),
            canRemove: z.boolean(),
          })
          .strict(),
      )
      .max(LIBRARY_COLLECTION_ITEM_LIMIT * 2),
  })
  .strict()
  .superRefine((preview, ctx) => {
    const writable =
      preview.collection.status === "active" && preview.collection.revision < 2147483647;
    if (
      new Set(preview.items.map((item) => item.productId)).size !== preview.items.length ||
      preview.items.filter((item) => item.inCollection).length !== preview.itemCount ||
      preview.items.filter((item) => item.inManifest).length > LIBRARY_COLLECTION_ITEM_LIMIT ||
      preview.items.some(
        (item) =>
          (!item.inCollection && !item.inManifest) ||
          (!item.available && item.title !== null) ||
          (item.canAdd && (!writable || item.inCollection || !item.inManifest)) ||
          item.canRemove !== (writable && item.inCollection && !item.inManifest),
      )
    )
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid reconciliation preview" });
  });

export const libraryCollectionInventoryQuerySchema = z
  .object({
    page: z.number().int().min(1).max(9999),
    status: z.enum(["all", "active", "archived"]),
    filter: z.enum(LIBRARY_COLLECTION_INVENTORY_FILTERS),
    q: z
      .string()
      .max(80)
      .regex(safeName)
      .transform((value) => value.trim()),
    collectionId: libraryCollectionIdSchema.optional(),
  })
  .strict();
