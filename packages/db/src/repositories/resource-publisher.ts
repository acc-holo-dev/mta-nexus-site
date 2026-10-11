import { and, asc, count, desc, eq, ilike, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import {
  NotFoundError,
  type PublisherResourceQuery,
  type PublisherHistoryKind,
  type ResourceReadiness,
} from "@nexus/domain";
import { db } from "../client";
import { auditEvents, builds, products } from "../schema";
import { managedProductCondition } from "./products";
import { containsPattern } from "./search-pattern";
import { historyPageBounds } from "./history-pagination";
import { assertProductMutationAuthority } from "./product-mutation-authority";
import { trustedCleanScanCondition } from "./build-safety";

function readiness() {
  const clean = sql`exists (select 1 from ${builds} where ${builds.productId} = ${products.id}
    and ${builds.status} in ('draft','published') and ${trustedCleanScanCondition()})`;
  return sql<ResourceReadiness>`case
    when ${products.status} in ('archived','suspended') then 'restricted'
    when ${products.status} = 'pending_review' then 'in_review'
    when ${products.status} = 'published' and not ${products.metadataReviewRequired}
      and exists (select 1 from ${builds} where ${builds.productId} = ${products.id} and ${builds.status} = 'published' and ${trustedCleanScanCondition()}) then 'published'
    when ${products.status} = 'draft' and ${clean} then 'ready'
    when not exists (select 1 from ${builds} where ${builds.productId} = ${products.id}) then 'no_build'
    else 'needs_version' end`;
}
const changeActions = ["product.details_updated", "product.compatibility_updated", "product.media.add", "product.media.save", "product.media.remove"];
const publicationActions = [
  "product.created",
  "product.archive",
  "product.restore",
  "product.submit",
];
export class ResourcePublisherRepository {
  async inventory(actorId: string, query: PublisherResourceQuery, requestedPage = 1) {
    return db.transaction(
      async (tx) => {
        const ready = readiness();
        const scope = and(
          managedProductCondition({ id: actorId, role: "user" }),
          eq(products.price, 0),
          query.scope === "personal"
            ? isNull(products.organizationId)
            : query.scope === "organization"
              ? isNotNull(products.organizationId)
              : undefined,
          query.type === "all" ? undefined : eq(products.type, query.type),
          query.q
            ? or(
                ilike(products.title, containsPattern(query.q)),
                ilike(products.slug, containsPattern(query.q)),
              )
            : undefined,
          query.readiness === "all" ? undefined : sql`${ready} = ${query.readiness}`,
        );
        const counts = await tx
          .select({ status: products.status, total: count() })
          .from(products)
          .where(scope)
          .groupBy(products.status);
        const statusCounts = Object.fromEntries(counts.map((row) => [row.status, row.total]));
        const total =
          query.status === "all"
            ? counts.reduce((sum, row) => sum + row.total, 0)
            : (statusCounts[query.status] ?? 0);
        const bounds = historyPageBounds(total, requestedPage);
        const items = await tx
          .select({
            id: products.id,
            title: products.title,
            slug: products.slug,
            type: products.type,
            status: products.status,
            shortDescription: products.shortDescription,
            currentVersion: products.currentVersion,
            metadataReviewRequired: products.metadataReviewRequired,
            readiness: ready,
            scope: sql<
              "personal" | "organization"
            >`case when ${products.organizationId} is null then 'personal' else 'organization' end`,
            buildCount: sql<number>`(select count(*)::integer from ${builds} where ${builds.productId} = ${products.id})`,
            updatedAt: products.updatedAt,
            createdAt: products.createdAt,
          })
          .from(products)
          .where(and(scope, query.status === "all" ? undefined : eq(products.status, query.status)))
          .orderBy(
            ...(query.sort === "title"
              ? [asc(products.title), asc(products.id)]
              : query.sort === "created"
                ? [desc(products.createdAt), desc(products.id)]
                : [desc(products.updatedAt), desc(products.id)]),
          )
          .limit(bounds.pageSize)
          .offset(bounds.offset);
        return { items, statusCounts, ...bounds };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
  async history(productId: string, actorId: string, kind: PublisherHistoryKind, page = 1) {
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
          eq(auditEvents.targetType, "product"),
          eq(auditEvents.targetId, productId),
          inArray(
            auditEvents.action,
            kind === "changes"
              ? changeActions
              : kind === "publication"
                ? publicationActions
                : [...changeActions, ...publicationActions],
          ),
        );
        const [summary] = await tx.select({ total: count() }).from(auditEvents).where(condition);
        const bounds = historyPageBounds(summary?.total ?? 0, page);
        const items = await tx
          .select({
            id: auditEvents.id,
            action: auditEvents.action,
            createdAt: auditEvents.createdAt,
            reason: sql<string>`case when ${auditEvents.action} in ('product.archive','product.restore','product.submit') then coalesce(${auditEvents.details}->>'reason','') else '' end`,
            previousStatus: sql<string | null>`${auditEvents.details}->>'previousStatus'`,
            status: sql<string | null>`${auditEvents.details}->>'status'`,
            metadataReviewRequired: sql<boolean>`coalesce(${auditEvents.details}->'metadataReviewRequired' = 'true'::jsonb, false)`,
          })
          .from(auditEvents)
          .where(condition)
          .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
          .limit(bounds.pageSize)
          .offset(bounds.offset);
        return { product: { id: product.id, title: product.title }, items, ...bounds };
      },
      { isolationLevel: "repeatable read" },
    );
  }
}
export const resourcePublisherRepository = new ResourcePublisherRepository();
