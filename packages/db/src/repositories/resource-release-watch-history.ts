import { and, count, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import {
  AppError,
  NotFoundError,
  LIBRARY_RELEASE_HISTORY_DAYS,
  RESOURCE_RELEASE_WATCH_HISTORY_SOURCES,
  recordedResourceReleaseWatchOperation,
  type ResourceReleaseWatchHistoryQuery,
} from "@nexus/domain";
import { db } from "../client";
import { auditEvents, products, builds, resourceReleaseWatches as watches, users } from "../schema";
import { effectiveUserDownloadSources } from "./user-library";
import { safePublishedBuildCondition } from "./build-safety";
import { historyPageBounds } from "./history-pagination";
const safeItems = sql`CASE WHEN jsonb_typeof(${auditEvents.details}->'items')='array' THEN CASE WHEN jsonb_array_length(${auditEvents.details}->'items') BETWEEN 1 AND 20 THEN ${auditEvents.details}->'items' ELSE '[]'::jsonb END ELSE '[]'::jsonb END`;
const boundedNumber = (value: SQL) =>
  sql`CASE WHEN jsonb_typeof(${value})='number' AND length((${value})::text)<=10 THEN ${value} END`;
export async function readResourceReleaseWatchHistory(
  userId: string,
  query: ResourceReleaseWatchHistoryQuery,
) {
  if (
    !Number.isInteger(query.page) ||
    query.page < 1 ||
    query.page > 1000 ||
    !LIBRARY_RELEASE_HISTORY_DAYS.includes(query.days) ||
    !RESOURCE_RELEASE_WATCH_HISTORY_SOURCES.includes(query.source) ||
    (query.productId !== undefined &&
      (typeof query.productId !== "string" || !/^[A-Za-z0-9_-]{1,160}$/u.test(query.productId)))
  )
    throw new AppError("Invalid watch history query", 400, "RELEASE_WATCH_QUERY_INVALID");
  return db.transaction(
    async (tx) => {
      const [actor] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (!actor) throw new NotFoundError("Library account");
      const [clock] = await tx.execute<{ observedAt: Date | string }>(
        sql`SELECT transaction_timestamp() AS "observedAt"`,
      );
      const date = new Date(clock?.observedAt ?? "");
      if (!Number.isFinite(date.getTime()))
        throw new AppError("Invalid history snapshot", 500, "RELEASE_WATCH_HISTORY_INVALID");
      const actions = {
        individual: "library.release_watch_changed",
        batch: ["library.release_watches_disabled", "library.release_watches_resumed"],
        collection: "library.collection_release_watches_enabled",
      } as const;
      const scope = and(
        eq(auditEvents.actorId, userId),
        sql`${auditEvents.actorType}='user' AND ${auditEvents.action} IN ('library.release_watch_changed','library.release_watches_disabled','library.release_watches_resumed','library.collection_release_watches_enabled')`,
        sql`((${auditEvents.action}='library.release_watch_changed' AND ${auditEvents.targetType}='product') OR (${auditEvents.action} IN ('library.release_watches_disabled','library.release_watches_resumed') AND ${auditEvents.targetType}='user' AND ${auditEvents.targetId}=${userId}) OR (${auditEvents.action}='library.collection_release_watches_enabled' AND ${auditEvents.targetType}='library_collection'))`,
        gte(auditEvents.createdAt, sql`transaction_timestamp()-${query.days}*interval '1 day'`),
        lte(auditEvents.createdAt, sql`transaction_timestamp()`),
        query.source === "batch"
          ? sql`${auditEvents.action} IN (${actions.batch[0]},${actions.batch[1]})`
          : query.source !== "all"
            ? eq(auditEvents.action, actions[query.source])
            : undefined,
        query.productId
          ? sql`((${auditEvents.action}='library.release_watch_changed' AND ${auditEvents.targetId}=${query.productId}) OR (${auditEvents.action}<>'library.release_watch_changed' AND EXISTS(SELECT 1 FROM jsonb_array_elements(${safeItems}) entry WHERE entry->>'productId'=${query.productId})))`
          : undefined,
      );
      const [summary] = await tx.select({ total: count() }).from(auditEvents).where(scope);
      const bounds = historyPageBounds(summary?.total ?? 0, query.page);
      const rows = await tx.execute<{
        id: string;
        createdAt: Date | string;
        action: string;
        targetId: string;
        payload: unknown;
      }>(sql`
      SELECT ${auditEvents.id} AS id,${auditEvents.createdAt} AS "createdAt",${auditEvents.action} AS action,left(${auditEvents.targetId},161) AS "targetId",
      jsonb_build_object('enabled',CASE WHEN jsonb_typeof(${auditEvents.details}->'enabled')='boolean' THEN ${auditEvents.details}->'enabled' END,
        'revision',${boundedNumber(sql`${auditEvents.details}->'revision'`)},'changedCount',${boundedNumber(sql`${auditEvents.details}->'changedCount'`)},'collectionRevision',${boundedNumber(sql`${auditEvents.details}->'collectionRevision'`)},
        'items',(SELECT jsonb_agg(jsonb_build_object('productId',CASE WHEN jsonb_typeof(entry->'productId')='string' THEN left(entry->>'productId',161) END,'revision',${boundedNumber(sql`entry->'revision'`)})) FROM jsonb_array_elements(${safeItems}) entry)) AS payload
      FROM ${auditEvents} WHERE ${scope} ORDER BY ${auditEvents.createdAt} DESC,${auditEvents.id} DESC LIMIT ${bounds.pageSize} OFFSET ${bounds.offset}`);
      const parsed = rows.map((row) => ({
        id: row.id,
        createdAt: new Date(row.createdAt).toISOString(),
        ...recordedResourceReleaseWatchOperation(row.action, row.targetId, row.payload),
      }));
      const ids = [
        ...new Set(parsed.flatMap((row) => row.changes?.map((item) => item.productId) ?? [])),
      ];
      const current = ids.length
        ? await tx.execute<{
            productId: string;
            title: string | null;
            available: boolean;
            enabled: boolean | null;
            revision: number | null;
          }>(sql`${effectiveUserDownloadSources(userId, sql`transaction_timestamp()`)}, refs AS(SELECT value AS id FROM jsonb_array_elements_text(${JSON.stringify(ids)}::jsonb))
      SELECT refs.id AS "productId",CASE WHEN owned.resource_id IS NOT NULL AND product.status='published' AND latest.id IS NOT NULL THEN left(product.title,200) END AS title,
        coalesce(owned.resource_id IS NOT NULL AND product.status='published' AND latest.id IS NOT NULL,false) AS available,watch.enabled,watch.revision
      FROM refs LEFT JOIN owned ON owned.resource_id=refs.id LEFT JOIN ${products} product ON product.id=refs.id
      LEFT JOIN ${watches} watch ON watch.user_id=${userId} AND watch.product_id=refs.id
      LEFT JOIN LATERAL(SELECT ${builds.id} AS id FROM ${builds} WHERE ${safePublishedBuildCondition(sql`product.id`)} LIMIT 1) latest ON true`)
        : [];
      const byId = new Map(current.map((row) => [row.productId, row]));
      const items = parsed.map((row) => ({
        ...row,
        changes:
          row.changes?.map((change) => {
            const now = byId.get(change.productId);
            const available = now?.available === true;
            return {
              ...change,
              currentTitle: available ? now.title : null,
              currentAvailable: available,
              currentWatch:
                typeof now?.enabled === "boolean" && typeof now.revision === "number"
                  ? { enabled: now.enabled, revision: now.revision }
                  : null,
            };
          }) ?? null,
      }));
      return {
        schemaVersion: 1 as const,
        generatedAt: date.toISOString(),
        days: query.days,
        source: query.source,
        productId: query.productId ?? null,
        items,
        ...bounds,
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
