import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import {
  RESOURCE_CART_LIMIT,
  type ResourceCartReview,
  type ResourceCartReviewItem,
} from "@nexus/domain";
import { builds, entitlements, licenses, products, resourceCartItems } from "../schema";
import { safePublishedBuildCondition } from "./build-safety";
import type { ResourceTransaction } from "./entitlements";

/** Narrow public evidence. This digest detects a changed review; it authorizes nothing. */
export async function readResourceCartReview(
  tx: ResourceTransaction,
  userId: string,
): Promise<ResourceCartReview> {
  const now = new Date();
  const ready = sql`(${products.status} = 'published' and ${products.price} = 0 and artifact.id is not null and artifact.sha256_hash ~ '^[a-f0-9]{64}$' and artifact.file_size_bytes between 1 and 67108864)`;
  const rows = await tx.execute<ResourceCartReviewItem & { metadataRevision: string | null }>(sql`
    select ${resourceCartItems.productId} as "productId", coalesce(${ready}, false) as available,
      (exists (select 1 from ${entitlements} where ${entitlements.subjectType} = 'user'
        and ${entitlements.subjectId} = ${userId} and ${entitlements.resourceId} = ${products.id}
        and ${entitlements.permission} = 'product.download' and (${entitlements.expiresAt} is null or ${entitlements.expiresAt} > ${now}))
       or exists (select 1 from ${licenses} where ${licenses.userId} = ${userId} and ${licenses.productId} = ${products.id}
         and ${licenses.status} = 'active' and (${licenses.expiresAt} is null or ${licenses.expiresAt} > ${now}))) as "alreadyOwned",
      case when ${ready} then ${products.title} end as title,
      case when ${ready} then ${products.slug} end as slug,
      case when ${ready} then to_char(${products.updatedAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end as "metadataRevision",
      case when ${ready} then artifact.id end as "buildId",
      case when ${ready} then artifact.version end as version,
      case when ${ready} then artifact.sha256_hash end as "sha256Hash",
      case when ${ready} then artifact.file_size_bytes end as "fileSizeBytes",
      case when ${ready} then ${products.compatibility}->>'mtaMinVersion' end as "mtaMinVersion",
      case when ${ready} then coalesce(${products.compatibility}->'dependencies', '[]'::jsonb) end as dependencies
    from ${resourceCartItems} inner join ${products} on ${products.id} = ${resourceCartItems.productId}
    left join lateral (select ${builds.id}, ${builds.version}, ${builds.sha256Hash}, ${builds.fileSizeBytes} from ${builds}
      where ${safePublishedBuildCondition(products.id.getSQL())}
      order by ${builds.createdAt} desc, ${builds.id} desc limit 1) artifact on true
    where ${resourceCartItems.userId} = ${userId}
    order by ${resourceCartItems.productId} asc limit ${RESOURCE_CART_LIMIT + 1}`);
  const complete =
    rows.length > 0 && rows.length <= RESOURCE_CART_LIMIT && rows.every((row) => row.available);
  // Explicit field order keeps digests independent of driver object order.
  const reviewDigest = complete
    ? createHash("sha256")
        .update(
          JSON.stringify(
            rows.map((row) => [
              row.productId,
              row.metadataRevision,
              row.title,
              row.slug,
              row.buildId,
              row.version,
              row.sha256Hash,
              row.fileSizeBytes,
              row.mtaMinVersion,
              row.dependencies,
              row.alreadyOwned,
            ]),
          ),
        )
        .digest("hex")
    : null;
  return {
    items: rows
      .slice(0, RESOURCE_CART_LIMIT)
      .map(({ metadataRevision: _revision, ...item }) => item),
    limit: RESOURCE_CART_LIMIT,
    reviewDigest,
  };
}
