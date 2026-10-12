import { resourceReleaseWatchCommandSchema } from "@nexus/validation";
import { readResourceReleaseWatchHistory } from "./resource-release-watch-history";
import { and, asc, count, desc, eq, ilike, sql } from "drizzle-orm";
import {
  AppError,
  NotFoundError,
  RESOURCE_RELEASE_WATCH_LIMIT,
  type ResourceReleaseWatchCommand,
  type ResourceReleaseWatchFilter,
} from "@nexus/domain";
import {
  readCollectionReleaseWatches,
  enableCollectionReleaseWatches,
} from "./collection-release-watches";
import { disableResourceReleaseWatchBatch } from "./resource-release-watch-batches";
import { db } from "../client";
import {
  auditEvents,
  products,
  resourceReleaseEvents as events,
  resourceReleaseWatches as watches,
  users,
  builds,
} from "../schema";
import { lockUserDownloadAccess, type ResourceTransaction } from "./entitlements";
import { effectiveUserDownloadSources } from "./user-library";
import { safePublishedBuildCondition } from "./build-safety";
import { historyPageBounds } from "./history-pagination";
const fields = {
  productId: watches.productId,
  enabled: watches.enabled,
  revision: watches.revision,
  updatedAt: watches.updatedAt,
};
const fail = (code: string) => new AppError("Resource watch cannot be changed", 409, code);
async function parentAndUser(tx: ResourceTransaction, userId: string, productId: string) {
  const [product] = await tx
    .select({ id: products.id, status: products.status })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1)
    .for("share");
  const [user] = await tx
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
    .for("share");
  if (!product || !user) throw new NotFoundError("Library resource", productId);
  return product;
}
function currentAccess(
  access: Awaited<ReturnType<typeof lockUserDownloadAccess>>,
  productId: string,
  observedAt: Date,
) {
  if (!access || (access.expiresAt && access.expiresAt <= observedAt))
    throw new NotFoundError("Library resource", productId);
}
async function databaseClock(tx: ResourceTransaction) {
  const [clock] = await tx.execute<{ observedAt: string }>(
    sql`select date_trunc('milliseconds',clock_timestamp())::text AS "observedAt"`,
  );
  const observedAt = new Date(clock?.observedAt ?? "");
  if (!Number.isFinite(observedAt.getTime())) throw fail("RELEASE_WATCH_CONFLICT");
  return observedAt;
}
function usable(userId: string) {
  return sql<boolean>`coalesce(${products.status} = 'published' and exists (
    ${effectiveUserDownloadSources(userId, sql`transaction_timestamp()`)} select 1 from owned where owned.resource_id = ${products.id}
  ) and exists (select 1 from ${builds} where ${safePublishedBuildCondition(products.id.getSQL())}), false)`;
}
export class ResourceReleaseWatchesRepository {
  history = readResourceReleaseWatchHistory;
  disableBatch = disableResourceReleaseWatchBatch;
  collectionPage = readCollectionReleaseWatches;
  enableCollectionBatch = enableCollectionReleaseWatches;
  async detail(userId: string, productId: string) {
    return db.transaction(async (tx) => {
      await parentAndUser(tx, userId, productId);
      const [watch] = await tx
        .select(fields)
        .from(watches)
        .where(and(eq(watches.userId, userId), eq(watches.productId, productId)))
        .limit(1);
      if (!watch) {
        const access = await lockUserDownloadAccess(tx, userId, productId, sql`clock_timestamp()`);
        currentAccess(access, productId, await databaseClock(tx));
      }
      return watch ?? { productId, enabled: false, revision: 0, updatedAt: null };
    });
  }
  async command(input: {
    userId: string;
    productId: string;
    command: ResourceReleaseWatchCommand;
    auditId: string;
  }) {
    const parsed = resourceReleaseWatchCommandSchema.safeParse(input.command);
    if (
      !parsed.success ||
      typeof input.productId !== "string" ||
      !/^[A-Za-z0-9_-]{1,160}$/u.test(input.productId)
    )
      throw new AppError("Invalid release preference", 400, "RELEASE_WATCH_INVALID");
    const command = parsed.data;
    return db.transaction(async (tx) => {
      await tx.execute(sql`set local lock_timeout='5s'`);
      await tx.execute(sql`set local statement_timeout='10s'`);
      // Serialize enrollment counts across resources for this account only.
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`resource-release-watch:${input.userId}`}, 0))`,
      );
      const product = await parentAndUser(tx, input.userId, input.productId);
      const access = command.enabled
        ? await lockUserDownloadAccess(tx, input.userId, product.id, sql`clock_timestamp()`)
        : null;
      if (command.enabled) {
        if (!access) throw new NotFoundError("Library resource", product.id);
        if (product.status !== "published") throw fail("RELEASE_WATCH_UNAVAILABLE");
        const [build] = await tx
          .select({ id: builds.id })
          .from(builds)
          .where(safePublishedBuildCondition(product.id))
          .limit(1)
          .for("share");
        if (!build) throw fail("RELEASE_WATCH_UNAVAILABLE");
      }
      const [previous] = await tx
        .select({ ...fields, lastSequence: watches.lastSequence })
        .from(watches)
        .where(and(eq(watches.userId, input.userId), eq(watches.productId, product.id)))
        .limit(1)
        .for("no key update");
      if (!previous && !command.enabled) throw new NotFoundError("Release watch", product.id);
      const revision = previous?.revision ?? 0;
      if (
        revision !== command.expectedRevision &&
        !(previous?.enabled === command.enabled && revision === command.expectedRevision + 1)
      )
        throw fail("RELEASE_WATCH_CONFLICT");
      if (previous?.enabled === command.enabled) {
        if (command.enabled) currentAccess(access, product.id, await databaseClock(tx));
        return {
          productId: previous.productId,
          enabled: previous.enabled,
          revision,
          updatedAt: previous.updatedAt,
        };
      }
      if (command.enabled) {
        const [total] = await tx
          .select({ total: count() })
          .from(watches)
          .where(and(eq(watches.userId, input.userId), eq(watches.enabled, true)));
        if ((total?.total ?? 0) >= RESOURCE_RELEASE_WATCH_LIMIT) throw fail("RELEASE_WATCH_LIMIT");
      }
      const [latest] = await tx
        .select({ sequence: events.sequence })
        .from(events)
        .where(eq(events.productId, product.id))
        .orderBy(desc(events.sequence))
        .limit(1);
      const lastSequence =
        (latest?.sequence ?? 0n) > (previous?.lastSequence ?? 0n)
          ? (latest?.sequence ?? 0n)
          : (previous?.lastSequence ?? 0n);
      const observedAt = await databaseClock(tx);
      if (command.enabled) currentAccess(access, product.id, observedAt);
      const updatedAt = observedAt,
        values = {
          userId: input.userId,
          productId: product.id,
          enabled: command.enabled,
          revision: revision + 1,
          lastSequence,
          updatedAt,
        };
      const [watch] = await tx
        .insert(watches)
        .values(values)
        .onConflictDoUpdate({
          target: [watches.userId, watches.productId],
          set: {
            enabled: command.enabled,
            revision: revision + 1,
            lastSequence: sql`greatest(${watches.lastSequence},excluded.last_sequence)`,
            updatedAt: sql`greatest(${watches.updatedAt}+interval '1 millisecond',excluded.updated_at)`,
          },
          setWhere: previous
            ? and(eq(watches.revision, previous.revision), eq(watches.enabled, previous.enabled))
            : sql`false`,
        })
        .returning(fields);
      if (
        !watch ||
        watch.productId !== product.id ||
        watch.enabled !== command.enabled ||
        watch.revision !== revision + 1 ||
        !Number.isFinite(watch.updatedAt.getTime())
      )
        throw fail("RELEASE_WATCH_CONFLICT");
      await tx.insert(auditEvents).values({
        id: input.auditId,
        actorId: input.userId,
        actorType: "user",
        action: "library.release_watch_changed",
        targetType: "product",
        targetId: product.id,
        details: { enabled: watch.enabled, revision: watch.revision },
      });
      return watch;
    });
  }
  async page(userId: string, page = 1, filter: ResourceReleaseWatchFilter = "all", query = "") {
    if (
      typeof query !== "string" ||
      query.length > 100 ||
      !Number.isInteger(page) ||
      page < 1 ||
      page > 1000 ||
      !["all", "enabled", "disabled", "unavailable"].includes(filter)
    )
      throw new AppError("Invalid watch query", 400, "RELEASE_WATCH_QUERY_INVALID");
    query = query.trim();
    return db.transaction(
      async (tx) => {
        const available = usable(userId),
          own = and(
            eq(watches.userId, userId),
            query
              ? and(
                  available,
                  ilike(
                    products.title,
                    `%${query.replace(/[\\%_]/gu, (character) => `\\${character}`)}%`,
                  ),
                )
              : undefined,
          );
        const [summary] = await tx
          .select({
            all: count(),
            enabled: sql<number>`count(*) filter (where ${watches.enabled})::integer`,
            disabled: sql<number>`count(*) filter (where not ${watches.enabled})::integer`,
            unavailable: sql<number>`count(*) filter (where not ${available})::integer`,
          })
          .from(watches)
          .leftJoin(products, eq(products.id, watches.productId))
          .where(own);
        const counts = summary ?? { all: 0, enabled: 0, disabled: 0, unavailable: 0 },
          bounds = historyPageBounds(counts[filter], page);
        const condition =
          filter === "enabled"
            ? eq(watches.enabled, true)
            : filter === "disabled"
              ? eq(watches.enabled, false)
              : filter === "unavailable"
                ? sql`not ${available}`
                : undefined;
        const items = await tx
          .select({
            ...fields,
            available,
            title: sql<
              string | null
            >`case when ${available} then left(${products.title},200) else null end`,
          })
          .from(watches)
          .leftJoin(products, eq(products.id, watches.productId))
          .where(and(own, condition))
          .orderBy(desc(watches.updatedAt), asc(watches.productId))
          .limit(bounds.pageSize)
          .offset(bounds.offset);
        return { items, counts, ...bounds };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
}
export const resourceReleaseWatchesRepository = new ResourceReleaseWatchesRepository();
