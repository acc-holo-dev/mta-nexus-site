import {
  AppError,
  NotFoundError,
  LIBRARY_COLLECTION_LIMIT,
  LIBRARY_COLLECTION_ITEM_LIMIT,
  type LibraryCollectionInventory,
  type LibraryCollectionInventoryQuery,
} from "@nexus/domain";
import {
  libraryCollectionInventoryQuerySchema,
  libraryCollectionSnapshotSchema,
  libraryCollectionIdSchema,
} from "@nexus/validation";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../client";
import {
  users,
  libraryCollections as collections,
  libraryCollectionItems as members,
  products,
} from "../schema";
import { effectiveUserDownloadSources } from "./user-library";
import { libraryReleaseProjection } from "./library-release-projection";
import { inventoryReleaseSnapshot, type InventoryReleaseRow } from "./library-inventory-release";
import { historyPageBounds } from "./history-pagination";
import { containsPattern } from "./search-pattern";
const invalidSnapshot = () =>
  new AppError("Invalid collection inventory snapshot", 500, "COLLECTION_SNAPSHOT_INVALID");
export async function readLibraryCollectionInventory(
  userId: string,
  input: LibraryCollectionInventoryQuery,
): Promise<LibraryCollectionInventory> {
  const parsed = libraryCollectionInventoryQuerySchema.safeParse(input);
  if (!parsed.success) throw new AppError("Invalid inventory query", 400, "COLLECTION_INVALID");
  const query = parsed.data;
  return db.transaction(
    async (tx) => {
      const [actor] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (!actor) throw new NotFoundError("Library account");
      const ownRows = await tx
        .select({
          id: collections.id,
          name: collections.name,
          status: collections.status,
          revision: collections.revision,
          itemCount: sql<number>`(SELECT count(*)::integer FROM ${members} WHERE ${members.collectionId}=${collections.id})`,
        })
        .from(collections)
        .where(eq(collections.userId, userId))
        .orderBy(asc(collections.id))
        .limit(LIBRARY_COLLECTION_LIMIT + 1);
      if (
        ownRows.length > LIBRARY_COLLECTION_LIMIT ||
        ownRows.some(
          (row) =>
            !libraryCollectionSnapshotSchema.safeParse({
              id: row.id,
              name: row.name,
              status: row.status,
              revision: row.revision,
            }).success ||
            !Number.isSafeInteger(row.itemCount) ||
            row.itemCount < 0 ||
            row.itemCount > LIBRARY_COLLECTION_ITEM_LIMIT,
        )
      )
        throw invalidSnapshot();
      if (query.collectionId && !ownRows.some((row) => row.id === query.collectionId))
        throw new NotFoundError("Collection");
      const [clock] = await tx.execute<{ observedAt: Date | string }>(
        sql`SELECT transaction_timestamp() AS "observedAt"`,
      );
      const date = new Date(clock?.observedAt ?? "");
      if (!Number.isFinite(date.getTime())) throw invalidSnapshot();
      const base = {
        schemaVersion: 1 as const,
        generatedAt: date.toISOString(),
        ...query,
        collections: ownRows.map((row) => ({
          id: row.id,
          name: row.name,
          status: row.status,
          revision: row.revision,
          itemCount: row.itemCount,
        })),
      };
      const referenceLimit = LIBRARY_COLLECTION_LIMIT * LIBRARY_COLLECTION_ITEM_LIMIT;
      if (
        ownRows
          .filter(
            (row) =>
              (!query.collectionId || row.id === query.collectionId) &&
              (query.status === "all" || row.status === query.status),
          )
          .every((row) => row.itemCount === 0)
      )
        return {
          ...base,
          counts: { resources: 0, references: 0, available: 0, unavailable: 0, shared: 0 },
          releaseCounts: {
            latest: 0,
            pinned: 0,
            updates: 0,
            selectionUnavailable: 0,
            attention: 0,
          },
          page: 1,
          pageSize: 20,
          total: 0,
          totalPages: 1,
          items: [],
        };
      const matchCollection = query.collectionId ? sql`c.id=${query.collectionId}` : sql`true`;
      const matchStatus = query.status === "all" ? sql`true` : sql`c.status=${query.status}`;
      const projection = libraryReleaseProjection(userId, sql`refs.id`);
      const resources = sql`${effectiveUserDownloadSources(userId, sql`transaction_timestamp()`)}, refs AS (
      SELECT member.product_id AS id,count(*)::integer AS "membershipCount",bool_or(${matchCollection} AND ${matchStatus}) AS "inSelected"
      FROM ${members} member JOIN ${collections} c ON c.id=member.collection_id WHERE c.user_id=${userId} GROUP BY member.product_id
    ), resource_rows AS (
      SELECT refs.id AS "productId",refs."membershipCount",refs."inSelected",
        CASE WHEN owned.resource_id IS NOT NULL AND product.status='published' AND latest.id IS NOT NULL THEN left(product.title,200) END AS title,
        ${projection.available} AS available,${projection.columns}
      FROM refs LEFT JOIN owned ON owned.resource_id=refs.id LEFT JOIN ${products} product ON product.id=refs.id
      ${projection.joins}
      WHERE refs."inSelected"
    )`;
      const scope = sql`"inSelected"`;
      const filter = {
        all: sql`true`,
        available: sql`available`,
        unavailable: sql`NOT available`,
        shared: sql`"membershipCount">1`,
      }[query.filter];
      const releaseFilter = {
        all: sql`true`,
        attention: sql`state IN ('unavailable','selection_unavailable','update_available')`,
        updates: sql`state='update_available'`,
        pinned: sql`available AND mode='fixed'`,
        "selection-unavailable": sql`state='selection_unavailable'`,
        latest: sql`state='latest'`,
      }[query.release];
      const matched = sql`${filter} AND ${releaseFilter}`;
      const search = query.q
        ? sql` AND (title ILIKE ${containsPattern(query.q)} OR "productId" ILIKE ${containsPattern(query.q)})`
        : sql``;
      const where = sql`${scope} AND ${matched}${search}`;
      const [summary] = await tx.execute<{
        resources: number;
        references: number;
        available: number;
        unavailable: number;
        shared: number;
        total: number;
        releaseLatest: number;
        releasePinned: number;
        releaseUpdates: number;
        selectionUnavailable: number;
        attention: number;
      }>(sql`${resources}
      SELECT count(*)::integer AS resources,coalesce(sum("membershipCount"),0)::integer AS "references",
        count(*) FILTER(WHERE available)::integer AS available,count(*) FILTER(WHERE NOT available)::integer AS unavailable,
        count(*) FILTER(WHERE "membershipCount">1)::integer AS shared,
        count(*) FILTER(WHERE state='latest')::integer AS "releaseLatest",
        count(*) FILTER(WHERE available AND mode='fixed')::integer AS "releasePinned",
        count(*) FILTER(WHERE state='update_available')::integer AS "releaseUpdates",
        count(*) FILTER(WHERE state='selection_unavailable')::integer AS "selectionUnavailable",
        count(*) FILTER(WHERE state IN ('unavailable','selection_unavailable','update_available'))::integer AS attention,
        count(*) FILTER(WHERE ${matched}${search})::integer AS total FROM resource_rows WHERE ${scope}`);
      const counts = {
          resources: Number(summary?.resources ?? 0),
          references: Number(summary?.references ?? 0),
          available: Number(summary?.available ?? 0),
          unavailable: Number(summary?.unavailable ?? 0),
          shared: Number(summary?.shared ?? 0),
        },
        releaseCounts = {
          latest: Number(summary?.releaseLatest ?? 0),
          pinned: Number(summary?.releasePinned ?? 0),
          updates: Number(summary?.releaseUpdates ?? 0),
          selectionUnavailable: Number(summary?.selectionUnavailable ?? 0),
          attention: Number(summary?.attention ?? 0),
        },
        total = Number(summary?.total ?? 0);
      if (
        [...Object.values(counts), ...Object.values(releaseCounts), total].some(
          (value) => !Number.isSafeInteger(value) || value < 0 || value > referenceLimit,
        ) ||
        counts.available + counts.unavailable !== counts.resources ||
        counts.shared > counts.resources ||
        counts.references < counts.resources ||
        total > counts.resources ||
        releaseCounts.latest + releaseCounts.pinned !== counts.available ||
        releaseCounts.updates + releaseCounts.selectionUnavailable > releaseCounts.pinned ||
        releaseCounts.attention !==
          counts.unavailable + releaseCounts.updates + releaseCounts.selectionUnavailable
      )
        throw invalidSnapshot();
      const bounds = historyPageBounds(total, query.page);
      const rows = await tx.execute<
        InventoryReleaseRow & {
          productId: string;
          title: string | null;
          available: boolean;
          membershipCount: number;
        }
      >(sql`${resources}
      SELECT "productId",title,available,"membershipCount",mode,revision,state,"canReviewRequirements","latestBuildId","latestVersion","selectedBuildId","selectedVersion"
      FROM resource_rows WHERE ${where} ORDER BY "productId" ASC LIMIT ${bounds.pageSize} OFFSET ${bounds.offset}`);
      if (
        rows.length > bounds.pageSize ||
        new Set(rows.map((row) => row.productId)).size !== rows.length ||
        rows.some(
          (row) =>
            !libraryCollectionIdSchema.safeParse(row.productId).success ||
            !Number.isSafeInteger(row.membershipCount) ||
            row.membershipCount < 1 ||
            row.membershipCount > LIBRARY_COLLECTION_LIMIT,
        )
      )
        throw invalidSnapshot();
      const memberRows = rows.length
        ? await tx
            .select({
              productId: members.productId,
              collectionId: members.collectionId,
              addedAt: members.addedAt,
            })
            .from(members)
            .innerJoin(collections, eq(collections.id, members.collectionId))
            .where(
              and(
                eq(collections.userId, userId),
                inArray(
                  members.productId,
                  rows.map((row) => row.productId),
                ),
              ),
            )
            .orderBy(asc(members.productId), asc(members.collectionId))
            .limit(bounds.pageSize * LIBRARY_COLLECTION_LIMIT + 1)
        : [];
      if (memberRows.length > bounds.pageSize * LIBRARY_COLLECTION_LIMIT) throw invalidSnapshot();
      const byCollection = new Map(ownRows.map((row) => [row.id, row]));
      const items = rows.map((row) => {
        const memberships = memberRows
          .filter((member) => member.productId === row.productId)
          .map((member) => {
            const collection = byCollection.get(member.collectionId),
              addedAt = new Date(member.addedAt);
            if (!collection || !Number.isFinite(addedAt.getTime())) throw invalidSnapshot();
            return {
              id: collection.id,
              name: collection.name,
              status: collection.status,
              revision: collection.revision,
              addedAt: addedAt.toISOString(),
            };
          });
        if (
          memberships.length !== row.membershipCount ||
          new Set(memberships.map((item) => item.id)).size !== memberships.length
        )
          throw invalidSnapshot();
        return {
          productId: row.productId,
          title: row.available === true && typeof row.title === "string" ? row.title : null,
          available: row.available === true,
          release: inventoryReleaseSnapshot(row),
          memberships,
        };
      });
      return {
        ...base,
        counts,
        releaseCounts,
        page: bounds.page,
        pageSize: bounds.pageSize,
        total: bounds.total,
        totalPages: bounds.totalPages,
        items,
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
