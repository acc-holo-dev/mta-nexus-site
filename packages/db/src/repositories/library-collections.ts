import {
  AppError,
  LIBRARY_COLLECTION_ITEM_LIMIT,
  LIBRARY_COLLECTION_LIMIT,
  type LibraryCollectionCopyPreview,
  type LibraryCollectionSnapshot,
  type LibraryReleaseFilter,
  type LibraryResourceCollections,
  NotFoundError,
} from "@nexus/domain";
import { libraryCollectionIdSchema } from "@nexus/validation";
import { and, asc, count, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "../client";
import {
  builds,
  libraryCollections as collections,
  libraryCollectionItems as members,
  products,
  libraryCollectionReceipts as receipts,
  resourceLibrarySelections as selections,
} from "../schema";
import { safePublishedBuildCondition } from "./build-safety";
import type { ResourceTransaction } from "./entitlements";
import { historyPageBounds } from "./history-pagination";
import {
  applyLibraryCollectionCommand,
  type LibraryCollectionCommandInput,
  validateCollectionCommand,
  withLibraryCollectionTransaction,
} from "./library-collection-command";
import {
  collectionReceiptScope,
  copySource,
  fail,
  fields,
  liveUser,
  owned,
  publicReceipt,
  readOptions,
  receiptFields,
} from "./library-collection-internals";
import { readLibraryReleasePage } from "./library-release-page";
import { containsPattern } from "./search-pattern";
import { effectiveUserDownloadSources } from "./user-library";

export type { LibraryCollectionCommandInput } from "./library-collection-command";

/** All entries are references. Current entitlement and clean publication are
 * independently projected; membership never widens download authorization. */
function resourceRows(userId: string, collectionId: string, candidates: boolean) {
  const source = candidates
    ? sql`FROM owned JOIN ${products} product ON product.id=owned.resource_id
        LEFT JOIN ${members} member ON member.collection_id=${collectionId} AND member.product_id=owned.resource_id`
    : sql`FROM ${members} member LEFT JOIN owned ON owned.resource_id=member.product_id
        LEFT JOIN ${products} product ON product.id=member.product_id`;
  return sql`${effectiveUserDownloadSources(userId, sql`transaction_timestamp()`)}, resource_rows AS (
    SELECT ${candidates ? sql`owned.resource_id` : sql`member.product_id`} AS "productId",
      ${candidates ? sql`owned.added_at` : sql`member.added_at`} AS "addedAt",
      owned.resource_id IS NOT NULL AS "hasAccess", member.product_id IS NOT NULL AS "inCollection",
      CASE WHEN owned.resource_id IS NOT NULL AND product.status='published' AND latest.id IS NOT NULL THEN left(product.title,200) END AS title,
      CASE WHEN owned.resource_id IS NOT NULL AND product.status='published' AND latest.id IS NOT NULL THEN product.slug END AS slug,
      CASE WHEN owned.resource_id IS NOT NULL AND product.status='published' AND latest.id IS NOT NULL
        THEN CASE WHEN pref.mode='fixed' THEN selected.version ELSE latest.version END END AS version,
      CASE WHEN owned.resource_id IS NOT NULL AND product.status='published' AND latest.id IS NOT NULL AND pref.mode='fixed' THEN selected.id END AS "buildId",
      coalesce(owned.resource_id IS NOT NULL AND product.status='published' AND latest.id IS NOT NULL AND (pref.mode IS NULL OR pref.mode='latest' OR selected.id IS NOT NULL),false) AS downloadable
    ${source}
    LEFT JOIN ${selections} pref ON pref.user_id=${userId} AND pref.product_id=product.id
    LEFT JOIN LATERAL (
      SELECT ${builds.id} AS id,${builds.version} AS version FROM ${builds}
      WHERE ${safePublishedBuildCondition(sql`product.id`)} ORDER BY ${builds.createdAt} DESC,${builds.id} DESC LIMIT 1
    ) latest ON true
    LEFT JOIN LATERAL (
      SELECT ${builds.id} AS id,${builds.version} AS version FROM ${builds}
      WHERE ${safePublishedBuildCondition(sql`product.id`)} AND ${builds.id}=pref.build_id LIMIT 1
    ) selected ON true
    ${candidates ? sql`` : sql`WHERE member.collection_id=${collectionId}`}
  )`;
}
export type LibraryCollectionItem = {
  productId: string;
  addedAt: Date;
  title: string | null;
  slug: string | null;
  version: string | null;
  buildId: string | null;
  downloadable: boolean;
  hasAccess: boolean;
  inCollection: boolean;
};
function validateItemQuery(id: string, page: number, q: string) {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: Reject controls in private collection search.
  const controls = typeof q === "string" && /[\u0000-\u001f\u007f]/u.test(q);
  if (
    !libraryCollectionIdSchema.safeParse(id).success ||
    !Number.isInteger(page) ||
    page < 1 ||
    page > 9999 ||
    typeof q !== "string" ||
    q.length > 80 ||
    controls
  )
    throw new AppError("Invalid collection items", 400, "COLLECTION_INVALID");
}
async function readCollectionItems(
  tx: ResourceTransaction,
  userId: string,
  id: string,
  page: number,
  q: string,
  candidates: boolean,
) {
  await liveUser(tx, userId);
  const collection = await owned(tx, userId, id);
  if (candidates && collection.status !== "active") throw fail("COLLECTION_ARCHIVED");
  const sources = resourceRows(userId, id, candidates),
    search = q ? sql`WHERE title ILIKE ${containsPattern(q)}` : sql``;
  const [summary] = await tx.execute<{ total: number; ready: number }>(sql`${sources}
        SELECT count(*)::integer AS total, count(*) FILTER(WHERE downloadable)::integer AS ready FROM resource_rows ${search}`);
  const bounds = historyPageBounds(Number(summary?.total ?? 0), page);
  const rows = await tx.execute<LibraryCollectionItem>(sql`${sources}
        SELECT "productId","addedAt",title,slug,version,"buildId",downloadable,"hasAccess","inCollection"
        FROM resource_rows ${search} ORDER BY "addedAt" DESC,"productId" ASC LIMIT ${bounds.pageSize} OFFSET ${bounds.offset}`);
  // postgres.js may return timestamptz as string; callers and contracts expect Date.
  const items = rows.map((item) => ({
    ...item,
    addedAt: item.addedAt instanceof Date ? item.addedAt : new Date(item.addedAt),
  }));
  return {
    collection,
    items,
    ...bounds,
    ready: Number(summary?.ready ?? 0),
    q,
    candidates,
    itemLimit: LIBRARY_COLLECTION_ITEM_LIMIT,
  };
}

export class LibraryCollectionsRepository {
  async resourceMemberships(
    userId: string,
    productId: string,
  ): Promise<LibraryResourceCollections> {
    if (!libraryCollectionIdSchema.safeParse(productId).success)
      throw new AppError("Invalid resource", 400, "COLLECTION_INVALID");
    return db.transaction(async (tx) => {
      await liveUser(tx, userId);
      const [resource] = await tx.execute<
        LibraryResourceCollections["resource"] & { generatedAt: string }
      >(sql`
        ${effectiveUserDownloadSources(userId, sql`transaction_timestamp()`)}, scope AS (
          SELECT product.id, product.title,
            (product.id IS NOT NULL AND owned.resource_id IS NOT NULL) AS "canAdd",
            coalesce(owned.resource_id IS NOT NULL AND product.status='published' AND EXISTS (
              SELECT 1 FROM ${builds} WHERE ${safePublishedBuildCondition(sql`product.id`)}
            ),false) AS available
          FROM (SELECT ${productId}::text AS id) requested
          LEFT JOIN ${products} product ON product.id=requested.id
          LEFT JOIN owned ON owned.resource_id=requested.id
          WHERE (product.id IS NOT NULL AND owned.resource_id IS NOT NULL) OR EXISTS (
            SELECT 1 FROM ${collections} collection JOIN ${members} member ON member.collection_id=collection.id
            WHERE collection.user_id=${userId} AND member.product_id=requested.id
          )
        )
        SELECT ${productId}::text AS "productId", CASE WHEN available THEN left(title,200) END AS title,
          available,"canAdd",to_char(transaction_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "generatedAt"
        FROM scope LIMIT 1
      `);
      if (!resource) throw new NotFoundError("Resource", productId);
      const rows = await tx
        .select({
          id: collections.id,
          name: collections.name,
          status: collections.status,
          revision: collections.revision,
          itemCount: sql<number>`(SELECT count(*)::integer FROM ${members} WHERE ${members.collectionId}=${collections.id})`,
          inCollection: sql<boolean>`EXISTS (SELECT 1 FROM ${members} WHERE ${members.collectionId}=${collections.id} AND ${members.productId}=${productId})`,
        })
        .from(collections)
        .where(eq(collections.userId, userId))
        .orderBy(desc(collections.updatedAt), asc(collections.id))
        .limit(LIBRARY_COLLECTION_LIMIT + 1);
      if (rows.length > LIBRARY_COLLECTION_LIMIT) throw fail("COLLECTION_LIMIT");
      return {
        schemaVersion: 1,
        generatedAt: resource.generatedAt,
        resource: {
          productId,
          title: resource.available ? resource.title : null,
          available: resource.available,
          canAdd: resource.canAdd,
        },
        collections: rows,
        collectionLimit: LIBRARY_COLLECTION_LIMIT,
        itemLimit: LIBRARY_COLLECTION_ITEM_LIMIT,
      };
    }, readOptions);
  }
  async page(userId: string, page = 1, status: "all" | "active" | "archived" = "active") {
    return db.transaction(async (tx) => {
      await liveUser(tx, userId);
      const scope = and(
        eq(collections.userId, userId),
        status === "all" ? undefined : eq(collections.status, status),
      );
      const [summary] = await tx.select({ total: count() }).from(collections).where(scope);
      const bounds = historyPageBounds(summary?.total ?? 0, page);
      const items = await tx
        .select({
          ...fields,
          itemCount: sql<number>`(select count(*)::integer from ${members} where ${members.collectionId}=${collections.id})`,
        })
        .from(collections)
        .where(scope)
        .orderBy(desc(collections.updatedAt), collections.id)
        .limit(bounds.pageSize)
        .offset(bounds.offset);
      return { items, status, ...bounds, limit: LIBRARY_COLLECTION_LIMIT };
    }, readOptions);
  }
  async detail(userId: string, id: string, page = 1, q = "", candidates = false) {
    validateItemQuery(id, page, q);
    return db.transaction(
      (tx) => readCollectionItems(tx, userId, id, page, q.trim(), candidates),
      readOptions,
    );
  }
  async copyItemsPage(userId: string, id: string, page = 1, q = "") {
    validateItemQuery(id, page, q);
    return db.transaction(async (tx) => {
      const result = await readCollectionItems(tx, userId, id, page, q.trim(), false);
      const targets = await tx
        .select({
          ...fields,
          itemCount: sql<number>`(select count(*)::integer from ${members} where ${members.collectionId}=${collections.id})`,
        })
        .from(collections)
        .where(
          and(
            eq(collections.userId, userId),
            eq(collections.status, "active"),
            sql`${collections.revision}<2147483647`,
            ne(collections.id, id),
          ),
        )
        .orderBy(asc(collections.name), asc(collections.id))
        .limit(LIBRARY_COLLECTION_LIMIT + 1);
      if (targets.length > LIBRARY_COLLECTION_LIMIT) throw fail("COLLECTION_LIMIT");
      const existing =
        targets.length && result.items.length
          ? await tx
              .select({ collectionId: members.collectionId, productId: members.productId })
              .from(members)
              .where(
                and(
                  inArray(
                    members.collectionId,
                    targets.map((item) => item.id),
                  ),
                  inArray(
                    members.productId,
                    result.items.map((item) => item.productId),
                  ),
                ),
              )
          : [];
      const snapshot = (row: LibraryCollectionSnapshot): LibraryCollectionSnapshot => ({
        id: row.id,
        name: row.name,
        status: row.status,
        revision: row.revision,
      });
      return {
        source: snapshot(result.collection),
        items: result.items.map((item) => ({
          productId: item.productId,
          title: item.hasAccess ? item.title : null,
        })),
        destinations: targets.map((item) => ({
          ...snapshot(item),
          itemCount: item.itemCount,
          presentProductIds: existing
            .filter((ref) => ref.collectionId === item.id)
            .map((ref) => ref.productId)
            .sort(),
        })),
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
        q: result.q,
      };
    }, readOptions);
  }
  async releases(
    userId: string,
    id: string,
    page = 1,
    filter: LibraryReleaseFilter = "all",
    q = "",
  ) {
    // biome-ignore lint/suspicious/noControlCharactersInRegex: Reject control characters in private searches.
    const controls = /[\u0000-\u001f\u007f]/u.test(q);
    if (
      !libraryCollectionIdSchema.safeParse(id).success ||
      controls ||
      !["all", "updates", "pinned", "unavailable"].includes(filter) ||
      !Number.isInteger(page) ||
      page < 1 ||
      page > 9999 ||
      q.length > 80
    )
      throw new AppError("Invalid collection releases", 400, "COLLECTION_INVALID");
    return db.transaction(async (tx) => {
      await liveUser(tx, userId);
      const current = await owned(tx, userId, id);
      const collection: LibraryCollectionSnapshot = {
        id: current.id,
        name: current.name,
        status: current.status,
        revision: current.revision,
      };
      const [snapshot] = await tx.execute<{ observedAt: Date | string; itemCount: number }>(
        sql`SELECT transaction_timestamp() AS "observedAt", (SELECT count(*)::integer FROM ${members} WHERE ${members.collectionId}=${id}) AS "itemCount"`,
      );
      const timestamp = new Date(snapshot?.observedAt ?? "");
      if (!Number.isFinite(timestamp.getTime()))
        throw new AppError("Invalid database snapshot", 500, "COLLECTION_SNAPSHOT_INVALID");
      const result = await readLibraryReleasePage(tx, userId, page, filter, q.trim(), id);
      return {
        schemaVersion: 1 as const,
        collection,
        generatedAt: timestamp.toISOString(),
        itemCount: Number(snapshot.itemCount),
        ...result,
      };
    }, readOptions);
  }
  async copyPreview(userId: string, id: string): Promise<LibraryCollectionCopyPreview> {
    if (!libraryCollectionIdSchema.safeParse(id).success)
      throw new AppError("Invalid collection", 400, "COLLECTION_INVALID");
    return db.transaction(async (tx) => {
      await liveUser(tx, userId);
      const { productIds: _ids, ...preview } = await copySource(tx, userId, id);
      return preview;
    }, readOptions);
  }
  async history(userId: string, id: string, page = 1) {
    return db.transaction(async (tx) => {
      await liveUser(tx, userId);
      const collection = await owned(tx, userId, id),
        scope = collectionReceiptScope(userId, id);
      const [summary] = await tx.select({ total: count() }).from(receipts).where(scope);
      const bounds = historyPageBounds(summary?.total ?? 0, page);
      const items = await tx
        .select(receiptFields)
        .from(receipts)
        .where(scope)
        .orderBy(desc(receipts.createdAt), desc(receipts.id))
        .limit(bounds.pageSize)
        .offset(bounds.offset);
      return { collection, items: items.map(publicReceipt), ...bounds };
    }, readOptions);
  }
  async command(input: LibraryCollectionCommandInput) {
    validateCollectionCommand(input);
    return withLibraryCollectionTransaction(input.userId, (tx) =>
      applyLibraryCollectionCommand(tx, input),
    );
  }
}

export const libraryCollectionsRepository = new LibraryCollectionsRepository();
