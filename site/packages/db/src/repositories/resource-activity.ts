import { and, count, desc, eq, sql } from "drizzle-orm";
import {
  NotFoundError,
  RESOURCE_ACTIVITY_DAYS,
  type ResourceActivityDays,
  type ResourceAcquisitionSource,
} from "@nexus/domain";
import { db } from "../client";
import {
  auditEvents,
  builds,
  entitlements,
  licenses,
  products,
  resourceAcquisitionEvents,
} from "../schema";
import { trustedCleanScanCondition } from "./build-safety";
import { libraryPageBounds } from "./library-page-bounds";
import { assertProductMutationAuthority } from "./product-mutation-authority";

export type AcquisitionHistoryFilter = "all" | ResourceAcquisitionSource;
export type ResourceAcquisitionHistoryItem = {
  id: string;
  productId: string;
  source: ResourceAcquisitionSource;
  acquiredAt: Date;
  title: string | null;
  slug: string | null;
  hasCurrentAccess: boolean;
  downloadable: boolean;
};
export type ResourceActivityDay = { day: string; acquisitions: number; downloadStarts: number };
export type ResourceActivityReport = {
  product: { id: string; title: string; status: string };
  days: ResourceActivityDays;
  from: Date;
  through: Date;
  acquisitions: number;
  direct: number;
  cart: number;
  retainedGrants: number;
  downloadStarts: number;
  timeline: ResourceActivityDay[];
};

function metric(value: unknown): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0) throw new RangeError("Invalid resource activity count");
  return n;
}

export class ResourceActivityRepository {
  /** Only recorded new grants, never inferred paid receipts or imported licenses. */
  async buyerHistory(
    userId: string,
    requestedPage = 1,
    requestedFilter: AcquisitionHistoryFilter = "all",
  ) {
    const filter: AcquisitionHistoryFilter =
      requestedFilter === "direct" || requestedFilter === "cart" ? requestedFilter : "all";
    return db.transaction(
      async (tx) => {
        const scope = and(
          eq(resourceAcquisitionEvents.userId, userId),
          filter === "all" ? undefined : eq(resourceAcquisitionEvents.source, filter),
        );
        const [summary] = await tx
          .select({ total: count() })
          .from(resourceAcquisitionEvents)
          .where(scope);
        const total = metric(summary?.total ?? 0);
        const bounds = libraryPageBounds(total, requestedPage, 20);
        const now = new Date();
        const access = sql<boolean>`(
        exists (select 1 from ${entitlements} where ${entitlements.subjectType} = 'user'
          and ${entitlements.subjectId} = ${userId} and ${entitlements.resourceId} = ${resourceAcquisitionEvents.productId}
          and ${entitlements.permission} = 'product.download'
          and (${entitlements.expiresAt} is null or ${entitlements.expiresAt} > ${now}))
        or exists (select 1 from ${licenses} where ${licenses.userId} = ${userId}
          and ${licenses.productId} = ${resourceAcquisitionEvents.productId} and ${licenses.status} = 'active'
          and (${licenses.expiresAt} is null or ${licenses.expiresAt} > ${now})))`;
        const ready = sql<boolean>`coalesce((${access} and ${products.status} = 'published'
        and exists (select 1 from ${builds} where ${builds.productId} = ${products.id}
          and ${builds.status} = 'published' and ${trustedCleanScanCondition()})), false)`;
        const items: ResourceAcquisitionHistoryItem[] = await tx
          .select({
            id: resourceAcquisitionEvents.id,
            productId: resourceAcquisitionEvents.productId,
            source: resourceAcquisitionEvents.source,
            acquiredAt: resourceAcquisitionEvents.createdAt,
            title: sql<string | null>`case when ${ready} then ${products.title} else null end`,
            slug: sql<string | null>`case when ${ready} then ${products.slug} else null end`,
            hasCurrentAccess: access,
            downloadable: ready,
          })
          .from(resourceAcquisitionEvents)
          .leftJoin(products, eq(products.id, resourceAcquisitionEvents.productId))
          .where(scope)
          .orderBy(desc(resourceAcquisitionEvents.createdAt), desc(resourceAcquisitionEvents.id))
          .limit(bounds.pageSize)
          .offset(bounds.offset);
        return { items, total, filter, ...bounds };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }

  /** Operational counts, not financial balances or completed download evidence. */
  async publisherReport(
    actorId: string,
    productId: string,
    requestedDays: ResourceActivityDays = 30,
  ): Promise<ResourceActivityReport> {
    const days = RESOURCE_ACTIVITY_DAYS.includes(requestedDays) ? requestedDays : 30;
    return db.transaction(
      async (tx) => {
        const [product] = await tx
          .select({
            id: products.id,
            title: products.title,
            status: products.status,
            authorId: products.authorId,
            organizationId: products.organizationId,
          })
          .from(products)
          .where(and(eq(products.id, productId), eq(products.price, 0)))
          .limit(1)
          .for("share");
        if (!product) throw new NotFoundError("Resource", productId);
        // Validate live database roles and organization grants, keeping them held
        // until the private aggregate is built. A cached admin role is insufficient.
        await assertProductMutationAuthority(tx, product, actorId);
        const through = new Date();
        const from = new Date(
          Date.UTC(
            through.getUTCFullYear(),
            through.getUTCMonth(),
            through.getUTCDate() - days + 1,
          ),
        );
        // Fixed UTC bounds plus a repeatable-read snapshot keep totals and daily
        // buckets consistent. Product SHARE also serializes new grants.
        const acquisitions = sql`select ${resourceAcquisitionEvents.id}, ${resourceAcquisitionEvents.source},
          ${resourceAcquisitionEvents.createdAt}, ${resourceAcquisitionEvents.entitlementId}, ${resourceAcquisitionEvents.userId}
        from ${resourceAcquisitionEvents} where ${resourceAcquisitionEvents.productId} = ${productId}
          and ${resourceAcquisitionEvents.createdAt} >= ${from} and ${resourceAcquisitionEvents.createdAt} <= ${through}`;
        const downloads = sql`select ${auditEvents.createdAt} from ${auditEvents}
        where ${auditEvents.targetType} = 'product' and ${auditEvents.targetId} = ${productId}
          and ${auditEvents.action} = 'product.download_started'
          and ${auditEvents.createdAt} >= ${from} and ${auditEvents.createdAt} <= ${through}`;
        const [summary] = await tx.execute<{
          acquisitions: number;
          direct: number;
          cart: number;
          retainedGrants: number;
          downloadStarts: number;
        }>(sql`with acquired as (${acquisitions}), downloaded as (${downloads})
        select (select count(*) from acquired)::integer as "acquisitions",
          (select count(*) from acquired where source = 'direct')::integer as "direct",
          (select count(*) from acquired where source = 'cart')::integer as "cart",
          (select count(*) from acquired a inner join ${entitlements} on ${entitlements.id} = a.entitlement_id
            where ${entitlements.subjectType} = 'user' and ${entitlements.permission} = 'product.download'
              and ${entitlements.subjectId} = a.user_id
              and ${entitlements.resourceId} = ${productId}
              and (${entitlements.expiresAt} is null or ${entitlements.expiresAt} > ${through}))::integer as "retainedGrants",
          (select count(*) from downloaded)::integer as "downloadStarts"`);
        const timeline = await tx.execute<ResourceActivityDay>(sql`
        with acquired as (${acquisitions}), downloaded as (${downloads}),
          daily_acquisitions as (select (created_at at time zone 'UTC')::date as day, count(*)::integer as total from acquired group by 1),
          daily_downloads as (select (created_at at time zone 'UTC')::date as day, count(*)::integer as total from downloaded group by 1)
        select to_char(d.day, 'YYYY-MM-DD') as "day", coalesce(a.total, 0) as "acquisitions",
          coalesce(s.total, 0) as "downloadStarts"
        from generate_series(${from}::timestamptz at time zone 'UTC',
          ${through}::timestamptz at time zone 'UTC', interval '1 day') d(day)
        left join daily_acquisitions a on a.day = d.day::date
        left join daily_downloads s on s.day = d.day::date order by d.day desc limit ${days}`);
        return {
          product: { id: product.id, title: product.title, status: product.status },
          days,
          from,
          through,
          acquisitions: metric(summary?.acquisitions ?? 0),
          direct: metric(summary?.direct ?? 0),
          cart: metric(summary?.cart ?? 0),
          retainedGrants: metric(summary?.retainedGrants ?? 0),
          downloadStarts: metric(summary?.downloadStarts ?? 0),
          timeline: timeline.map((row) => ({
            day: row.day,
            acquisitions: metric(row.acquisitions),
            downloadStarts: metric(row.downloadStarts),
          })),
        };
      },
      { isolationLevel: "repeatable read" },
    );
  }
}

export const resourceActivityRepository = new ResourceActivityRepository();
