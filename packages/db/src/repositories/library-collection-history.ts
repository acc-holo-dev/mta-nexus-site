import {
  AppError,
  NotFoundError,
  LIBRARY_COLLECTION_HISTORY_ACTIONS,
  LIBRARY_COLLECTION_HISTORY_DAYS,
  type LibraryCollectionHistoryQuery,
  type LibraryCollectionHistoryPage,
  type LibraryCollectionReceipt,
} from "@nexus/domain";
import { libraryCollectionIdSchema, libraryCollectionReceiptSchema } from "@nexus/validation";
import { and, count, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import { db } from "../client";
import {
  libraryCollectionReceipts as receipts,
  libraryCollections as collections,
  users,
  products,
  builds,
} from "../schema";
import { historyPageBounds } from "./history-pagination";
import { effectiveUserDownloadSources } from "./user-library";
import { safePublishedBuildCondition } from "./build-safety";

export function validateLibraryCollectionHistoryQuery(query: LibraryCollectionHistoryQuery) {
  if (
    !Number.isInteger(query.page) ||
    query.page < 1 ||
    query.page > 9999 ||
    !LIBRARY_COLLECTION_HISTORY_DAYS.includes(query.days) ||
    !LIBRARY_COLLECTION_HISTORY_ACTIONS.includes(query.action) ||
    [query.collectionId, query.productId].some(
      (id) => id !== undefined && !libraryCollectionIdSchema.safeParse(id).success,
    )
  )
    throw new AppError("Invalid collection history query", 400, "COLLECTION_INVALID");
}
function recorded(row: {
  id: string;
  requestId: string;
  collectionId: string;
  command: unknown;
  snapshot: unknown;
  createdAt: Date | string;
}): LibraryCollectionReceipt | null {
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
    createdAt: new Date(row.createdAt).toISOString(),
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
    parsed.data.collection.id !== row.collectionId
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
function resourceIds(receipt: LibraryCollectionReceipt | null) {
  const command = receipt?.command;
  return command
    ? "productIds" in command
      ? command.productIds
      : "productId" in command
        ? [command.productId]
        : []
    : [];
}
export async function readLibraryCollectionHistory(
  userId: string,
  query: LibraryCollectionHistoryQuery,
): Promise<LibraryCollectionHistoryPage> {
  validateLibraryCollectionHistoryQuery(query);
  return db.transaction(
    async (tx) => {
      const [actor] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (!actor) throw new NotFoundError("Library account");
      const [clock] = await tx.execute<{ observedAt: Date | string }>(
        sql`SELECT transaction_timestamp() AS "observedAt"`,
      );
      const observedAt = new Date(clock?.observedAt ?? "");
      if (!Number.isFinite(observedAt.getTime()))
        throw new AppError(
          "Invalid collection history snapshot",
          500,
          "COLLECTION_SNAPSHOT_INVALID",
        );
      const scope = and(
        eq(receipts.userId, userId),
        gte(receipts.createdAt, sql`transaction_timestamp()-${query.days}*interval '1 day'`),
        lte(receipts.createdAt, sql`transaction_timestamp()`),
        query.action === "all" ? undefined : sql`${receipts.command}->>'action'=${query.action}`,
        query.collectionId
          ? or(
              eq(receipts.collectionId, query.collectionId),
              sql`${receipts.command}->>'action' IN ('duplicate','copy-items','move-items') AND ${receipts.command}->>'sourceCollectionId'=${query.collectionId}`,
            )
          : undefined,
        query.productId
          ? or(
              sql`${receipts.command}->>'action' IN ('add','remove') AND ${receipts.command}->>'productId'=${query.productId}`,
              sql`${receipts.command}->>'action' IN ('add-many','remove-many','copy-items','move-items') AND ${receipts.command}->'productIds' @> ${JSON.stringify([query.productId])}::jsonb`,
            )
          : undefined,
      );
      const [summary] = await tx.select({ total: count() }).from(receipts).where(scope);
      const bounds = historyPageBounds(summary?.total ?? 0, query.page);
      const rows = await tx
        .select({
          id: receipts.id,
          requestId: receipts.requestId,
          collectionId: receipts.collectionId,
          command: receipts.command,
          snapshot: receipts.snapshot,
          createdAt: receipts.createdAt,
        })
        .from(receipts)
        .where(scope)
        .orderBy(desc(receipts.createdAt), desc(receipts.id))
        .limit(bounds.pageSize)
        .offset(bounds.offset);
      const parsed = rows.map((row) => ({
        id: row.id,
        createdAt: new Date(row.createdAt).toISOString(),
        receipt: recorded(row),
      }));
      const productIds = [...new Set(parsed.flatMap((row) => resourceIds(row.receipt)))];
      const collectionIds = [
        ...new Set(
          parsed.flatMap((row) => {
            const receipt = row.receipt;
            return receipt
              ? [
                  receipt.collection.id,
                  ...("sourceCollectionId" in receipt.command
                    ? [receipt.command.sourceCollectionId]
                    : []),
                ]
              : [];
          }),
        ),
      ];
      const currentCollections = collectionIds.length
        ? await tx
            .select({
              id: collections.id,
              name: collections.name,
              status: collections.status,
              revision: collections.revision,
            })
            .from(collections)
            .where(and(eq(collections.userId, userId), inArray(collections.id, collectionIds)))
            .limit(40)
        : [];
      const currentResources = productIds.length
        ? await tx.execute<{ productId: string; title: string | null; available: boolean }>(sql`
      ${effectiveUserDownloadSources(userId, sql`transaction_timestamp()`)}, refs AS (SELECT value AS id FROM jsonb_array_elements_text(${JSON.stringify(productIds)}::jsonb))
      SELECT refs.id AS "productId", CASE WHEN owned.resource_id IS NOT NULL AND product.status='published' AND latest.id IS NOT NULL THEN left(product.title,200) END AS title,
        coalesce(owned.resource_id IS NOT NULL AND product.status='published' AND latest.id IS NOT NULL,false) AS available
      FROM refs LEFT JOIN owned ON owned.resource_id=refs.id LEFT JOIN ${products} product ON product.id=refs.id
      LEFT JOIN LATERAL (SELECT ${builds.id} AS id FROM ${builds} WHERE ${safePublishedBuildCondition(sql`product.id`)} LIMIT 1) latest ON true
    `)
        : [];
      const byCollection = new Map(currentCollections.map((row) => [row.id, row]));
      const byResource = new Map(currentResources.map((row) => [row.productId, row]));
      return {
        schemaVersion: 1,
        generatedAt: observedAt.toISOString(),
        days: query.days,
        action: query.action,
        collectionId: query.collectionId ?? null,
        productId: query.productId ?? null,
        page: bounds.page,
        pageSize: bounds.pageSize,
        total: bounds.total,
        totalPages: bounds.totalPages,
        items: parsed.map((row) => ({
          ...row,
          currentCollection: row.receipt
            ? (byCollection.get(row.receipt.collection.id) ?? null)
            : null,
          currentSource:
            row.receipt && "sourceCollectionId" in row.receipt.command
              ? (byCollection.get(row.receipt.command.sourceCollectionId) ?? null)
              : null,
          resources: resourceIds(row.receipt).map((productId) => {
            const now = byResource.get(productId),
              available = now?.available === true;
            return {
              productId,
              currentTitle: available ? now.title : null,
              currentAvailable: available,
            };
          }),
        })),
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
