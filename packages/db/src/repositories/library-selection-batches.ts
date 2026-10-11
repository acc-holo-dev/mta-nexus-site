import { createHash } from "node:crypto";
import {
  AppError,
  NotFoundError,
  LIBRARY_COLLECTION_COMMAND_LIMIT,
  nextLibrarySelection,
  type LibrarySelectionBatchChoice,
  type LibrarySelectionBatchCommand,
  type LibrarySelectionBatchPreview,
  type LibrarySelectionBatchReceipt,
  type LibrarySelectionBatchResult,
} from "@nexus/domain";
import {
  libraryCollectionIdSchema,
  librarySelectionBatchChoiceSchema,
  librarySelectionBatchCommandSchema,
  librarySelectionBatchSnapshotSchema,
} from "@nexus/validation";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../client";
import {
  auditEvents,
  builds,
  libraryCollections as collections,
  libraryCollectionItems as members,
  librarySelectionBatchReceipts as receipts,
  products,
  resourceLibrarySelections as selections,
  users,
} from "../schema";
import { safePublishedBuildCondition, trustedCleanScanCondition } from "./build-safety";
import { lockUserDownloadAccess, type ResourceTransaction } from "./entitlements";
import { effectiveUserDownloadSources } from "./user-library";
import { historyPageBounds } from "./history-pagination";
const fail = (code: string) => new AppError("Selection batch changed or is unavailable", 409, code);
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const collectionFields = {
  id: collections.id,
  name: collections.name,
  status: collections.status,
  revision: collections.revision,
};
async function limits(tx: ResourceTransaction) {
  await tx.execute(sql`set local lock_timeout='5s'`);
  await tx.execute(sql`set local statement_timeout='10s'`);
}
async function clock(tx: ResourceTransaction) {
  const [row] = await tx.execute<{ observedAt: string }>(
    sql`select date_trunc('milliseconds',clock_timestamp())::text AS "observedAt"`,
  );
  const observedAt = new Date(row?.observedAt ?? "");
  if (!Number.isFinite(observedAt.getTime())) throw fail("SELECTION_BATCH_TIME_UNKNOWN");
  return observedAt;
}
async function owner(tx: ResourceTransaction, userId: string, id: string, lock = false) {
  const uq = tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  const [user] = await (lock ? uq.for("share") : uq);
  if (!user) throw new NotFoundError("Library");
  const cq = tx
    .select(collectionFields)
    .from(collections)
    .where(and(eq(collections.id, id), eq(collections.userId, userId)))
    .limit(1);
  const [collection] = await (lock ? cq.for("share") : cq);
  if (!collection) throw new NotFoundError("Collection");
  return collection;
}
type Candidate = {
  productId: string;
  title: string;
  version: string;
  targetBuildId: string | null;
  revision: number;
  mode: "fixed" | "latest";
  buildId: string | null;
  hash: string | null;
  size: number | null;
};
async function candidates(
  tx: ResourceTransaction,
  userId: string,
  ids: string[],
  mode: "fixed" | "latest",
  observedAt: Date,
) {
  const rows = await tx.execute<Candidate>(sql`${effectiveUserDownloadSources(userId, observedAt)}
    SELECT p.id AS "productId",left(p.title,200) AS title,chosen.version,chosen.id AS "targetBuildId",
      coalesce(pref.revision,0) AS revision,coalesce(pref.mode,'latest') AS mode,pref.build_id AS "buildId",
      chosen.sha256_hash AS hash,chosen.file_size_bytes AS size
    FROM ${products} p JOIN owned ON owned.resource_id=p.id
    LEFT JOIN ${selections} pref ON pref.user_id=${userId} AND pref.product_id=p.id
    LEFT JOIN LATERAL (SELECT * FROM ${builds} WHERE ${safePublishedBuildCondition(sql`p.id`)}
      ORDER BY ${builds.createdAt} DESC,${builds.id} DESC LIMIT 1) latest ON true
    LEFT JOIN LATERAL (SELECT * FROM ${builds} WHERE ${safePublishedBuildCondition(sql`p.id`)}
      AND ${builds.id}=CASE WHEN ${mode}='fixed' AND pref.mode='fixed' THEN pref.build_id ELSE latest.id END LIMIT 1) chosen ON true
    WHERE p.id IN (SELECT value FROM jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb))
      AND p.status='published' ORDER BY p.id`);
  return rows.sort((a, b) => (a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0));
}
async function prepare(
  tx: ResourceTransaction,
  userId: string,
  id: string,
  choice: LibrarySelectionBatchChoice,
  lock: boolean,
) {
  const collection = await owner(tx, userId, id, lock);
  if (collection.status !== "active") throw fail("COLLECTION_ARCHIVED");
  const mq = tx
    .select({ id: members.productId })
    .from(members)
    .where(and(eq(members.collectionId, id), inArray(members.productId, choice.productIds)))
    .orderBy(members.productId);
  const membership = await (lock ? mq.for("share") : mq);
  if (membership.length !== choice.productIds.length) throw fail("SELECTION_BATCH_CHANGED");
  const expiries: (Date | null)[] = [];
  if (lock) {
    const productRows = await tx
      .select({ id: products.id })
      .from(products)
      .where(inArray(products.id, choice.productIds))
      .orderBy(products.id)
      .for("share");
    if (productRows.length !== choice.productIds.length) throw fail("SELECTION_BATCH_UNAVAILABLE");
    for (const productId of choice.productIds) {
      const access = await lockUserDownloadAccess(tx, userId, productId);
      if (!access) throw fail("SELECTION_BATCH_UNAVAILABLE");
      expiries.push(access.expiresAt);
    }
    await tx
      .select({ id: selections.productId })
      .from(selections)
      .where(and(eq(selections.userId, userId), inArray(selections.productId, choice.productIds)))
      .orderBy(selections.productId)
      .for("update");
  }
  let observedAt = await clock(tx),
    rows = await candidates(tx, userId, choice.productIds, choice.mode, observedAt);
  const assertRows = () => {
    if (
      rows.length !== choice.productIds.length ||
      rows.some(
        (r) =>
          !r.targetBuildId ||
          r.targetBuildId.length > 128 ||
          !r.hash ||
          !/^[a-f0-9]{64}$/u.test(r.hash) ||
          !Number.isSafeInteger(r.size) ||
          (r.size ?? 0) <= 0 ||
          !Number.isSafeInteger(r.revision) ||
          r.revision < 0 ||
          r.revision >= 2147483647,
      )
    )
      throw fail("SELECTION_BATCH_UNAVAILABLE");
  };
  assertRows();
  if (lock) {
    const targets = [...new Set(rows.map((r) => r.targetBuildId as string))].sort();
    const locked = await tx
      .select({ id: builds.id })
      .from(builds)
      .where(
        and(
          inArray(builds.id, targets),
          eq(builds.status, "published"),
          trustedCleanScanCondition(),
        ),
      )
      .orderBy(builds.id)
      .for("share");
    if (locked.length !== targets.length) throw fail("SELECTION_BATCH_CHANGED");
    observedAt = await clock(tx);
    if (expiries.some((expiry) => expiry !== null && expiry <= observedAt))
      throw fail("SELECTION_BATCH_UNAVAILABLE");
    rows = await candidates(tx, userId, choice.productIds, choice.mode, observedAt);
    assertRows();
    if (rows.some((r) => !targets.includes(r.targetBuildId as string)))
      throw fail("SELECTION_BATCH_CHANGED");
  }
  const items = rows.map((r) => {
    const previous = { revision: r.revision, mode: r.mode, buildId: r.buildId };
    return {
      productId: r.productId,
      previous,
      next: nextLibrarySelection(previous, choice.mode, r.targetBuildId as string),
      title: r.title,
      version: r.version,
      targetBuildId: r.targetBuildId as string,
    };
  });
  const previewDigest = hash({
    userId,
    collection,
    choice,
    items: items.map((item, index) => ({
      productId: item.productId,
      previous: item.previous,
      next: item.next,
      targetBuildId: item.targetBuildId,
      hash: rows[index].hash,
      size: rows[index].size,
    })),
  });
  const preview: LibrarySelectionBatchPreview = {
    collection,
    choice,
    previewDigest,
    items,
    changedCount: items.filter((i) => i.previous.revision !== i.next.revision).length,
  };
  return { preview, observedAt };
}
function publicReceipt(row: typeof receipts.$inferSelect): LibrarySelectionBatchReceipt {
  const command = librarySelectionBatchCommandSchema.safeParse(row.command),
    snapshot = librarySelectionBatchSnapshotSchema.safeParse(row.snapshot);
  if (
    !command.success ||
    !snapshot.success ||
    command.data.requestId !== row.requestId ||
    row.commandDigest !== hash({ collectionId: row.collectionId, command: command.data }) ||
    snapshot.data.collectionId !== row.collectionId ||
    snapshot.data.mode !== command.data.mode ||
    JSON.stringify(snapshot.data.items.map((i) => i.productId)) !==
      JSON.stringify(command.data.productIds) ||
    snapshot.data.items.some(
      (i) =>
        JSON.stringify(i.next) !==
        JSON.stringify(nextLibrarySelection(i.previous, command.data.mode, i.next.buildId ?? "")),
    )
  )
    throw fail("SELECTION_BATCH_RECEIPT_INVALID");
  return {
    id: row.id,
    requestId: row.requestId,
    command: command.data,
    snapshot: snapshot.data,
    createdAt: row.createdAt,
  };
}
export class LibrarySelectionBatchesRepository {
  async preview(userId: string, id: string, input: LibrarySelectionBatchChoice) {
    const choice = librarySelectionBatchChoiceSchema.parse(input);
    libraryCollectionIdSchema.parse(id);
    return db.transaction(
      async (tx) => {
        await limits(tx);
        return (await prepare(tx, userId, id, choice, false)).preview;
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
  async command(input: {
    userId: string;
    collectionId: string;
    command: LibrarySelectionBatchCommand;
    receiptId: string;
    auditId: string;
  }): Promise<LibrarySelectionBatchResult> {
    const parsed = librarySelectionBatchCommandSchema.safeParse(input.command);
    if (!parsed.success || !libraryCollectionIdSchema.safeParse(input.collectionId).success)
      throw new AppError("Invalid selection batch", 400, "SELECTION_BATCH_INVALID");
    const command = parsed.data,
      digest = hash({ collectionId: input.collectionId, command });
    return db.transaction(
      async (tx) => {
        await limits(tx);
        // Match collection mutations and acquire all existing selection locks in stable order.
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${`library-collections:${input.userId}`}))`,
        );
        for (const productId of command.productIds)
          await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext(${`library-selection:${input.userId}:${productId}`}))`,
          );
        await owner(tx, input.userId, input.collectionId, true);
        const [prior] = await tx
          .select()
          .from(receipts)
          .where(and(eq(receipts.userId, input.userId), eq(receipts.requestId, command.requestId)))
          .limit(1);
        if (prior) {
          if (prior.commandDigest !== digest || prior.collectionId !== input.collectionId)
            throw fail("SELECTION_BATCH_REQUEST_REUSED");
          return { receipt: publicReceipt(prior), replayed: true };
        }
        const [total] = await tx
          .select({ total: count() })
          .from(receipts)
          .where(eq(receipts.userId, input.userId));
        if ((total?.total ?? 0) >= LIBRARY_COLLECTION_COMMAND_LIMIT)
          throw fail("SELECTION_BATCH_LIMIT");
        const { preview, observedAt } = await prepare(
          tx,
          input.userId,
          input.collectionId,
          { mode: command.mode, productIds: command.productIds },
          true,
        );
        if (preview.previewDigest !== command.previewDigest) throw fail("SELECTION_BATCH_CHANGED");
        const changed = preview.items.filter((i) => i.next.revision !== i.previous.revision);
        if (changed.length) {
          const updated = await tx
            .insert(selections)
            .values(
              changed.map((i) => ({
                userId: input.userId,
                productId: i.productId,
                ...i.next,
                updatedAt: sql`greatest(${observedAt}::timestamptz,coalesce((select updated_at from resource_library_selections where user_id=${input.userId} and product_id=${i.productId}),${observedAt}::timestamptz)+interval '1 millisecond')`,
              })),
            )
            .onConflictDoUpdate({
              target: [selections.userId, selections.productId],
              set: {
                mode: sql`excluded.mode`,
                buildId: sql`excluded.build_id`,
                revision: sql`excluded.revision`,
                updatedAt: sql`excluded.updated_at`,
              },
              setWhere: sql`${selections.revision}=excluded.revision-1`,
            })
            .returning({ productId: selections.productId });
          if (updated.length !== changed.length) throw fail("SELECTION_BATCH_CHANGED");
          await tx.insert(auditEvents).values(
            changed.map((i) => ({
              id: `${input.auditId}_${i.productId}`,
              actorId: input.userId,
              actorType: "user",
              action: "library.release_selected",
              targetType: "product",
              targetId: i.productId,
              details: { ...i.next, batchReceiptId: input.receiptId },
            })),
          );
        }
        const snapshot = {
          collectionId: input.collectionId,
          collectionRevision: preview.collection.revision,
          mode: command.mode,
          items: preview.items.map(({ productId, previous, next }) => ({
            productId,
            previous,
            next,
          })),
        };
        const [receipt] = await tx
          .insert(receipts)
          .values({
            id: input.receiptId,
            userId: input.userId,
            requestId: command.requestId,
            collectionId: input.collectionId,
            commandDigest: digest,
            command,
            snapshot,
          })
          .returning();
        if (!receipt) throw fail("SELECTION_BATCH_RECEIPT_INVALID");
        await tx.insert(auditEvents).values({
          id: input.auditId,
          actorId: input.userId,
          actorType: "user",
          action: "library.selection_batch_applied",
          targetType: "collection",
          targetId: input.collectionId,
          details: {
            receiptId: receipt.id,
            collectionRevision: preview.collection.revision,
            mode: command.mode,
            changedCount: changed.length,
          },
        });
        return { receipt: publicReceipt(receipt), replayed: false };
      },
      { isolationLevel: "read committed" },
    );
  }
  async history(userId: string, id: string, page = 1) {
    return db.transaction(
      async (tx) => {
        await limits(tx);
        const collection = await owner(tx, userId, id);
        const condition = and(eq(receipts.userId, userId), eq(receipts.collectionId, id));
        const [total] = await tx.select({ total: count() }).from(receipts).where(condition);
        const bounds = historyPageBounds(total?.total ?? 0, page);
        const rows = await tx
          .select()
          .from(receipts)
          .where(condition)
          .orderBy(desc(receipts.createdAt), desc(receipts.id))
          .limit(bounds.pageSize)
          .offset(bounds.offset);
        return { collection, ...bounds, items: rows.map(publicReceipt) };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
}
export const librarySelectionBatchesRepository = new LibrarySelectionBatchesRepository();
