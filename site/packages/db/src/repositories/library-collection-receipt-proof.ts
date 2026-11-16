import { createHash } from "node:crypto";
import type { LibraryCollectionReceipt } from "@nexus/domain";
import { libraryCollectionReceiptSchema } from "@nexus/validation";
export function recordedCollectionReceipt(row: {
  id: string;
  requestId: string;
  collectionId: string;
  command: unknown;
  snapshot: unknown;
  createdAt: Date | string;
  commandDigest?: string;
}): LibraryCollectionReceipt | null {
  const timestamp = new Date(row.createdAt);
  if (!Number.isFinite(timestamp.getTime())) return null;
  const command = row.command as {
    action?: unknown;
    sourceCollectionId?: unknown;
    expectedSourceRevision?: unknown;
  } | null;
  const parsed = libraryCollectionReceiptSchema.safeParse({
    id: row.id,
    requestId: row.requestId,
    command: row.command,
    collection: row.snapshot,
    createdAt: timestamp.toISOString(),
    ...(command?.action === "move-items"
      ? {
          sourceCollection: {
            id: command.sourceCollectionId,
            revision:
              typeof command.expectedSourceRevision === "number"
                ? command.expectedSourceRevision + 1
                : null,
          },
        }
      : {}),
  });
  if (
    !parsed.success ||
    parsed.data.requestId !== parsed.data.command.requestId ||
    parsed.data.collection.id !== row.collectionId ||
    (row.commandDigest !== undefined &&
      row.commandDigest !==
        createHash("sha256").update(JSON.stringify(parsed.data.command)).digest("hex"))
  )
    return null;
  const { command: proof, collection: snapshot } = parsed.data;
  if (proof.action === "create" || proof.action === "duplicate") {
    if (
      snapshot.revision !== 1 ||
      snapshot.status !== "active" ||
      snapshot.name !== proof.name ||
      (proof.action === "duplicate" && proof.sourceCollectionId === snapshot.id)
    )
      return null;
  } else if (
    snapshot.revision !== proof.expectedRevision + 1 ||
    snapshot.status !== (proof.action === "archive" ? "archived" : "active") ||
    (proof.action === "rename" && snapshot.name !== proof.name) ||
    ((proof.action === "copy-items" || proof.action === "move-items") &&
      proof.sourceCollectionId === snapshot.id)
  )
    return null;
  return { ...parsed.data, createdAt: new Date(parsed.data.createdAt) };
}
