import { sql, type SQL } from "drizzle-orm";
import { db } from "../client";
import { builds, entitlements, licenses, products, resourceLibrarySelections as selections } from "../schema";
import { trustedCleanScanCondition, safePublishedBuildCondition } from "./build-safety";
import { libraryPageBounds, USER_LIBRARY_PAGE_SIZE } from "./library-page-bounds";

/** The library is a *projection of effective grants*, not a payment ledger. */
export type UserLibraryFilter = "all" | "ready" | "unavailable";

export type UserLibraryItem = Readonly<{
  resourceId: string;
  addedAt: Date;
  title: string | null;
  slug: string | null;
  version: string | null;
  downloadable: boolean;
  buildId: string | null;
  selectionMode: "latest" | "fixed";
}>;

export type UserLibraryPage = Readonly<{
  items: UserLibraryItem[];
  page: number;
  pageSize: number;
  totalPages: number;
  total: number;
  counts: Readonly<{ all: number; ready: number; unavailable: number }>;
  filter: UserLibraryFilter;
}>;

export { USER_LIBRARY_PAGE_SIZE } from "./library-page-bounds";

type CountRow = { all: number; ready: number; unavailable: number };
type ItemRow = {
  resourceId: string;
  addedAt: Date;
  title: string | null;
  slug: string | null;
  version: string | null;
  downloadable: boolean;
  buildId?: string | null;
  selectionMode?: "latest" | "fixed";
};

/**
 * Select effective user download rights in SQL; never load entire grant or
 * license tables to paginate in memory. Both entitlement and legacy license
 * fallback match EntitlementRepository.hasEntitlement's expiry/status gates.
 */
export function effectiveUserDownloadSources(userId: string, now: Date | SQL) {
  return sql`
      WITH owned AS (
        SELECT grant_rows.resource_id, MAX(grant_rows.added_at) AS added_at
        FROM (
          SELECT ${entitlements.resourceId} AS resource_id,
                 ${entitlements.createdAt} AS added_at
          FROM ${entitlements}
          WHERE ${entitlements.subjectType} = 'user'
            AND ${entitlements.subjectId} = ${userId}
            AND ${entitlements.permission} = 'product.download'
            AND (${entitlements.expiresAt} IS NULL OR ${entitlements.expiresAt} > ${now})
          UNION ALL
          SELECT ${licenses.productId} AS resource_id,
                 ${licenses.createdAt} AS added_at
          FROM ${licenses}
          WHERE ${licenses.userId} = ${userId}
            AND ${licenses.status} = 'active'
            AND (${licenses.expiresAt} IS NULL OR ${licenses.expiresAt} > ${now})
        ) grant_rows
        GROUP BY grant_rows.resource_id
      )
    `;
 }

export class UserLibraryRepository {
  async pageByUser(
    userId: string,
    requestedPage = 1,
    filter: UserLibraryFilter = "all",
    requestedPageSize = USER_LIBRARY_PAGE_SIZE,
  ): Promise<UserLibraryPage> {
    const now = new Date();
    const sources = effectiveUserDownloadSources(userId, now);
    // Product moderation and trusted build provenance gate the UI in exactly
    // the same way as the download route. Missing products fail closed.
    const ready = sql<boolean>`COALESCE((
      ${products.status} = 'published'
      AND EXISTS (
        SELECT 1 FROM ${builds}
        WHERE ${builds.productId} = ${products.id}
          AND ${builds.status} = 'published'
          AND ${trustedCleanScanCondition()}
      )
      AND (${selections.mode} IS NULL OR ${selections.mode} = 'latest' OR EXISTS (
        SELECT 1 FROM ${builds} WHERE ${safePublishedBuildCondition(products.id.getSQL())} AND ${builds.id} = ${selections.buildId}
      ))
    ), false)`;
    // Downloading without a pinned build selects the newest *safe published*
    // build. Product.currentVersion is editorial/cache state and can lag behind
    // moderation, quarantine or a newer upload. Show exactly what the download
    // route will select, using its same publication/scan predicate and order.
    const latestPublishedVersion = sql<string | null>`(
      SELECT ${builds.version}
      FROM ${builds}
      WHERE ${builds.productId} = ${products.id}
        AND ${builds.status} = 'published'
        AND ${trustedCleanScanCondition()}
      ORDER BY ${builds.createdAt} DESC, ${builds.id} DESC
      LIMIT 1
    )`;
    const chosenVersion = sql`CASE WHEN ${selections.mode} = 'fixed' THEN (
      SELECT ${builds.version} FROM ${builds}
      WHERE ${safePublishedBuildCondition(products.id.getSQL())} AND ${builds.id} = ${selections.buildId} LIMIT 1
    ) ELSE ${latestPublishedVersion} END`;
    const joined = sql`FROM owned LEFT JOIN ${products}
      ON ${products.id} = owned.resource_id
      LEFT JOIN ${selections} ON ${selections.productId} = owned.resource_id AND ${selections.userId} = ${userId}`;
    const totals = await db.execute<CountRow>(sql`
      ${sources}
      SELECT count(*)::integer AS "all",
        count(*) FILTER (WHERE ${ready})::integer AS "ready",
        count(*) FILTER (WHERE NOT (${ready}))::integer AS "unavailable"
      ${joined}
    `);
    const counts = {
      all: Number(totals[0]?.all ?? 0),
      ready: Number(totals[0]?.ready ?? 0),
      unavailable: Number(totals[0]?.unavailable ?? 0),
    };
    const normalizedFilter: UserLibraryFilter =
      filter === "ready" || filter === "unavailable" ? filter : "all";
    const total = counts[normalizedFilter];
    const bounds = libraryPageBounds(total, requestedPage, requestedPageSize);
    if (!total) {
      return { items: [], ...bounds, total, counts, filter: normalizedFilter };
    }
    const filterClause = normalizedFilter === "ready"
      ? sql`WHERE ${ready}`
      : normalizedFilter === "unavailable"
        ? sql`WHERE NOT (${ready})`
        : sql``;
    const rows = await db.execute<ItemRow>(sql`
      ${sources}
      SELECT owned.resource_id AS "resourceId",
        owned.added_at AS "addedAt",
        CASE WHEN ${ready} THEN ${products.title} ELSE NULL END AS "title",
        CASE WHEN ${ready} THEN ${products.slug} ELSE NULL END AS "slug",
        CASE WHEN ${ready} THEN ${chosenVersion} ELSE NULL END AS "version",
        CASE WHEN ${ready} AND ${selections.mode} = 'fixed' THEN ${selections.buildId} ELSE NULL END AS "buildId",
        coalesce(${selections.mode}, 'latest') AS "selectionMode",
        ${ready} AS "downloadable"
      ${joined}
      ${filterClause}
      ORDER BY owned.added_at DESC, owned.resource_id ASC
      LIMIT ${bounds.pageSize} OFFSET ${bounds.offset}
    `);
    return {
      items: rows.map(row => ({
        resourceId: row.resourceId,
        addedAt: row.addedAt,
        title: row.title,
        slug: row.slug,
        version: row.version,
        downloadable: row.downloadable === true,
        buildId: row.downloadable === true ? row.buildId ?? null : null,
        selectionMode: row.selectionMode === "fixed" ? "fixed" : "latest",
      })),
      ...bounds,
      total,
      counts,
      filter: normalizedFilter,
    };
  }
}

export const userLibraryRepository = new UserLibraryRepository();
