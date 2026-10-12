import {
  LIBRARY_COLLECTION_BATCH_LIMIT,
  type LibraryMembershipBatchCommand,
  type LibraryCollectionSnapshot,
} from "@nexus/domain";
import {
  libraryCollectionIdSchema,
  libraryCollectionReceiptSchema,
  libraryMembershipBatchCommandSchema,
} from "@nexus/validation";
import { z } from "zod";
const result = z
  .object({
    replayed: z.boolean(),
    receipt: z
      .object({
        id: libraryCollectionIdSchema,
        requestId: z.string().uuid(),
        productId: libraryCollectionIdSchema,
        command: libraryMembershipBatchCommandSchema,
        children: z
          .array(libraryCollectionReceiptSchema)
          .min(1)
          .max(LIBRARY_COLLECTION_BATCH_LIMIT),
        createdAt: z.string().datetime(),
      })
      .strict(),
  })
  .strict();
export function confirmedMembershipBatch(
  body: unknown,
  productId: string,
  command: LibraryMembershipBatchCommand,
  reviewed: LibraryCollectionSnapshot[],
) {
  const parsed = result.safeParse(body),
    expected = libraryMembershipBatchCommandSchema.safeParse(command);
  if (!parsed.success || !expected.success) return null;
  const receipt = parsed.data.receipt;
  if (
    receipt.productId !== productId ||
    receipt.requestId !== expected.data.requestId ||
    JSON.stringify(receipt.command) !== JSON.stringify(expected.data) ||
    receipt.children.length !== expected.data.changes.length ||
    new Set(receipt.children.map((child) => child.id)).size !== receipt.children.length ||
    new Set(receipt.children.map((child) => child.requestId)).size !== receipt.children.length
  )
    return null;
  for (const [index, change] of expected.data.changes.entries()) {
    const child = receipt.children[index],
      current = reviewed.find((collection) => collection.id === change.collectionId);
    if (
      !child ||
      !current ||
      current.status !== "active" ||
      current.revision !== change.expectedRevision ||
      child.sourceCollection !== undefined ||
      child.requestId === receipt.requestId ||
      child.command.requestId !== child.requestId ||
      (child.command.action !== "add" && child.command.action !== "remove") ||
      child.command.action !== (change.inCollection ? "add" : "remove") ||
      child.command.productId !== productId ||
      child.command.expectedRevision !== change.expectedRevision ||
      child.collection.id !== change.collectionId ||
      child.collection.name !== current.name ||
      child.collection.status !== "active" ||
      child.collection.revision !== change.expectedRevision + 1
    )
      return null;
  }
  return receipt;
}
