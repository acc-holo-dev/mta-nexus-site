import { createHash } from "node:crypto";
import {
  AppError,
  LIBRARY_COLLECTION_COMMAND_LIMIT,
  LIBRARY_COLLECTION_ITEM_LIMIT,
  LIBRARY_COLLECTION_LIMIT,
  type LibraryCollectionCommand,
  type LibraryCollectionResult,
  type LibraryCollectionSnapshot,
  NotFoundError,
} from "@nexus/domain";
import { libraryCollectionCommandSchema, libraryCollectionIdSchema } from "@nexus/validation";
import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import { db } from "../client";
import {
  auditEvents,
  libraryCollections as collections,
  libraryCollectionItems as members,
  products,
  libraryCollectionReceipts as receipts,
} from "../schema";
import { lockUserDownloadAccess, type ResourceTransaction } from "./entitlements";
import { lockInitiatingSession } from "./initiating-session";
import {
  collectionReceiptScope,
  copySource,
  fail,
  fields,
  liveUser,
  owned,
  publicReceipt,
  receiptFields,
} from "./library-collection-internals";

export type LibraryCollectionCommandInput = {
  userId: string;
  currentToken: string;
  collectionId?: string;
  command: LibraryCollectionCommand;
  newCollectionId: string;
  receiptId: string;
  auditId: string;
  membershipBatchId?: string;
};
export function validateCollectionCommand(input: LibraryCollectionCommandInput) {
  const parsed = libraryCollectionCommandSchema.safeParse(input.command);
  if (
    !parsed.success ||
    (parsed.data.action === "create" || parsed.data.action === "duplicate") !==
      !input.collectionId ||
    (input.collectionId && !libraryCollectionIdSchema.safeParse(input.collectionId).success)
  )
    throw new AppError("Invalid collection command", 400, "COLLECTION_INVALID");
  return parsed.data;
}
export function withLibraryCollectionTransaction<T>(
  userId: string,
  run: (tx: ResourceTransaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`set local lock_timeout='5s'`);
    await tx.execute(sql`set local statement_timeout='10s'`);
    // Serialize quota, command keys and collection mutations for this owner.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`library-collections:${userId}`}))`,
    );
    await liveUser(tx, userId, true);
    return run(tx);
  });
}
/** Prepare every authority lock before an initiating session is locked. Internal to collection repositories. */
export async function prepareLibraryCollectionCommand(
  tx: ResourceTransaction,
  input: LibraryCollectionCommandInput,
) {
  const command = validateCollectionCommand(input),
    digest = createHash("sha256").update(JSON.stringify(command)).digest("hex");
  const [previous] = await tx
    .select()
    .from(receipts)
    .where(and(eq(receipts.userId, input.userId), eq(receipts.requestId, command.requestId)))
    .limit(1);
  if (previous) {
    if (
      previous.commandDigest !== digest ||
      (input.collectionId && previous.collectionId !== input.collectionId)
    )
      throw fail("COLLECTION_REQUEST_REUSED");
    await owned(tx, input.userId, previous.collectionId);
    return {
      replayed: true,
      write: async (): Promise<LibraryCollectionResult> => ({
        receipt: publicReceipt(previous),
        replayed: true,
      }),
    };
  }
  const writes: (() => Promise<void>)[] = [];
  const reconciliationTerms: { expiresAt: Date | null }[] = [];
  let collection: LibraryCollectionSnapshot;
  if (command.action === "create" || command.action === "duplicate") {
    let copy: Awaited<ReturnType<typeof copySource>> | undefined;
    if (command.action === "duplicate") {
      if (input.newCollectionId === command.sourceCollectionId) throw fail("COLLECTION_CONFLICT");
      copy = await copySource(tx, input.userId, command.sourceCollectionId, true);
      if (
        copy.source.revision !== command.expectedRevision ||
        copy.itemCount !== command.expectedItemCount ||
        copy.sourceDigest !== command.sourceDigest
      )
        throw fail("COLLECTION_CONFLICT");
    }
    const [summary] = await tx
      .select({ total: count() })
      .from(collections)
      .where(eq(collections.userId, input.userId));
    if ((summary?.total ?? 0) >= LIBRARY_COLLECTION_LIMIT) throw fail("COLLECTION_LIMIT");
    writes.push(async () => {
      const [created] = await tx
        .insert(collections)
        .values({ id: input.newCollectionId, userId: input.userId, name: command.name })
        .returning(fields);
      collection = created;
      if (copy?.productIds.length)
        await tx
          .insert(members)
          .values(copy.productIds.map((productId) => ({ collectionId: created.id, productId })));
    });
  } else {
    if (!input.collectionId) throw new AppError("Missing collection", 400, "COLLECTION_INVALID");
    const current = await owned(tx, input.userId, input.collectionId, true);
    if (current.revision !== command.expectedRevision) throw fail("COLLECTION_CONFLICT");
    const [summary] = await tx
      .select({ total: count() })
      .from(receipts)
      .where(collectionReceiptScope(input.userId, current.id));
    if ((summary?.total ?? 0) >= LIBRARY_COLLECTION_COMMAND_LIMIT)
      throw fail("COLLECTION_HISTORY_LIMIT");
    if (command.action === "restore" ? current.status !== "archived" : current.status !== "active")
      throw fail("COLLECTION_ARCHIVED");
    if (command.action === "copy-items" || command.action === "move-items") {
      if (command.sourceCollectionId === current.id) throw fail("COLLECTION_CONFLICT");
      const source = await owned(tx, input.userId, command.sourceCollectionId, true);
      if (source.revision !== command.expectedSourceRevision) throw fail("COLLECTION_CONFLICT");
      if (command.action === "move-items") {
        if (source.status !== "active") throw fail("COLLECTION_ARCHIVED");
        const [sourceHistory] = await tx
          .select({ total: count() })
          .from(receipts)
          .where(collectionReceiptScope(input.userId, source.id));
        if ((sourceHistory?.total ?? 0) >= LIBRARY_COLLECTION_COMMAND_LIMIT)
          throw fail("COLLECTION_HISTORY_LIMIT");
      }
      // Copy owned historical references, including deleted resources; no product/grant authority is consulted.
      const selected = await tx
        .select({ productId: members.productId })
        .from(members)
        .where(
          and(eq(members.collectionId, source.id), inArray(members.productId, command.productIds)),
        )
        .orderBy(asc(members.productId))
        .for("share");
      if (selected.length !== command.productIds.length) throw fail("COLLECTION_CONFLICT");
      const present = await tx
        .select({ productId: members.productId })
        .from(members)
        .where(
          and(eq(members.collectionId, current.id), inArray(members.productId, command.productIds)),
        );
      const presentIds = new Set(present.map((item) => item.productId)),
        missing = command.productIds.filter((id) => !presentIds.has(id));
      const [total] = await tx
        .select({ total: count() })
        .from(members)
        .where(eq(members.collectionId, current.id));
      if ((total?.total ?? 0) + missing.length > LIBRARY_COLLECTION_ITEM_LIMIT)
        throw fail("COLLECTION_ITEM_LIMIT");
      writes.push(async () => {
        if (missing.length)
          await tx
            .insert(members)
            .values(missing.map((productId) => ({ collectionId: current.id, productId })));
        if (command.action === "move-items") {
          const removed = await tx
            .delete(members)
            .where(
              and(
                eq(members.collectionId, source.id),
                inArray(members.productId, command.productIds),
              ),
            )
            .returning({ productId: members.productId });
          if (removed.length !== command.productIds.length) throw fail("COLLECTION_CONFLICT");
          const [advanced] = await tx
            .update(collections)
            .set({
              revision: source.revision + 1,
              updatedAt: sql`greatest(clock_timestamp(),${collections.updatedAt}+interval '1 millisecond')`,
            })
            .where(
              and(
                eq(collections.id, source.id),
                eq(collections.userId, input.userId),
                eq(collections.revision, source.revision),
                eq(collections.status, "active"),
              ),
            )
            .returning({ id: collections.id });
          if (!advanced) throw fail("COLLECTION_CONFLICT");
        }
      });
    } else if (command.action === "reconcile-items") {
      const changes = [...command.addProductIds, ...command.removeProductIds].sort();
      const present = await tx
        .select({ productId: members.productId })
        .from(members)
        .where(and(eq(members.collectionId, current.id), inArray(members.productId, changes)))
        .orderBy(asc(members.productId))
        .for("share");
      const ids = new Set(present.map((row) => row.productId));
      if (
        command.addProductIds.some((id) => ids.has(id)) ||
        command.removeProductIds.some((id) => !ids.has(id))
      )
        throw fail("COLLECTION_CONFLICT");
      const [total] = await tx
        .select({ total: count() })
        .from(members)
        .where(eq(members.collectionId, current.id));
      if (
        (total?.total ?? 0) - command.removeProductIds.length + command.addProductIds.length >
        LIBRARY_COLLECTION_ITEM_LIMIT
      )
        throw fail("COLLECTION_ITEM_LIMIT");
      for (const productId of command.addProductIds) {
        const [product] = await tx
          .select({ id: products.id })
          .from(products)
          .where(eq(products.id, productId))
          .limit(1)
          .for("share");
        const access = product
          ? await lockUserDownloadAccess(tx, input.userId, productId, sql`clock_timestamp()`)
          : null;
        if (!access) throw new NotFoundError("Library resource", productId);
        reconciliationTerms.push({ expiresAt: access.expiresAt });
      }
      writes.push(async () => {
        if (command.removeProductIds.length) {
          const removed = await tx
            .delete(members)
            .where(
              and(
                eq(members.collectionId, current.id),
                inArray(members.productId, command.removeProductIds),
              ),
            )
            .returning({ productId: members.productId });
          if (removed.length !== command.removeProductIds.length) throw fail("COLLECTION_CONFLICT");
        }
        if (command.addProductIds.length)
          await tx
            .insert(members)
            .values(
              command.addProductIds.map((productId) => ({ collectionId: current.id, productId })),
            );
      });
    } else if (command.action === "add-many") {
      // Lock resources and grants in canonical order. Do not write a partial batch.
      const accessTerms: { productId: string; expiresAt: Date | null }[] = [];
      for (const productId of command.productIds) {
        const [product] = await tx
          .select({ id: products.id })
          .from(products)
          .where(eq(products.id, productId))
          .limit(1)
          .for("share");
        const access = product
          ? await lockUserDownloadAccess(tx, input.userId, productId, sql`clock_timestamp()`)
          : null;
        if (!access) throw new NotFoundError("Library resource", productId);
        accessTerms.push({ productId, expiresAt: access.expiresAt });
      }
      const present = await tx
        .select({ productId: members.productId })
        .from(members)
        .where(
          and(eq(members.collectionId, current.id), inArray(members.productId, command.productIds)),
        );
      const presentIds = new Set(present.map((item) => item.productId));
      const missing = command.productIds.filter((id) => !presentIds.has(id));
      const [total] = await tx
        .select({ total: count() })
        .from(members)
        .where(eq(members.collectionId, current.id));
      if ((total?.total ?? 0) + missing.length > LIBRARY_COLLECTION_ITEM_LIMIT)
        throw fail("COLLECTION_ITEM_LIMIT");
      writes.push(async () => {
        // Recheck every expiry against database time after all potentially blocking locks.
        const [term] = await tx.execute<{ valid: boolean }>(
          sql`select ${sql.join(
            accessTerms.map((access) =>
              access.expiresAt === null
                ? sql`true`
                : sql`${access.expiresAt}::timestamptz > clock_timestamp()`,
            ),
            sql` AND `,
          )} AS valid`,
        );
        if (term?.valid !== true) throw fail("COLLECTION_ACCESS_CHANGED");

        if (missing.length)
          await tx
            .insert(members)
            .values(missing.map((productId) => ({ collectionId: current.id, productId })));
      });
    } else if (command.action === "remove-many") {
      writes.push(async () => {
        // References can be cleaned up even after resource deletion or revoked access.
        await tx
          .delete(members)
          .where(
            and(
              eq(members.collectionId, current.id),
              inArray(members.productId, command.productIds),
            ),
          );
      });
    } else if (command.action === "add") {
      const [product] = await tx
        .select({ id: products.id })
        .from(products)
        .where(eq(products.id, command.productId))
        .limit(1)
        .for("share");
      const access = product
        ? await lockUserDownloadAccess(tx, input.userId, command.productId, sql`clock_timestamp()`)
        : null;
      if (!access) throw new NotFoundError("Library resource", command.productId);
      const [member] = await tx
        .select({ productId: members.productId })
        .from(members)
        .where(and(eq(members.collectionId, current.id), eq(members.productId, command.productId)))
        .limit(1);
      if (!member) {
        const [total] = await tx
          .select({ total: count() })
          .from(members)
          .where(eq(members.collectionId, current.id));
        if ((total?.total ?? 0) >= LIBRARY_COLLECTION_ITEM_LIMIT)
          throw fail("COLLECTION_ITEM_LIMIT");
      }
      writes.push(async () => {
        // Recheck expiry against the database clock after acquiring all locks.
        const [term] = await tx.execute<{ valid: boolean }>(
          sql`select ${access.expiresAt === null ? sql`true` : sql`${access.expiresAt}::timestamptz > clock_timestamp()`} AS valid`,
        );
        if (term?.valid !== true) throw new NotFoundError("Library resource", command.productId);

        if (!member)
          await tx
            .insert(members)
            .values({ collectionId: current.id, productId: command.productId });
      });
    } else if (command.action === "remove") {
      writes.push(async () => {
        // Lost access does not prevent removal of the owner's private reference.
        await tx
          .delete(members)
          .where(
            and(eq(members.collectionId, current.id), eq(members.productId, command.productId)),
          );
      });
    }
    writes.push(async () => {
      const [updated] = await tx
        .update(collections)
        .set({
          name: command.action === "rename" ? command.name : current.name,
          status: command.action === "archive" ? "archived" : "active",
          revision: current.revision + 1,
          updatedAt: sql`greatest(clock_timestamp(),${collections.updatedAt})`,
        })
        .where(
          and(
            eq(collections.id, current.id),
            eq(collections.userId, input.userId),
            eq(collections.revision, current.revision),
          ),
        )
        .returning(fields);
      if (!updated) throw fail("COLLECTION_CONFLICT");
      collection = updated;
    });
  }
  return {
    replayed: false,
    write: async (): Promise<LibraryCollectionResult> => {
      for (const write of writes) await write();
      const [record] = await tx
        .insert(receipts)
        .values({
          id: input.receiptId,
          userId: input.userId,
          requestId: command.requestId,
          collectionId: collection.id,
          commandDigest: digest,
          command,
          snapshot: {
            id: collection.id,
            name: collection.name,
            status: collection.status,
            revision: collection.revision,
          },
        })
        .returning(receiptFields);
      await tx.insert(auditEvents).values({
        id: input.auditId,
        actorId: input.userId,
        actorType: "user",
        action: `library.collection_${command.action}`,
        targetType: "library_collection",
        targetId: collection.id,
        details: {
          requestId: command.requestId,
          receiptId: record.id,
          ...(input.membershipBatchId ? { membershipBatchId: input.membershipBatchId } : {}),
          revision: collection.revision,
          ...(command.action === "copy-items" || command.action === "move-items"
            ? {
                sourceCollectionId: command.sourceCollectionId,
                sourceRevision: command.expectedSourceRevision,
              }
            : {}),
          ...(command.action === "reconcile-items"
            ? { addProductIds: command.addProductIds, removeProductIds: command.removeProductIds }
            : command.action === "add" || command.action === "remove"
              ? { productId: command.productId }
              : "productIds" in command
                ? { productIds: command.productIds }
                : command.action === "duplicate"
                  ? {
                      sourceCollectionId: command.sourceCollectionId,
                      sourceRevision: command.expectedRevision,
                      itemCount: command.expectedItemCount,
                      sourceDigest: command.sourceDigest,
                    }
                  : {}),
        },
      });
      // Check finite grants after membership, successor, receipt and required audit writes.
      if (reconciliationTerms.length) {
        const [term] = await tx.execute<{ valid: boolean }>(
          sql`select ${sql.join(
            reconciliationTerms.map((access) =>
              access.expiresAt === null
                ? sql`true`
                : sql`${access.expiresAt}::timestamptz > clock_timestamp()`,
            ),
            sql` AND `,
          )} AS valid`,
        );
        if (term?.valid !== true) throw fail("COLLECTION_ACCESS_CHANGED");
      }
      return { receipt: publicReceipt(record), replayed: false };
    },
  };
}

export async function applyLibraryCollectionCommand(
  tx: ResourceTransaction,
  input: LibraryCollectionCommandInput,
) {
  const prepared = await prepareLibraryCollectionCommand(tx, input);
  await lockInitiatingSession(tx, input.userId, input.currentToken);
  return prepared.write();
}
