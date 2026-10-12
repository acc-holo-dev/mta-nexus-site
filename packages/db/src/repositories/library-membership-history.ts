import { createHash } from "node:crypto";
import {
  AppError,
  NotFoundError,
  LIBRARY_COLLECTION_HISTORY_DAYS,
  LIBRARY_MEMBERSHIP_HISTORY_OPERATIONS,
  type LibraryMembershipHistoryQuery,
  type LibraryMembershipHistoryItem,
  type LibraryMembershipHistoryPage,
  type LibraryMembershipHistoryDetail,
} from "@nexus/domain";
import {
  libraryCollectionIdSchema,
  libraryCollectionSnapshotSchema,
  libraryMembershipBatchCommandSchema,
  libraryMembershipBatchReceiptSchema,
} from "@nexus/validation";
import { and, count, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "../client";
import {
  libraryMembershipBatchReceipts as batches,
  libraryCollectionReceipts as receipts,
  libraryCollections as collections,
  libraryCollectionItems as items,
  users,
  products,
  builds,
} from "../schema";
import { historyPageBounds } from "./history-pagination";
import { effectiveUserDownloadSources } from "./user-library";
import { safePublishedBuildCondition } from "./build-safety";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const columns = {
  id: batches.id,
  requestId: batches.requestId,
  productId: batches.productId,
  commandDigest: batches.commandDigest,
  command: batches.command,
  childReceiptIds: batches.childReceiptIds,
  createdAt: batches.createdAt,
};
type Row = {
  id: string;
  requestId: string;
  productId: string;
  commandDigest: string;
  command: unknown;
  childReceiptIds: string[];
  createdAt: Date | string;
};
function timestamp(value: Date | string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
function parent(row: Row) {
  const command = libraryMembershipBatchCommandSchema.safeParse(row.command);
  if (
    !command.success ||
    !libraryCollectionIdSchema.safeParse(row.id).success ||
    !libraryCollectionIdSchema.safeParse(row.productId).success ||
    row.requestId !== command.data.requestId ||
    !timestamp(row.createdAt) ||
    !Array.isArray(row.childReceiptIds) ||
    row.childReceiptIds.length !== command.data.changes.length ||
    new Set(row.childReceiptIds).size !== row.childReceiptIds.length ||
    row.childReceiptIds.some((id) => !libraryCollectionIdSchema.safeParse(id).success) ||
    row.commandDigest !==
      createHash("sha256")
        .update(JSON.stringify({ productId: row.productId, command: command.data }))
        .digest("hex")
  )
    return null;
  return command.data;
}
export function validateLibraryMembershipHistoryQuery(query: LibraryMembershipHistoryQuery) {
  if (
    !Number.isInteger(query.page) ||
    query.page < 1 ||
    query.page > 9999 ||
    !LIBRARY_COLLECTION_HISTORY_DAYS.includes(query.days) ||
    !LIBRARY_MEMBERSHIP_HISTORY_OPERATIONS.includes(query.operation) ||
    [query.collectionId, query.productId].some(
      (id) => id !== undefined && !libraryCollectionIdSchema.safeParse(id).success,
    )
  )
    throw new AppError("Invalid membership history query", 400, "COLLECTION_INVALID");
}
async function clock(tx: Tx, userId: string) {
  const [actor] = await tx
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!actor) throw new NotFoundError("Library account");
  const [time] = await tx.execute<{ observedAt: Date | string }>(
    sql`SELECT transaction_timestamp() AS "observedAt"`,
  );
  const observedAt = timestamp(time?.observedAt ?? "");
  if (!observedAt)
    throw new AppError("Invalid membership history snapshot", 500, "COLLECTION_SNAPSHOT_INVALID");
  return observedAt;
}
async function hydrate(
  tx: Tx,
  userId: string,
  rows: Row[],
): Promise<LibraryMembershipHistoryItem[]> {
  const parents = rows.map((row) => ({ row, command: parent(row) }));
  const childIds = [...new Set(parents.flatMap((p) => (p.command ? p.row.childReceiptIds : [])))];
  const children = childIds.length
    ? await tx
        .select({
          id: receipts.id,
          requestId: receipts.requestId,
          collectionId: receipts.collectionId,
          command: receipts.command,
          snapshot: receipts.snapshot,
          createdAt: receipts.createdAt,
        })
        .from(receipts)
        .where(and(eq(receipts.userId, userId), inArray(receipts.id, childIds)))
        .limit(400)
    : [];
  const byChild = new Map(children.map((child) => [child.id, child]));
  const recorded = parents.map(({ row, command }) => {
    if (!command) return { row, receipt: null };
    const proof = libraryMembershipBatchReceiptSchema.safeParse({
      id: row.id,
      requestId: row.requestId,
      productId: row.productId,
      command,
      createdAt: timestamp(row.createdAt),
      children: row.childReceiptIds.map((id) => {
        const child = byChild.get(id);
        if (!child || (child.snapshot as { id?: unknown } | null)?.id !== child.collectionId)
          return null;
        return {
          id: child.id,
          requestId: child.requestId,
          command: child.command,
          collection: child.snapshot,
          createdAt: timestamp(child.createdAt),
        };
      }),
    });
    return {
      row,
      receipt: proof.success
        ? {
            ...proof.data,
            createdAt: new Date(proof.data.createdAt),
            children: proof.data.children.map((child) => ({
              ...child,
              createdAt: new Date(child.createdAt),
            })),
          }
        : null,
    };
  });
  const refs = recorded.flatMap(({ receipt }) =>
    receipt
      ? receipt.children.map((child) => ({
          collectionId: child.collection.id,
          productId: receipt.productId,
        }))
      : [],
  );
  const uniqueRefs = [
    ...new Map(
      refs.map((ref) => [JSON.stringify([ref.collectionId, ref.productId]), ref]),
    ).values(),
  ];
  const nowCollections = uniqueRefs.length
    ? await tx.execute<{
        collectionId: string;
        productId: string;
        id: string | null;
        name: string | null;
        status: "active" | "archived" | null;
        revision: number | null;
        inCollection: boolean;
      }>(sql`
    WITH refs AS (SELECT * FROM jsonb_to_recordset(${JSON.stringify(uniqueRefs)}::jsonb) AS ref("collectionId" text,"productId" text))
    SELECT refs."collectionId", refs."productId", c.id, c.name, c.status, c.revision,
      EXISTS(SELECT 1 FROM ${items} i WHERE i.collection_id=c.id AND i.product_id=refs."productId") AS "inCollection"
    FROM refs LEFT JOIN ${collections} c ON c.id=refs."collectionId" AND c.user_id=${userId}
  `)
    : [];
  const productIds = [
    ...new Set(recorded.flatMap(({ receipt }) => (receipt ? [receipt.productId] : []))),
  ];
  const nowResources = productIds.length
    ? await tx.execute<{ productId: string; title: string | null; available: boolean }>(sql`
    ${effectiveUserDownloadSources(userId, sql`transaction_timestamp()`)}, refs AS (SELECT value AS id FROM jsonb_array_elements_text(${JSON.stringify(productIds)}::jsonb))
    SELECT refs.id AS "productId", CASE WHEN owned.resource_id IS NOT NULL AND product.status='published' AND latest.id IS NOT NULL THEN left(product.title,200) END AS title,
      coalesce(owned.resource_id IS NOT NULL AND product.status='published' AND latest.id IS NOT NULL,false) AS available
    FROM refs LEFT JOIN owned ON owned.resource_id=refs.id LEFT JOIN ${products} product ON product.id=refs.id
    LEFT JOIN LATERAL (SELECT ${builds.id} AS id FROM ${builds} WHERE ${safePublishedBuildCondition(sql`product.id`)} LIMIT 1) latest ON true
  `)
    : [];
  const byCollection = new Map(
    nowCollections.map((row) => [JSON.stringify([row.collectionId, row.productId]), row]),
  );
  const byResource = new Map(nowResources.map((row) => [row.productId, row]));
  return recorded.map(({ row, receipt }) => {
    const now = receipt ? byResource.get(receipt.productId) : undefined;
    return {
      id: row.id,
      createdAt: timestamp(row.createdAt) ?? "",
      receipt,
      resource: receipt
        ? {
            productId: receipt.productId,
            currentTitle: now?.available === true ? now.title : null,
            currentAvailable: now?.available === true,
          }
        : null,
      collections: receipt
        ? receipt.children.map((child) => {
            const current = byCollection.get(
              JSON.stringify([child.collection.id, receipt.productId]),
            );
            const snapshot = libraryCollectionSnapshotSchema.safeParse(
              current
                ? {
                    id: current.id,
                    name: current.name,
                    status: current.status,
                    revision: current.revision,
                  }
                : null,
            );
            return {
              collectionId: child.collection.id,
              current: snapshot.success ? snapshot.data : null,
              inCollection: snapshot.success ? current?.inCollection === true : null,
            };
          })
        : [],
    };
  });
}
export async function readLibraryMembershipHistory(
  userId: string,
  query: LibraryMembershipHistoryQuery,
): Promise<LibraryMembershipHistoryPage> {
  validateLibraryMembershipHistoryQuery(query);
  return db.transaction(
    async (tx) => {
      const generatedAt = await clock(tx, userId);
      const additions = sql`EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(${batches.command}->'changes')='array' THEN ${batches.command}->'changes' ELSE '[]'::jsonb END) change WHERE change->>'inCollection'='true')`;
      const removals = sql`EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(${batches.command}->'changes')='array' THEN ${batches.command}->'changes' ELSE '[]'::jsonb END) change WHERE change->>'inCollection'='false')`;
      const scope = and(
        eq(batches.userId, userId),
        gte(batches.createdAt, sql`transaction_timestamp()-${query.days}*interval '1 day'`),
        lte(batches.createdAt, sql`transaction_timestamp()`),
        query.productId ? eq(batches.productId, query.productId) : undefined,
        query.collectionId
          ? sql`${batches.command}->'changes' @> ${JSON.stringify([{ collectionId: query.collectionId }])}::jsonb`
          : undefined,
        query.operation === "all"
          ? undefined
          : query.operation === "mixed"
            ? and(additions, removals)
            : query.operation === "additions"
              ? and(additions, sql`NOT ${removals}`)
              : and(removals, sql`NOT ${additions}`),
      );
      const [summary] = await tx.select({ total: count() }).from(batches).where(scope);
      const bounds = historyPageBounds(summary?.total ?? 0, query.page);
      const rows = await tx
        .select(columns)
        .from(batches)
        .where(scope)
        .orderBy(desc(batches.createdAt), desc(batches.id))
        .limit(bounds.pageSize)
        .offset(bounds.offset);
      return {
        schemaVersion: 1,
        generatedAt,
        days: query.days,
        operation: query.operation,
        collectionId: query.collectionId ?? null,
        productId: query.productId ?? null,
        page: bounds.page,
        pageSize: bounds.pageSize,
        total: bounds.total,
        totalPages: bounds.totalPages,
        items: await hydrate(tx, userId, rows),
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
export async function readLibraryMembershipHistoryDetail(
  userId: string,
  id: string,
): Promise<LibraryMembershipHistoryDetail> {
  if (!libraryCollectionIdSchema.safeParse(id).success)
    throw new AppError("Invalid membership receipt ID", 400, "COLLECTION_INVALID");
  return db.transaction(
    async (tx) => {
      const generatedAt = await clock(tx, userId);
      const rows = await tx
        .select(columns)
        .from(batches)
        .where(and(eq(batches.userId, userId), eq(batches.id, id)))
        .limit(1);
      if (!rows.length) throw new NotFoundError("Membership receipt");
      const [item] = await hydrate(tx, userId, rows);
      if (!item) throw new NotFoundError("Membership receipt");
      return { schemaVersion: 1, generatedAt, item };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
