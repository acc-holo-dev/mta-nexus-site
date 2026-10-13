import { sql } from "drizzle-orm";
import type { LibraryReleaseFilter, LibraryReleaseItem } from "@nexus/domain";
import { products, libraryCollectionItems as members } from "../schema";
import { effectiveUserDownloadSources } from "./user-library";
import { libraryReleaseProjection } from "./library-release-projection";
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
  const projection = libraryReleaseProjection(userId, sql`refs.resource_id`),
    available = projection.available;
  const sources = sql`${effectiveUserDownloadSources(userId, sql`transaction_timestamp()`)}, refs AS (${references}), release_rows AS (
        SELECT refs.resource_id AS "productId", refs.added_at AS "addedAt", owned.resource_id IS NOT NULL AS "hasAccess",
          ${projection.columns},
          CASE WHEN ${available} THEN product.title END AS title,
          CASE WHEN ${available} THEN product.slug END AS slug,
          CASE WHEN ${available} THEN latest.created_at ELSE refs.added_at END AS sort_time
        FROM refs LEFT JOIN owned ON owned.resource_id=refs.resource_id LEFT JOIN ${products} product ON product.id = refs.resource_id
        ${projection.joins}
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
