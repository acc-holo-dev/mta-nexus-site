import type { LibraryMembershipBatchCommand, LibraryCollectionSnapshot } from "@nexus/domain";
import {
  libraryMembershipBatchResultSchema,
  libraryMembershipBatchCommandSchema,
} from "@nexus/validation";
export function confirmedMembershipBatch(
  body: unknown,
  productId: string,
  command: LibraryMembershipBatchCommand,
  reviewed: LibraryCollectionSnapshot[],
) {
  const parsed = libraryMembershipBatchResultSchema.safeParse(body),
    expected = libraryMembershipBatchCommandSchema.safeParse(command);
  if (!parsed.success || !expected.success) return null;
  const receipt = parsed.data.receipt;
  if (
    receipt.productId !== productId ||
    receipt.requestId !== expected.data.requestId ||
    JSON.stringify(receipt.command) !== JSON.stringify(expected.data)
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
      child.collection.name !== current.name
    )
      return null;
  }
  return receipt;
}
