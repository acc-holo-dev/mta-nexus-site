import type { LibraryCollectionCommand, LibraryCollectionSnapshot } from "@nexus/domain";
import { libraryCollectionCommandSchema, libraryCollectionReceiptSchema } from "@nexus/validation";
import { z } from "zod";

const result = z
  .object({ replayed: z.boolean(), receipt: libraryCollectionReceiptSchema })
  .strict();
export function confirmedCollectionCommand(
  body: unknown,
  command: LibraryCollectionCommand,
  current?: LibraryCollectionSnapshot,
) {
  const parsed = result.safeParse(body),
    expected = libraryCollectionCommandSchema.safeParse(command);
  if (!parsed.success || !expected.success) return null;
  const { receipt } = parsed.data,
    next = receipt.collection;
  if (
    receipt.requestId !== expected.data.requestId ||
    JSON.stringify(receipt.command) !== JSON.stringify(expected.data)
  )
    return null;
  if (expected.data.action === "move-items") {
    if (
      receipt.sourceCollection?.id !== expected.data.sourceCollectionId ||
      receipt.sourceCollection.revision !== expected.data.expectedSourceRevision + 1
    )
      return null;
  } else if (receipt.sourceCollection !== undefined) return null;
  if (expected.data.action === "create")
    return !current &&
      next.name === expected.data.name &&
      next.status === "active" &&
      next.revision === 1
      ? next.id
      : null;
  if (expected.data.action === "duplicate")
    return current &&
      current.id === expected.data.sourceCollectionId &&
      current.revision === expected.data.expectedRevision &&
      next.id !== current.id &&
      next.name === expected.data.name &&
      next.status === "active" &&
      next.revision === 1
      ? next.id
      : null;
  if (!current || next.id !== current.id || next.revision !== expected.data.expectedRevision + 1)
    return null;
  const name = expected.data.action === "rename" ? expected.data.name : current.name;
  return next.name === name &&
    next.status === (expected.data.action === "archive" ? "archived" : "active")
    ? next.id
    : null;
}
