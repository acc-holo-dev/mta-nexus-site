import { sql } from "drizzle-orm";
import type { LibraryReleaseFilter, LibraryReleaseItem } from "@nexus/domain";
import {
  builds,
  products,
  libraryCollectionItems as members,
  resourceLibrarySelections as selections,
} from "../schema";
import { effectiveUserDownloadSources } from "./user-library";
import { safePublishedBuildCondition } from "./build-safety";
import type { ResourceTransaction } from "./entitlements";
import { historyPageBounds } from "./history-pagination";
import { containsPattern } from "./search-pattern";
/** Shared safe-release projection. Collection ownership must be checked by the caller. */
export async function readLibraryReleasePage(
  tx: ResourceTransaction,
  userId: string,
  requestedPage: number,
  filter: LibraryReleaseFilter,
  q = "",
  collectionId?: string,
) {
  const references = collectionId
    ? sql`SELECT member.product_id AS resource_id, member.added_at FROM ${members} member WHERE member.collection_id=${collectionId}`
    : sql`SELECT owned.resource_id, owned.added_at FROM owned`;
  const available = sql`owned.resource_id IS NOT NULL AND product.status = 'published' AND latest.id IS NOT NULL`;
  const sources = sql`${effectiveUserDownloadSources(userId, sql`transaction_timestamp()`)}, refs AS (${references}), release_rows AS (
        SELECT refs.resource_id AS "productId", refs.added_at AS "addedAt", owned.resource_id IS NOT NULL AS "hasAccess",
          coalesce(pref.revision, 0) AS revision, coalesce(pref.mode, 'latest') AS mode,
          CASE WHEN ${available} THEN product.title END AS title,
          CASE WHEN ${available} THEN product.slug END AS slug,
          CASE WHEN ${available} THEN latest.id END AS "latestBuildId",
          CASE WHEN ${available} THEN latest.version END AS "latestVersion",
          CASE WHEN ${available} THEN selected.id END AS "selectedBuildId",
          CASE WHEN ${available} THEN selected.version END AS "selectedVersion",
          CASE WHEN owned.resource_id IS NULL OR product.status <> 'published' OR product.id IS NULL OR latest.id IS NULL THEN 'unavailable'
            WHEN pref.mode = 'fixed' AND selected.id IS NULL THEN 'selection_unavailable'
            WHEN pref.mode = 'fixed' AND selected.id <> latest.id THEN 'update_available'
            WHEN pref.mode = 'fixed' THEN 'pinned' ELSE 'latest' END AS state,
          CASE WHEN ${available} THEN latest.created_at ELSE refs.added_at END AS sort_time
        FROM refs LEFT JOIN owned ON owned.resource_id=refs.resource_id LEFT JOIN ${products} product ON product.id = refs.resource_id
        LEFT JOIN ${selections} pref ON pref.user_id = ${userId} AND pref.product_id = refs.resource_id
        LEFT JOIN LATERAL (
          SELECT ${builds.id} AS id, ${builds.version} AS version, ${builds.createdAt} AS created_at FROM ${builds}
          WHERE ${safePublishedBuildCondition(sql`product.id`)}
          ORDER BY ${builds.createdAt} DESC, ${builds.id} DESC LIMIT 1
        ) latest ON true
        LEFT JOIN LATERAL (
          SELECT ${builds.id} AS id, ${builds.version} AS version FROM ${builds}
          WHERE ${safePublishedBuildCondition(sql`product.id`)} AND ${builds.id} = pref.build_id LIMIT 1
        ) selected ON true
      )${q ? sql`, searched AS (SELECT * FROM release_rows WHERE title ILIKE ${containsPattern(q)})` : sql``}`;
  const rowsTable = q ? sql`searched` : sql`release_rows`;
  const totals = await tx.execute<{
    all: number;
    updates: number;
    pinned: number;
    unavailable: number;
  }>(sql`${sources}
        SELECT count(*)::integer AS "all", count(*) FILTER (WHERE state = 'update_available')::integer AS updates,
          count(*) FILTER (WHERE mode = 'fixed')::integer AS pinned,
          count(*) FILTER (WHERE state IN ('unavailable', 'selection_unavailable'))::integer AS unavailable FROM ${rowsTable}`);
  const row = totals[0],
    counts = {
      all: Number(row?.all ?? 0),
      updates: Number(row?.updates ?? 0),
      pinned: Number(row?.pinned ?? 0),
      unavailable: Number(row?.unavailable ?? 0),
    };
  const bounds = historyPageBounds(counts[filter], requestedPage);
  const condition =
    filter === "updates"
      ? sql`state = 'update_available'`
      : filter === "pinned"
        ? sql`mode = 'fixed'`
        : filter === "unavailable"
          ? sql`state IN ('unavailable', 'selection_unavailable')`
          : sql`true`;
  const rows = await tx.execute<LibraryReleaseItem>(sql`${sources}
        SELECT "productId", "addedAt", "hasAccess", revision, mode, title, slug, "latestBuildId", "latestVersion", "selectedBuildId", "selectedVersion", state
        FROM ${rowsTable} WHERE ${condition} ORDER BY sort_time DESC NULLS LAST, "productId" ASC LIMIT ${bounds.pageSize} OFFSET ${bounds.offset}`);
  return { items: rows, counts, filter, q, ...bounds };
}
