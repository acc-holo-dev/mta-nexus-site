import { createHash } from "node:crypto";
import {
  AppError,
  LIBRARY_COLLECTION_COMMAND_LIMIT,
  NotFoundError,
  type LibraryMembershipBatchCommand,
  type LibraryMembershipBatchResult,
  type LibraryCollectionReceipt,
} from "@nexus/domain";
import { libraryMembershipBatchCommandSchema, libraryCollectionIdSchema } from "@nexus/validation";
import { and, count, eq, inArray, sql } from "drizzle-orm";
import {
  auditEvents,
  libraryMembershipBatchReceipts as batches,
  libraryCollectionReceipts as receipts,
  libraryCollections as collections,
  libraryCollectionItems as members,
  products,
} from "../schema";
import {
  applyLibraryCollectionCommand,
  withLibraryCollectionTransaction,
} from "./library-collections";
import { lockUserDownloadAccess, type ResourceTransaction } from "./entitlements";

const conflict = () => new AppError("Collection membership changed", 409, "COLLECTION_CONFLICT");
function childRequestId(requestId: string, collectionId: string) {
  const namespace = Buffer.from("64426f94614b591984adff0e49b5f9c0", "hex");
  const bytes = createHash("sha1")
    .update(namespace)
    .update(`${requestId}:${collectionId}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 15) | 80;
  bytes[8] = ((bytes[8] ?? 0) & 63) | 128;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
async function childrenFor(
  tx: ResourceTransaction,
  userId: string,
  ids: string[],
): Promise<LibraryCollectionReceipt[]> {
  const rows = await tx
    .select({
      id: receipts.id,
      requestId: receipts.requestId,
      command: receipts.command,
      collection: receipts.snapshot,
      createdAt: receipts.createdAt,
    })
    .from(receipts)
    .innerJoin(
      collections,
      and(eq(collections.id, receipts.collectionId), eq(collections.userId, userId)),
    )
    .where(and(eq(receipts.userId, userId), inArray(receipts.id, ids)))
    .limit(20);
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.map((id) => {
    const child = byId.get(id);
    if (!child) throw conflict();
    return child;
  });
}
export async function applyLibraryMembershipBatch(input: {
  userId: string;
  productId: string;
  command: LibraryMembershipBatchCommand;
  receiptId: string;
  auditId: string;
  children: { collectionId: string; receiptId: string; auditId: string }[];
}): Promise<LibraryMembershipBatchResult> {
  const parsed = libraryMembershipBatchCommandSchema.safeParse(input.command);
  if (!parsed.success || !libraryCollectionIdSchema.safeParse(input.productId).success)
    throw new AppError("Invalid membership batch", 400, "COLLECTION_INVALID");
  const command = parsed.data,
    digest = createHash("sha256")
      .update(JSON.stringify({ productId: input.productId, command }))
      .digest("hex");
  const receiptIds = input.children.map((child) => child.receiptId),
    auditIds = [input.auditId, ...input.children.map((child) => child.auditId)];
  if (
    input.children.length !== command.changes.length ||
    new Set(input.children.map((child) => child.collectionId)).size !== command.changes.length ||
    new Set(receiptIds).size !== receiptIds.length ||
    new Set(auditIds).size !== auditIds.length ||
    ![input.receiptId, ...receiptIds, ...auditIds].every(
      (id) => libraryCollectionIdSchema.safeParse(id).success,
    ) ||
    command.changes.some(
      (change) => !input.children.some((child) => child.collectionId === change.collectionId),
    )
  )
    throw new AppError("Invalid batch identities", 500, "COLLECTION_BATCH_INVALID");
  return withLibraryCollectionTransaction(input.userId, async (tx) => {
    const [previous] = await tx
      .select()
      .from(batches)
      .where(and(eq(batches.userId, input.userId), eq(batches.requestId, command.requestId)))
      .limit(1);
    if (previous) {
      if (previous.productId !== input.productId || previous.commandDigest !== digest)
        throw new AppError("Membership request reused", 409, "COLLECTION_REQUEST_REUSED");
      return {
        replayed: true,
        receipt: {
          id: previous.id,
          requestId: previous.requestId,
          productId: previous.productId,
          command: previous.command,
          children: await childrenFor(tx, input.userId, previous.childReceiptIds),
          createdAt: previous.createdAt,
        },
      };
    }
    const [quota] = await tx
      .select({ total: count() })
      .from(batches)
      .where(eq(batches.userId, input.userId));
    if ((quota?.total ?? 0) >= LIBRARY_COLLECTION_COMMAND_LIMIT)
      throw new AppError("Membership history limit reached", 409, "COLLECTION_HISTORY_LIMIT");
    for (const change of command.changes) {
      const [current] = await tx
        .select({ id: collections.id, status: collections.status, revision: collections.revision })
        .from(collections)
        .where(and(eq(collections.id, change.collectionId), eq(collections.userId, input.userId)))
        .limit(1)
        .for("no key update");
      if (!current) throw new NotFoundError("Collection", change.collectionId);
      if (current.status !== "active")
        throw new AppError("Archived collection", 409, "COLLECTION_ARCHIVED");
      if (current.revision !== change.expectedRevision) throw conflict();
      const [member] = await tx
        .select({ productId: members.productId })
        .from(members)
        .where(and(eq(members.collectionId, current.id), eq(members.productId, input.productId)))
        .limit(1)
        .for("share");
      if (!!member !== change.wasInCollection) throw conflict();
    }
    let access: Awaited<ReturnType<typeof lockUserDownloadAccess>> = null;
    if (command.changes.some((change) => change.inCollection)) {
      const [product] = await tx
        .select({ id: products.id })
        .from(products)
        .where(eq(products.id, input.productId))
        .limit(1)
        .for("share");
      access = product
        ? await lockUserDownloadAccess(tx, input.userId, input.productId, sql`clock_timestamp()`)
        : null;
      if (!access) throw new NotFoundError("Library resource", input.productId);
    }
    const children: LibraryCollectionReceipt[] = [];
    for (const change of command.changes) {
      const identity = input.children.find((child) => child.collectionId === change.collectionId);
      if (!identity) throw new AppError("Invalid batch identity", 500, "COLLECTION_BATCH_INVALID");
      const result = await applyLibraryCollectionCommand(tx, {
        userId: input.userId,
        collectionId: change.collectionId,
        newCollectionId: change.collectionId,
        receiptId: identity.receiptId,
        auditId: identity.auditId,
        membershipBatchId: input.receiptId,
        command: {
          requestId: childRequestId(command.requestId, change.collectionId),
          action: change.inCollection ? "add" : "remove",
          expectedRevision: change.expectedRevision,
          productId: input.productId,
        },
      });
      // A child receipt from outside this parent transaction must never be adopted.
      if (result.replayed)
        throw new AppError("Membership child request reused", 409, "COLLECTION_REQUEST_REUSED");
      children.push(result.receipt);
    }
    if (access) {
      const [term] = await tx.execute<{ valid: boolean }>(
        sql`SELECT ${access.expiresAt === null ? sql`true` : sql`${access.expiresAt}::timestamptz>clock_timestamp()`} AS valid`,
      );
      if (term?.valid !== true) throw new NotFoundError("Library resource", input.productId);
    }
    const [record] = await tx
      .insert(batches)
      .values({
        id: input.receiptId,
        userId: input.userId,
        requestId: command.requestId,
        productId: input.productId,
        commandDigest: digest,
        command,
        childReceiptIds: children.map((child) => child.id),
      })
      .returning({ id: batches.id, createdAt: batches.createdAt });
    await tx.insert(auditEvents).values({
      id: input.auditId,
      actorId: input.userId,
      actorType: "user",
      action: "library.memberships_changed",
      targetType: "product",
      targetId: input.productId,
      details: {
        requestId: command.requestId,
        receiptId: record.id,
        childReceiptIds: children.map((child) => child.id),
        changes: command.changes,
      },
    });
    return {
      replayed: false,
      receipt: {
        id: record.id,
        requestId: command.requestId,
        productId: input.productId,
        command,
        children,
        createdAt: record.createdAt,
      },
    };
  });
}
