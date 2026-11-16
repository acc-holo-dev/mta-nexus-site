import { and, count, desc, eq, sql } from "drizzle-orm";
import {
  AppError,
  NotFoundError,
  type ResourceDeliveryFinish,
  type ResourceDeliveryQuery,
} from "@nexus/domain";
import { db } from "../client";
import { auditEvents, builds, products, resourceDeliveryReceipts as receipts } from "../schema";
import { historyPageBounds } from "./history-pagination";
import { effectiveUserDownloadSources } from "./user-library";
import { managedProductCondition } from "./products";
import { trustedCleanScanCondition } from "./build-safety";
import { assertProductMutationAuthority } from "./product-mutation-authority";

const evidence = {
  id: receipts.id,
  resourceId: receipts.resourceId,
  buildId: receipts.buildId,
  version: receipts.version,
  sha256Hash: receipts.sha256Hash,
  expectedBytes: receipts.expectedBytes,
  bytesSent: receipts.bytesSent,
  status: receipts.status,
  errorCode: receipts.errorCode,
  pinned: receipts.pinned,
  startedAt: receipts.startedAt,
  finishedAt: receipts.finishedAt,
};
function scope(userId: string, query: ResourceDeliveryQuery) {
  return and(
    eq(receipts.userId, userId),
    query.resourceId ? eq(receipts.resourceId, query.resourceId) : undefined,
    query.days === "all"
      ? undefined
      : sql`${receipts.startedAt} >= transaction_timestamp() - ${Number(query.days)} * interval '1 day'`,
  );
}
function available(userId: string) {
  return sql<boolean>`coalesce(${products.status} = 'published'
    and (exists (${effectiveUserDownloadSources(userId, new Date())} select 1 from owned where owned.resource_id = ${products.id})
      or ${managedProductCondition({ id: userId, role: "user" })})
    and exists (select 1 from ${builds}
      where ${builds.productId} = ${products.id} and ${builds.id} = ${receipts.buildId}
      and ${builds.version} = ${receipts.version} and ${builds.sha256Hash} = ${receipts.sha256Hash}
      and ${builds.fileSizeBytes} = ${receipts.expectedBytes}
      and ${builds.status} = 'published' and ${trustedCleanScanCondition()}), false)`;
}
function projection(userId: string) {
  const downloadable = available(userId);
  return {
    ...evidence,
    title: sql<string | null>`case when ${downloadable} then ${products.title} else null end`,
    downloadable,
  };
}
export class ResourceDeliveriesRepository {
  /** CAS is idempotent: any terminal result wins once, including cancellation. */
  async finish(input: {
    userId: string;
    receiptId: string;
    auditId: string;
    result: ResourceDeliveryFinish;
  }) {
    const { result } = input;
    if (
      !Number.isSafeInteger(result.bytesSent) ||
      result.bytesSent < 0 ||
      result.bytesSent > 67108864 ||
      !["served", "cancelled", "failed"].includes(result.status) ||
      (result.status === "failed"
        ? !["storage_error", "size_mismatch", "hash_mismatch"].includes(result.errorCode)
        : result.errorCode !== null)
    )
      throw new AppError("Invalid delivery evidence", 400, "DELIVERY_RESULT_INVALID");
    return db.transaction(async (tx) => {
      await tx.execute(sql`set local lock_timeout = '3s'`);
      await tx.execute(sql`set local statement_timeout = '5s'`);
      const [finished] = await tx
        .update(receipts)
        .set({ ...result, finishedAt: sql`clock_timestamp()` })
        .where(
          and(
            eq(receipts.id, input.receiptId),
            eq(receipts.userId, input.userId),
            eq(receipts.status, "started"),
          ),
        )
        .returning({
          id: receipts.id,
          resourceId: receipts.resourceId,
          buildId: receipts.buildId,
          version: receipts.version,
        });
      if (!finished) return null;
      await tx.insert(auditEvents).values({
        id: input.auditId,
        actorId: input.userId,
        actorType: "user",
        action: "product.download_finished",
        targetType: "product",
        targetId: finished.resourceId,
        details: {
          receiptId: finished.id,
          buildId: finished.buildId,
          version: finished.version,
          ...result,
        },
      });
      return { id: finished.id, ...result };
    });
  }
  async page(userId: string, query: ResourceDeliveryQuery) {
    return db.transaction(
      async (tx) => {
        const condition = scope(userId, query);
        const groups = await tx
          .select({ status: receipts.status, total: count() })
          .from(receipts)
          .where(condition)
          .groupBy(receipts.status);
        const counts = { all: 0, started: 0, served: 0, cancelled: 0, failed: 0 };
        for (const row of groups) {
          counts[row.status] = Number(row.total);
          counts.all += Number(row.total);
        }
        const bounds = historyPageBounds(counts[query.status], query.page);
        const fields = projection(userId);
        const items = await tx
          .select(fields)
          .from(receipts)
          .leftJoin(products, eq(products.id, receipts.resourceId))
          .where(
            and(condition, query.status === "all" ? undefined : eq(receipts.status, query.status)),
          )
          .orderBy(desc(receipts.startedAt), desc(receipts.id))
          .limit(bounds.pageSize)
          .offset(bounds.offset);
        return { items, counts, ...bounds };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
  async detail(userId: string, receiptId: string) {
    return db.transaction(
      async (tx) => {
        const rows = await tx
          .select(projection(userId))
          .from(receipts)
          .leftJoin(products, eq(products.id, receipts.resourceId))
          .where(and(eq(receipts.id, receiptId), eq(receipts.userId, userId)))
          .limit(1);
        if (!rows[0]) throw new NotFoundError("Download receipt", receiptId);
        return rows[0];
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
  async publisher(
    productId: string,
    actorId: string,
    query: Pick<ResourceDeliveryQuery, "days" | "page">,
  ) {
    return db.transaction(
      async (tx) => {
        const [product] = await tx
          .select({
            id: products.id,
            title: products.title,
            authorId: products.authorId,
            organizationId: products.organizationId,
          })
          .from(products)
          .where(eq(products.id, productId))
          .for("share")
          .limit(1);
        if (!product) throw new NotFoundError("Resource", productId);
        await assertProductMutationAuthority(tx, product, actorId);
        const condition = and(
          eq(receipts.resourceId, product.id),
          query.days === "all"
            ? undefined
            : sql`${receipts.startedAt} >= transaction_timestamp() - ${Number(query.days)} * interval '1 day'`,
        );
        const aggregate = {
          all: count(),
          started: sql<number>`count(*) filter (where ${receipts.status} = 'started')::integer`,
          served: sql<number>`count(*) filter (where ${receipts.status} = 'served')::integer`,
          cancelled: sql<number>`count(*) filter (where ${receipts.status} = 'cancelled')::integer`,
          failed: sql<number>`count(*) filter (where ${receipts.status} = 'failed')::integer`,
        };
        const [counts] = await tx.select(aggregate).from(receipts).where(condition);
        const [total] = await tx
          .select({
            total: sql<number>`count(distinct (${receipts.buildId}, ${receipts.version}))::integer`,
          })
          .from(receipts)
          .where(condition);
        const bounds = historyPageBounds(total?.total ?? 0, query.page);
        const items = await tx
          .select({
            buildId: receipts.buildId,
            version: receipts.version,
            ...aggregate,
            lastStartedAt: sql<Date>`max(${receipts.startedAt})`.mapWith(receipts.startedAt),
          })
          .from(receipts)
          .where(condition)
          .groupBy(receipts.buildId, receipts.version)
          .orderBy(sql`max(${receipts.startedAt}) desc`, desc(receipts.buildId))
          .limit(bounds.pageSize)
          .offset(bounds.offset);
        return {
          product: { id: product.id, title: product.title },
          counts: counts ?? { all: 0, started: 0, served: 0, cancelled: 0, failed: 0 },
          items,
          ...bounds,
        };
      },
      { isolationLevel: "repeatable read" },
    );
  }
}
export const resourceDeliveriesRepository = new ResourceDeliveriesRepository();
