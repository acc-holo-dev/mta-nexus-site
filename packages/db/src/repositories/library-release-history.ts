import {
  AppError,
  NotFoundError,
  LIBRARY_RELEASE_HISTORY_DAYS,
  type LibraryReleaseHistoryQuery,
  recordedLibraryRelease,
} from "@nexus/domain";
import { and, count, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "../client";
import { auditEvents, builds, products, users } from "../schema";
import { effectiveUserDownloadSources } from "./user-library";
import { safePublishedBuildCondition } from "./build-safety";
import { historyPageBounds } from "./history-pagination";
export async function readLibraryReleaseHistory(userId: string, query: LibraryReleaseHistoryQuery) {
  if (
    !Number.isInteger(query.page) ||
    query.page < 1 ||
    query.page > 1000 ||
    !LIBRARY_RELEASE_HISTORY_DAYS.includes(query.days) ||
    (query.productId !== undefined && !/^[A-Za-z0-9_-]{1,160}$/u.test(query.productId))
  )
    throw new AppError("Invalid selection history query", 400, "RESOURCE_CONTROL_INVALID");
  return db.transaction(
    async (tx) => {
      const [actor] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (!actor) throw new NotFoundError("Library", userId);
      const [clock] = await tx.execute<{ observedAt: Date | string }>(
        sql`SELECT transaction_timestamp() AS "observedAt"`,
      );
      const date = new Date(clock?.observedAt ?? "");
      if (!Number.isFinite(date.getTime()))
        throw new AppError("Invalid history snapshot", 500, "LIBRARY_HISTORY_INVALID");
      const scope = and(
        eq(auditEvents.actorId, userId),
        sql`${auditEvents.actorType}='user' AND ${auditEvents.action}='library.release_selected' AND ${auditEvents.targetType}='product'`,
        gte(auditEvents.createdAt, sql`transaction_timestamp()-${query.days}*interval '1 day'`),
        lte(auditEvents.createdAt, sql`transaction_timestamp()`),
        query.productId ? eq(auditEvents.targetId, query.productId) : undefined,
      );
      const [summary] = await tx.select({ total: count() }).from(auditEvents).where(scope);
      const bounds = historyPageBounds(summary?.total ?? 0, query.page);
      const available = sql`owned.resource_id IS NOT NULL AND product.status='published' AND latest.id IS NOT NULL`;
      const rows = await tx.execute<{
        id: string;
        productId: string;
        createdAt: Date;
        details: unknown;
        currentTitle: string | null;
        currentSlug: string | null;
        hasCurrentAccess: boolean;
        buildVersion: string | null;
      }>(sql`${effectiveUserDownloadSources(userId, sql`transaction_timestamp()`)}, events AS (
      SELECT ${auditEvents.id} AS id, ${auditEvents.targetId} AS "productId", ${auditEvents.createdAt} AS "createdAt",
        jsonb_build_object('mode',${auditEvents.details}->'mode','buildId',${auditEvents.details}->'buildId','revision',${auditEvents.details}->'revision','batchReceiptId',${auditEvents.details}->'batchReceiptId') AS details
      FROM ${auditEvents} WHERE ${scope} ORDER BY ${auditEvents.createdAt} DESC,${auditEvents.id} DESC LIMIT ${bounds.pageSize} OFFSET ${bounds.offset}
    ) SELECT events.*, CASE WHEN ${available} THEN left(product.title,200) END AS "currentTitle",
      CASE WHEN ${available} AND length(product.slug) BETWEEN 1 AND 160 THEN product.slug END AS "currentSlug",
      coalesce(${available},false) AS "hasCurrentAccess", CASE WHEN ${available} AND length(selected.version)<=128 THEN selected.version END AS "buildVersion"
    FROM events LEFT JOIN owned ON owned.resource_id=events."productId" LEFT JOIN ${products} product ON product.id=events."productId"
    LEFT JOIN LATERAL (SELECT ${builds.id} AS id FROM ${builds} WHERE ${safePublishedBuildCondition(sql`product.id`)} LIMIT 1) latest ON true
    LEFT JOIN LATERAL (SELECT ${builds.version} AS version FROM ${builds} WHERE ${safePublishedBuildCondition(sql`product.id`)} AND ${builds.id}=events.details->>'buildId' LIMIT 1) selected ON true
    ORDER BY events."createdAt" DESC,events.id DESC`);
      const items = rows.map(({ details, ...row }) => {
        const recorded = recordedLibraryRelease(details);
        return {
          ...row,
          ...recorded,
          currentTitle: row.hasCurrentAccess === true ? row.currentTitle : null,
          currentSlug: row.hasCurrentAccess === true ? row.currentSlug : null,
          buildVersion:
            row.hasCurrentAccess === true && recorded.selection?.mode === "fixed"
              ? row.buildVersion
              : null,
        };
      });
      return {
        schemaVersion: 1 as const,
        generatedAt: date.toISOString(),
        days: query.days,
        productId: query.productId ?? null,
        items,
        ...bounds,
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
