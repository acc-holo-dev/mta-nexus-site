import { createHash } from "node:crypto";
import {
  AppError,
  LIBRARY_COLLECTION_ITEM_LIMIT,
  type LibraryCollectionCopyPreview,
  type LibraryCollectionReceipt,
  type LibraryCollectionSnapshot,
  NotFoundError,
} from "@nexus/domain";
import { and, eq, or, sql } from "drizzle-orm";
import {
  libraryCollections as collections,
  libraryCollectionItems as members,
  libraryCollectionReceipts as receipts,
  users,
} from "../schema";
import type { ResourceTransaction } from "./entitlements";

export const fail = (code: string) => new AppError("Collection command is unavailable", 409, code);
export const fields = {
  id: collections.id,
  name: collections.name,
  status: collections.status,
  revision: collections.revision,
  createdAt: collections.createdAt,
  updatedAt: collections.updatedAt,
};
export const receiptFields = {
  id: receipts.id,
  requestId: receipts.requestId,
  command: receipts.command,
  snapshot: receipts.snapshot,
  createdAt: receipts.createdAt,
};
export function publicReceipt(
  row: Pick<
    typeof receipts.$inferSelect,
    "id" | "requestId" | "command" | "snapshot" | "createdAt"
  >,
): LibraryCollectionReceipt {
  return {
    id: row.id,
    requestId: row.requestId,
    command: row.command,
    collection: row.snapshot,
    ...(row.command.action === "move-items"
      ? {
          sourceCollection: {
            id: row.command.sourceCollectionId,
            revision: row.command.expectedSourceRevision + 1,
          },
        }
      : {}),
    createdAt: row.createdAt,
  };
}
export function collectionReceiptScope(userId: string, id: string) {
  return and(
    eq(receipts.userId, userId),
    or(
      eq(receipts.collectionId, id),
      sql`${receipts.command}->>'action'='move-items' AND ${receipts.command}->>'sourceCollectionId'=${id}`,
    ),
  );
}
export async function liveUser(tx: ResourceTransaction, userId: string, lock = false) {
  const query = tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  const [actor] = await (lock ? query.for("share") : query);
  if (!actor) throw new NotFoundError("Library", userId);
}
export async function owned(tx: ResourceTransaction, userId: string, id: string, lock = false) {
  const query = tx
    .select(fields)
    .from(collections)
    .where(and(eq(collections.id, id), eq(collections.userId, userId)))
    .limit(1);
  const [collection] = await (lock ? query.for("no key update") : query);
  if (!collection) throw new NotFoundError("Collection", id);
  return collection;
}
export const readOptions = { isolationLevel: "repeatable read", accessMode: "read only" } as const;

export async function copySource(
  tx: ResourceTransaction,
  userId: string,
  id: string,
  lock = false,
): Promise<LibraryCollectionCopyPreview & { productIds: string[] }> {
  const sourceRow = await owned(tx, userId, id, lock);
  const source: LibraryCollectionSnapshot = {
    id: sourceRow.id,
    name: sourceRow.name,
    status: sourceRow.status,
    revision: sourceRow.revision,
  };
  const rows = await tx
    .select({ productId: members.productId })
    .from(members)
    .where(eq(members.collectionId, id))
    .limit(LIBRARY_COLLECTION_ITEM_LIMIT + 1);
  if (rows.length > LIBRARY_COLLECTION_ITEM_LIMIT) throw fail("COLLECTION_ITEM_LIMIT");
  const productIds = rows.map((row) => row.productId).sort();
  const sourceDigest = createHash("sha256")
    .update(JSON.stringify({ source, productIds }))
    .digest("hex");
  return { source, itemCount: productIds.length, sourceDigest, productIds };
}
