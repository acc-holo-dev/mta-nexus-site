import {
  AppError,
  NotFoundError,
  LIBRARY_COLLECTION_ITEM_LIMIT,
  LIBRARY_COLLECTION_BATCH_LIMIT,
  type LibraryCollectionReceiptDetail,
} from "@nexus/domain";
import { libraryCollectionIdSchema, libraryCollectionSnapshotSchema } from "@nexus/validation";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "../client";
import {
  users,
  libraryCollectionReceipts as receipts,
  libraryCollections as collections,
  libraryCollectionItems as members,
  products,
  builds,
} from "../schema";
import { recordedCollectionReceipt } from "./library-collection-receipt-proof";
import { effectiveUserDownloadSources } from "./user-library";
import { safePublishedBuildCondition } from "./build-safety";
export async function readLibraryCollectionReceiptDetail(
  userId: string,
  id: string,
): Promise<LibraryCollectionReceiptDetail> {
  if (!libraryCollectionIdSchema.safeParse(id).success)
    throw new AppError("Invalid receipt ID", 400, "COLLECTION_INVALID");
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
      const time = new Date(clock?.observedAt ?? "");
      if (!Number.isFinite(time.getTime()))
        throw new AppError("Invalid receipt snapshot", 500, "COLLECTION_SNAPSHOT_INVALID");
      const generatedAt = time.toISOString();
      const [row] = await tx
        .select({
          id: receipts.id,
          requestId: receipts.requestId,
          collectionId: receipts.collectionId,
          commandDigest: receipts.commandDigest,
          command: receipts.command,
          snapshot: receipts.snapshot,
          createdAt: receipts.createdAt,
        })
        .from(receipts)
        .where(and(eq(receipts.userId, userId), eq(receipts.id, id)))
        .limit(1);
      if (!row) throw new NotFoundError("Collection receipt");
      const recordedTime = new Date(row.createdAt),
        receipt = recordedCollectionReceipt(row);
      const base: LibraryCollectionReceiptDetail = {
        schemaVersion: 1,
        generatedAt,
        id: row.id,
        createdAt: Number.isFinite(recordedTime.getTime()) ? recordedTime.toISOString() : "",
        receipt,
        currentCollection: null,
        restoration: null,
        resources: [],
      };
      if (!receipt) return base;
      const [current] = await tx
        .select({
          id: collections.id,
          name: collections.name,
          status: collections.status,
          revision: collections.revision,
        })
        .from(collections)
        .where(and(eq(collections.userId, userId), eq(collections.id, receipt.collection.id)))
        .limit(1);
      const snapshot = libraryCollectionSnapshotSchema.safeParse(current);
      if (!snapshot.success) return base;
      base.currentCollection = snapshot.data;
      if (receipt.command.action !== "reconcile-items") return base;
      const existing = await tx
        .select({ productId: members.productId })
        .from(members)
        .where(eq(members.collectionId, snapshot.data.id))
        .orderBy(asc(members.productId))
        .limit(LIBRARY_COLLECTION_ITEM_LIMIT + 1);
      if (
        existing.length > LIBRARY_COLLECTION_ITEM_LIMIT ||
        existing.some((row) => !libraryCollectionIdSchema.safeParse(row.productId).success)
      )
        throw new AppError(
          "Invalid collection membership snapshot",
          500,
          "COLLECTION_SNAPSHOT_INVALID",
        );
      const currentIds = new Set(existing.map((row) => row.productId)),
        adds = new Set(receipt.command.removeProductIds),
        removes = new Set(receipt.command.addProductIds),
        affected = [...adds, ...removes].sort();
      const rows = await tx.execute<{
        productId: string;
        title: string | null;
        available: boolean;
        hasAccess: boolean;
      }>(sql`
      ${effectiveUserDownloadSources(userId, sql`transaction_timestamp()`)}, refs AS (SELECT value AS id FROM jsonb_array_elements_text(${JSON.stringify(affected)}::jsonb))
      SELECT refs.id AS "productId", CASE WHEN owned.resource_id IS NOT NULL AND product.status='published' AND latest.id IS NOT NULL THEN left(product.title,200) END AS title,
        coalesce(owned.resource_id IS NOT NULL AND product.status='published' AND latest.id IS NOT NULL,false) AS available,
        owned.resource_id IS NOT NULL AND product.id IS NOT NULL AS "hasAccess"
      FROM refs LEFT JOIN owned ON owned.resource_id=refs.id LEFT JOIN ${products} product ON product.id=refs.id
      LEFT JOIN LATERAL (SELECT ${builds.id} AS id FROM ${builds} WHERE ${safePublishedBuildCondition(sql`product.id`)} LIMIT 1) latest ON true
    `);
      const byId = new Map(rows.map((row) => [row.productId, row])),
        writable = snapshot.data.status === "active" && snapshot.data.revision < 2147483647;
      base.resources = affected.map((productId) => {
        const resource = byId.get(productId),
          inCollection = currentIds.has(productId),
          restoreAction = adds.has(productId) ? "add" : "remove",
          already = restoreAction === "add" ? inCollection : !inCollection;
        return {
          productId,
          currentTitle: resource?.available === true ? resource.title : null,
          currentAvailable: resource?.available === true,
          inCollection,
          restoreAction,
          status: already
            ? "already-restored"
            : !writable
              ? "read-only"
              : restoreAction === "add" && resource?.hasAccess !== true
                ? "no-access"
                : "ready",
        };
      });
      const byChange = new Map(base.resources.map((row) => [row.productId, row]));
      base.restoration = {
        schemaVersion: 1,
        generatedAt,
        collection: snapshot.data,
        itemCount: existing.length,
        itemLimit: LIBRARY_COLLECTION_ITEM_LIMIT,
        batchLimit: LIBRARY_COLLECTION_BATCH_LIMIT,
        items: [...new Set([...currentIds, ...affected])].sort().map((productId) => {
          const resource = byChange.get(productId);
          return {
            productId,
            title: resource?.currentAvailable === true ? resource.currentTitle : null,
            available: resource?.currentAvailable === true,
            inCollection: currentIds.has(productId),
            canAdd: resource?.status === "ready" && resource.restoreAction === "add",
            canRemove: resource?.status === "ready" && resource.restoreAction === "remove",
          };
        }),
      };
      return base;
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
