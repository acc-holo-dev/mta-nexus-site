import {
  AppError,
  NotFoundError,
  LIBRARY_COLLECTION_LIMIT,
  LIBRARY_COLLECTION_ITEM_LIMIT,
  type LibraryCollectionComparison,
  type LibraryCollectionComparisonQuery,
} from "@nexus/domain";
import {
  libraryCollectionComparisonQuerySchema,
  libraryCollectionIdSchema,
} from "@nexus/validation";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "../client";
import {
  users,
  libraryCollections as collections,
  libraryCollectionItems as members,
  products,
  builds,
} from "../schema";
import { effectiveUserDownloadSources } from "./user-library";
import { safePublishedBuildCondition } from "./build-safety";
import { historyPageBounds } from "./history-pagination";
import { containsPattern } from "./search-pattern";

export async function readLibraryCollectionComparison(
  userId: string,
  sourceId: string,
  input: LibraryCollectionComparisonQuery,
): Promise<LibraryCollectionComparison> {
  const parsed = libraryCollectionComparisonQuerySchema.safeParse(input);
  if (
    !parsed.success ||
    !libraryCollectionIdSchema.safeParse(sourceId).success ||
    parsed.data.to === sourceId
  )
    throw new AppError("Invalid collection comparison", 400, "COLLECTION_INVALID");
  const query = parsed.data;
  return db.transaction(
    async (tx) => {
      const [actor] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (!actor) throw new NotFoundError("Library account");
      const rows = await tx
        .select({
          id: collections.id,
          name: collections.name,
          status: collections.status,
          revision: collections.revision,
          itemCount: sql<number>`(SELECT count(*)::integer FROM ${members} WHERE ${members.collectionId}=${collections.id})`,
        })
        .from(collections)
        .where(eq(collections.userId, userId))
        .orderBy(desc(collections.updatedAt), asc(collections.id))
        .limit(LIBRARY_COLLECTION_LIMIT + 1);
      const source = rows.find((row) => row.id === sourceId);
      if (!source) throw new NotFoundError("Collection", sourceId);
      if (
        rows.length > LIBRARY_COLLECTION_LIMIT ||
        rows.some((row) => row.itemCount > LIBRARY_COLLECTION_ITEM_LIMIT)
      )
        throw new AppError("Invalid collection bounds", 409, "COLLECTION_ITEM_LIMIT");
      const destination = query.to ? rows.find((row) => row.id === query.to) : undefined;
      if (query.to && !destination) throw new NotFoundError("Collection", query.to);
      const [clock] = await tx.execute<{ observedAt: Date | string }>(
        sql`SELECT transaction_timestamp() AS "observedAt"`,
      );
      const observedAt = new Date(clock?.observedAt ?? "");
      if (!Number.isFinite(observedAt.getTime()))
        throw new AppError("Invalid comparison snapshot", 500, "COLLECTION_SNAPSHOT_INVALID");
      const base = {
        schemaVersion: 1 as const,
        generatedAt: observedAt.toISOString(),
        source,
        targets: rows.filter((row) => row.id !== sourceId),
        itemLimit: LIBRARY_COLLECTION_ITEM_LIMIT,
      };
      if (!destination) return { ...base, comparison: null };
      const resources = sql`${effectiveUserDownloadSources(userId, sql`transaction_timestamp()`)}, refs AS (
      SELECT ${members.productId} AS id,bool_or(${members.collectionId}=${sourceId}) AS "inSource",bool_or(${members.collectionId}=${destination.id}) AS "inDestination"
      FROM ${members} WHERE ${members.collectionId} IN (${sourceId},${destination.id}) GROUP BY ${members.productId}
    ), resource_rows AS (
      SELECT refs.id AS "productId",refs."inSource",refs."inDestination",
        CASE WHEN owned.resource_id IS NOT NULL AND product.status='published' AND latest.id IS NOT NULL THEN left(product.title,200) END AS title,
        coalesce(owned.resource_id IS NOT NULL AND product.status='published' AND latest.id IS NOT NULL,false) AS available
      FROM refs LEFT JOIN owned ON owned.resource_id=refs.id LEFT JOIN ${products} product ON product.id=refs.id
      LEFT JOIN LATERAL (SELECT ${builds.id} AS id FROM ${builds} WHERE ${safePublishedBuildCondition(sql`product.id`)} LIMIT 1) latest ON true
    )`;
      const filter = {
        all: sql`true`,
        "source-only": sql`"inSource" AND NOT "inDestination"`,
        "destination-only": sql`"inDestination" AND NOT "inSource"`,
        common: sql`"inSource" AND "inDestination"`,
        unavailable: sql`NOT available`,
      }[query.filter];
      const where = sql`${filter}${query.q ? sql` AND title ILIKE ${containsPattern(query.q)}` : sql``}`;
      const [summary] = await tx.execute<{
        all: number;
        sourceOnly: number;
        destinationOnly: number;
        common: number;
        unavailable: number;
        total: number;
      }>(sql`${resources}
      SELECT count(*)::integer AS "all",count(*) FILTER(WHERE "inSource" AND NOT "inDestination")::integer AS "sourceOnly",
        count(*) FILTER(WHERE "inDestination" AND NOT "inSource")::integer AS "destinationOnly",count(*) FILTER(WHERE "inSource" AND "inDestination")::integer AS common,
        count(*) FILTER(WHERE NOT available)::integer AS unavailable,count(*) FILTER(WHERE ${where})::integer AS total FROM resource_rows`);
      const counts = {
        all: Number(summary?.all ?? 0),
        sourceOnly: Number(summary?.sourceOnly ?? 0),
        destinationOnly: Number(summary?.destinationOnly ?? 0),
        common: Number(summary?.common ?? 0),
        unavailable: Number(summary?.unavailable ?? 0),
      };
      if (counts.all > 2 * LIBRARY_COLLECTION_ITEM_LIMIT)
        throw new AppError("Invalid comparison bounds", 409, "COLLECTION_ITEM_LIMIT");
      const bounds = historyPageBounds(Number(summary?.total ?? 0), query.page);
      const items = await tx.execute<
        NonNullable<LibraryCollectionComparison["comparison"]>["items"][number]
      >(sql`${resources}
      SELECT "productId",title,available,"inSource","inDestination" FROM resource_rows WHERE ${where}
      ORDER BY "productId" ASC LIMIT ${bounds.pageSize} OFFSET ${bounds.offset}`);
      return {
        ...base,
        comparison: {
          destination,
          counts,
          items: items.map((item) => ({
            productId: item.productId,
            title: item.available ? item.title : null,
            available: item.available,
            inSource: item.inSource,
            inDestination: item.inDestination,
          })),
          page: bounds.page,
          pageSize: bounds.pageSize,
          total: bounds.total,
          totalPages: bounds.totalPages,
          filter: query.filter,
          q: query.q,
          transfer: query.transfer,
        },
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
