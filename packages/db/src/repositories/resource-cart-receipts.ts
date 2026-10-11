import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { NotFoundError, type ResourceCartReceiptQuery } from "@nexus/domain";
import { db } from "../client";
import {
  builds,
  entitlements,
  licenses,
  products,
  resourceCartAcquisitions as receipts,
} from "../schema";
import { safePublishedBuildCondition } from "./build-safety";
import { historyPageBounds } from "./history-pagination";
export class ResourceCartReceiptsRepository {
  async page(userId: string, query: ResourceCartReceiptQuery) {
    return db.transaction(
      async (tx) => {
        const from = query.days === "all" ? null : new Date(Date.now() - query.days * 86400000);
        const scope = and(
          eq(receipts.userId, userId),
          from ? gte(receipts.createdAt, from) : undefined,
          query.evidence === "reviewed"
            ? sql`${receipts.reviewDigest} is not null`
            : query.evidence === "legacy"
              ? sql`${receipts.reviewDigest} is null`
              : undefined,
        );
        const [summary] = await tx.select({ total: count() }).from(receipts).where(scope);
        const bounds = historyPageBounds(summary?.total ?? 0, query.page);
        const items = await tx
          .select({
            requestId: receipts.requestId,
            createdAt: receipts.createdAt,
            reviewed: sql<boolean>`${receipts.reviewDigest} is not null`,
            itemCount: sql<number>`case when jsonb_typeof(${receipts.productIds}) = 'array' then jsonb_array_length(${receipts.productIds}) else 0 end`,
          })
          .from(receipts)
          .where(scope)
          .orderBy(desc(receipts.createdAt), desc(receipts.requestId))
          .limit(bounds.pageSize)
          .offset(bounds.offset);
        return { items, ...bounds, filter: query };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
  async detail(userId: string, requestId: string) {
    return db.transaction(
      async (tx) => {
        const [receipt] = await tx
          .select({
            requestId: receipts.requestId,
            createdAt: receipts.createdAt,
            productIds: receipts.productIds,
            snapshot: receipts.reviewSnapshot,
            reviewDigest: receipts.reviewDigest,
          })
          .from(receipts)
          .where(and(eq(receipts.userId, userId), eq(receipts.requestId, requestId)))
          .limit(1);
        if (!receipt) throw new NotFoundError("Acquisition receipt", requestId);
        // Historical rows retain their uncertainty. Do not invent approved builds
        // from today's catalog or upgrade old receipts into reviewed evidence.
        if (!receipt.snapshot || !receipt.reviewDigest)
          return {
            requestId: receipt.requestId,
            createdAt: receipt.createdAt,
            reviewed: false as const,
            items: [],
            legacyProductCount: Array.isArray(receipt.productIds) ? receipt.productIds.length : 0,
          };
        const now = new Date();
        const access = sql`(exists (select 1 from ${entitlements} where ${entitlements.subjectType} = 'user'
        and ${entitlements.subjectId} = ${userId} and ${entitlements.resourceId} = snapshot."productId"
        and ${entitlements.permission} = 'product.download' and (${entitlements.expiresAt} is null or ${entitlements.expiresAt} > ${now}))
        or exists (select 1 from ${licenses} where ${licenses.userId} = ${userId}
          and ${licenses.productId} = snapshot."productId" and ${licenses.status} = 'active'
          and (${licenses.expiresAt} is null or ${licenses.expiresAt} > ${now})))`;
        const current = await tx.execute<{
          productId: string;
          buildId: string;
          hasCurrentAccess: boolean;
          downloadable: boolean;
        }>(sql`
        select snapshot."productId", snapshot."buildId", ${access} as "hasCurrentAccess",
          coalesce(${products.status} = 'published' and ${access} and exists (select 1 from ${builds}
            where ${safePublishedBuildCondition(products.id.getSQL())} and ${builds.id} = snapshot."buildId"
              and ${builds.sha256Hash} = snapshot."sha256Hash" and ${builds.fileSizeBytes} = snapshot."fileSizeBytes"), false) as downloadable
        from jsonb_to_recordset(${JSON.stringify(receipt.snapshot)}::jsonb) as snapshot("productId" text, "buildId" text, "sha256Hash" text, "fileSizeBytes" integer)
        left join ${products} on ${products.id} = snapshot."productId" limit 20`);
        const byId = new Map(current.map((row) => [row.productId, row]));
        return {
          requestId: receipt.requestId,
          createdAt: receipt.createdAt,
          reviewed: true as const,
          legacyProductCount: 0,
          items: receipt.snapshot.map((item) => ({
            ...item,
            hasCurrentAccess: byId.get(item.productId)?.hasCurrentAccess === true,
            downloadable: byId.get(item.productId)?.downloadable === true,
          })),
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
}
export const resourceCartReceiptsRepository = new ResourceCartReceiptsRepository();
