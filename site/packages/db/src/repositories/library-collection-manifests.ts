import {
  AppError,
  NotFoundError,
  LIBRARY_COLLECTION_ITEM_LIMIT,
  LIBRARY_COLLECTION_BATCH_LIMIT,
  type LibraryCollectionManifest,
  type LibraryCollectionImportPreview,
  type LibraryCollectionReconcilePreview,
} from "@nexus/domain";
import { libraryCollectionIdSchema, libraryCollectionManifestSchema } from "@nexus/validation";
import { and, asc, count, eq, sql } from "drizzle-orm";
import { db } from "../client";
import {
  libraryCollections as collections,
  libraryCollectionItems as members,
  users,
  products,
  builds,
} from "../schema";
import { effectiveUserDownloadSources } from "./user-library";
import { safePublishedBuildCondition } from "./build-safety";
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const options = { isolationLevel: "repeatable read", accessMode: "read only" } as const;
async function target(tx: Tx, userId: string, id: string) {
  const [actor] = await tx
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!actor) throw new NotFoundError("Library account");
  const [collection] = await tx
    .select({
      id: collections.id,
      name: collections.name,
      status: collections.status,
      revision: collections.revision,
    })
    .from(collections)
    .where(and(eq(collections.userId, userId), eq(collections.id, id)))
    .limit(1);
  if (!collection) throw new NotFoundError("Collection");
  const [clock] = await tx.execute<{ observedAt: Date | string }>(
    sql`SELECT transaction_timestamp() AS "observedAt"`,
  );
  const date = new Date(clock?.observedAt ?? "");
  if (!Number.isFinite(date.getTime()))
    throw new AppError("Invalid collection snapshot", 500, "COLLECTION_SNAPSHOT_INVALID");
  return { collection, generatedAt: date.toISOString() };
}
function validateId(id: string) {
  if (!libraryCollectionIdSchema.safeParse(id).success)
    throw new AppError("Invalid collection ID", 400, "COLLECTION_INVALID");
}
export async function exportLibraryCollection(
  userId: string,
  id: string,
): Promise<LibraryCollectionManifest> {
  validateId(id);
  return db.transaction(async (tx) => {
    const snapshot = await target(tx, userId, id);
    const refs = await tx
      .select({ productId: members.productId })
      .from(members)
      .where(eq(members.collectionId, id))
      .orderBy(asc(members.productId))
      .limit(LIBRARY_COLLECTION_ITEM_LIMIT + 1);
    const manifest = libraryCollectionManifestSchema.safeParse({
      schemaVersion: 1,
      ...snapshot,
      productIds: refs.map((row) => row.productId),
    });
    if (!manifest.success)
      throw new AppError("Invalid collection manifest", 500, "COLLECTION_SNAPSHOT_INVALID");
    return manifest.data;
  }, options);
}
/** An imported manifest is untrusted reference input, never ownership or download authority. */
export function previewLibraryCollectionImport(
  userId: string,
  id: string,
  input: unknown,
): Promise<LibraryCollectionImportPreview>;
export function previewLibraryCollectionImport(
  userId: string,
  id: string,
  input: unknown,
  reconcile: true,
): Promise<LibraryCollectionReconcilePreview>;
export async function previewLibraryCollectionImport(
  userId: string,
  id: string,
  input: unknown,
  reconcile = false,
): Promise<LibraryCollectionImportPreview | LibraryCollectionReconcilePreview> {
  validateId(id);
  const parsed = libraryCollectionManifestSchema.safeParse(input);
  if (!parsed.success) throw new AppError("Invalid collection manifest", 400, "COLLECTION_INVALID");
  return db.transaction(async (tx) => {
    const snapshot = await target(tx, userId, id);
    const [summary] = await tx
      .select({ total: count() })
      .from(members)
      .where(eq(members.collectionId, id));
    const itemCount = Number(summary?.total ?? 0);
    if (
      !Number.isSafeInteger(itemCount) ||
      itemCount < 0 ||
      itemCount > LIBRARY_COLLECTION_ITEM_LIMIT
    )
      throw new AppError("Invalid collection size", 500, "COLLECTION_SNAPSHOT_INVALID");
    const currentRefs = reconcile
      ? await tx
          .select({ productId: members.productId })
          .from(members)
          .where(eq(members.collectionId, id))
          .orderBy(asc(members.productId))
          .limit(LIBRARY_COLLECTION_ITEM_LIMIT + 1)
      : [];
    if (
      reconcile &&
      (currentRefs.length !== itemCount ||
        currentRefs.some((row) => !libraryCollectionIdSchema.safeParse(row.productId).success))
    )
      throw new AppError("Invalid collection snapshot", 500, "COLLECTION_SNAPSHOT_INVALID");
    const existingIds = new Set(currentRefs.map((row) => row.productId)),
      manifestIds = new Set(parsed.data.productIds);
    const productIds = reconcile
      ? [...new Set([...parsed.data.productIds, ...existingIds])].sort()
      : parsed.data.productIds;
    const rows = productIds.length
      ? await tx.execute<{
          productId: string;
          title: string | null;
          available: boolean;
          inCollection: boolean;
          hasAccess: boolean;
        }>(sql`
      ${effectiveUserDownloadSources(userId, sql`transaction_timestamp()`)}, refs AS (SELECT value AS id FROM jsonb_array_elements_text(${JSON.stringify(productIds)}::jsonb))
      SELECT refs.id AS "productId", CASE WHEN owned.resource_id IS NOT NULL AND product.status='published' AND latest.id IS NOT NULL THEN left(product.title,200) END AS title,
        coalesce(owned.resource_id IS NOT NULL AND product.status='published' AND latest.id IS NOT NULL,false) AS available,
        member.product_id IS NOT NULL AS "inCollection", owned.resource_id IS NOT NULL AND product.id IS NOT NULL AS "hasAccess"
      FROM refs LEFT JOIN owned ON owned.resource_id=refs.id LEFT JOIN ${products} product ON product.id=refs.id
      LEFT JOIN ${members} member ON member.collection_id=${id} AND member.product_id=refs.id
      LEFT JOIN LATERAL (SELECT ${builds.id} AS id FROM ${builds} WHERE ${safePublishedBuildCondition(sql`product.id`)} LIMIT 1) latest ON true
    `)
      : [];
    const byId = new Map(rows.map((row) => [row.productId, row]));
    const writable =
      snapshot.collection.status === "active" &&
      snapshot.collection.revision < 2147483647 &&
      (reconcile || itemCount < LIBRARY_COLLECTION_ITEM_LIMIT);
    return {
      schemaVersion: 1,
      ...snapshot,
      itemCount,
      itemLimit: LIBRARY_COLLECTION_ITEM_LIMIT,
      batchLimit: LIBRARY_COLLECTION_BATCH_LIMIT,
      items: productIds.map((productId) => {
        const row = byId.get(productId),
          available = row?.available === true,
          inCollection = reconcile ? existingIds.has(productId) : row?.inCollection === true;
        return {
          productId,
          title: available ? row.title : null,
          available,
          inCollection,
          canAdd:
            writable && row?.hasAccess === true && !inCollection && manifestIds.has(productId),
          ...(reconcile
            ? {
                inManifest: manifestIds.has(productId),
                canRemove: writable && inCollection && !manifestIds.has(productId),
              }
            : {}),
        };
      }),
    };
  }, options);
}
