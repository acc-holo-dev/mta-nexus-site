import { sql, type SQL } from "drizzle-orm";
import { builds, resourceLibrarySelections as selections } from "../schema";
import { safePublishedBuildCondition } from "./build-safety";

/** Shared own-preference/safe-build joins for a caller's owner-scoped resource set.
 * The caller supplies product/owned aliases in the same database-time snapshot.
 */
export function libraryReleaseProjection(userId: string, resourceId: SQL) {
  const available = sql`coalesce(owned.resource_id IS NOT NULL AND product.status='published' AND latest.id IS NOT NULL,false)`;
  return {
    available,
    columns: sql`
      coalesce(pref.revision,0) AS revision,coalesce(pref.mode,'latest') AS mode,
      coalesce(${available} AND product.price=0,false) AS "canReviewRequirements",
      CASE WHEN ${available} THEN latest.id END AS "latestBuildId",
      CASE WHEN ${available} THEN left(latest.version,128) END AS "latestVersion",
      CASE WHEN ${available} THEN selected.id END AS "selectedBuildId",
      CASE WHEN ${available} THEN left(selected.version,128) END AS "selectedVersion",
      CASE WHEN owned.resource_id IS NULL OR NOT ${available} THEN 'unavailable'
        WHEN pref.mode='fixed' AND selected.id IS NULL THEN 'selection_unavailable'
        WHEN pref.mode='fixed' AND selected.id <> latest.id THEN 'update_available'
        WHEN pref.mode='fixed' THEN 'pinned' ELSE 'latest' END AS state`,
    joins: sql`
      LEFT JOIN ${selections} pref ON pref.user_id=${userId} AND pref.product_id=${resourceId}
      LEFT JOIN LATERAL (
        SELECT ${builds.id} AS id,${builds.version} AS version,${builds.createdAt} AS created_at
        FROM ${builds} WHERE owned.resource_id IS NOT NULL AND product.status='published'
          AND ${safePublishedBuildCondition(sql`product.id`)}
        ORDER BY ${builds.createdAt} DESC,${builds.id} DESC LIMIT 1
      ) latest ON true
      LEFT JOIN LATERAL (
        SELECT ${builds.id} AS id,${builds.version} AS version FROM ${builds}
        WHERE owned.resource_id IS NOT NULL AND product.status='published' AND pref.mode='fixed'
          AND ${safePublishedBuildCondition(sql`product.id`)} AND ${builds.id}=pref.build_id LIMIT 1
      ) selected ON true`,
  };
}
