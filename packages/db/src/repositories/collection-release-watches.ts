import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import {
  AppError,
  NotFoundError,
  RESOURCE_RELEASE_WATCH_LIMIT,
  type ResourceReleaseWatchEnableCommand,
  type ResourceReleaseWatchResumeCommand,
  type ResourceReleaseWatchBatchResult,
  type ResourceReleaseWatchFilter,
} from "@nexus/domain";
import {
  libraryCollectionIdSchema,
  resourceReleaseWatchEnableCommandSchema,
  resourceReleaseWatchResumeCommandSchema,
} from "@nexus/validation";
import { db } from "../client";
import {
  auditEvents,
  builds,
  libraryCollections as collections,
  libraryCollectionItems as members,
  products,
  resourceReleaseEvents as events,
  resourceReleaseWatches as watches,
  users,
} from "../schema";
import { safePublishedBuildCondition } from "./build-safety";
import { effectiveUserDownloadSources } from "./user-library";
import { lockUserDownloadAccess, type ResourceTransaction } from "./entitlements";
import { containsPattern } from "./search-pattern";
import { historyPageBounds } from "./history-pagination";
const fail = (code = "RELEASE_WATCH_BATCH_CONFLICT") =>
  new AppError("Collection watches changed or are unavailable", 409, code);
const collectionFields = {
  id: collections.id,
  name: collections.name,
  status: collections.status,
  revision: collections.revision,
};
const watchFields = {
  productId: watches.productId,
  enabled: watches.enabled,
  revision: watches.revision,
  updatedAt: watches.updatedAt,
};
async function owner(tx: ResourceTransaction, userId: string, collectionId: string, lock = false) {
  const uq = tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  const [user] = await (lock ? uq.for("share") : uq);
  if (!user) throw new NotFoundError("Library account");
  const cq = tx
    .select(collectionFields)
    .from(collections)
    .where(and(eq(collections.id, collectionId), eq(collections.userId, userId)))
    .limit(1);
  const [collection] = await (lock ? cq.for("share") : cq);
  if (!collection) throw new NotFoundError("Collection");
  return collection;
}
export async function readCollectionReleaseWatches(
  userId: string,
  collectionId: string,
  page = 1,
  filter: ResourceReleaseWatchFilter = "all",
  query = "",
) {
  if (
    !libraryCollectionIdSchema.safeParse(collectionId).success ||
    typeof query !== "string" ||
    query.length > 100 ||
    !Number.isInteger(page) ||
    page < 1 ||
    page > 1000 ||
    !["all", "enabled", "disabled", "unavailable"].includes(filter)
  )
    throw new AppError("Invalid collection watch query", 400, "RELEASE_WATCH_QUERY_INVALID");
  query = query.trim();
  return db.transaction(
    async (tx) => {
      const collection = await owner(tx, userId, collectionId);
      const available = sql`owned.resource_id IS NOT NULL AND product.status='published' AND EXISTS(SELECT 1 FROM ${builds} WHERE ${safePublishedBuildCondition(sql`product.id`)})`;
      const sources = sql`${effectiveUserDownloadSources(userId, sql`transaction_timestamp()`)}, watch_rows AS (
      SELECT member.product_id AS "productId",member.added_at,coalesce(watch.enabled,false) AS enabled,coalesce(watch.revision,0) AS revision,watch.updated_at AS "updatedAt",
        coalesce(${available},false) AS available,CASE WHEN ${available} THEN left(product.title,200) END AS title
      FROM ${members} member LEFT JOIN owned ON owned.resource_id=member.product_id LEFT JOIN ${products} product ON product.id=member.product_id
      LEFT JOIN ${watches} watch ON watch.user_id=${userId} AND watch.product_id=member.product_id
      WHERE member.collection_id=${collectionId}
    )${query ? sql`, searched AS (SELECT * FROM watch_rows WHERE available AND title ILIKE ${containsPattern(query)})` : sql``}`;
      const table = query ? sql`searched` : sql`watch_rows`;
      const [summary] = await tx.execute<{
        all: number;
        enabled: number;
        disabled: number;
        unavailable: number;
        activeWatchCount: number;
      }>(sql`${sources}
      SELECT count(*)::int AS "all",count(*) FILTER(WHERE enabled)::int AS enabled,count(*) FILTER(WHERE NOT enabled)::int AS disabled,count(*) FILTER(WHERE NOT available)::int AS unavailable,
        (SELECT count(*)::int FROM ${watches} WHERE ${watches.userId}=${userId} AND ${watches.enabled}=true) AS "activeWatchCount" FROM ${table}`);
      const counts = {
        all: summary?.all ?? 0,
        enabled: summary?.enabled ?? 0,
        disabled: summary?.disabled ?? 0,
        unavailable: summary?.unavailable ?? 0,
      };
      const bounds = historyPageBounds(counts[filter], page);
      const condition =
        filter === "enabled"
          ? sql`enabled`
          : filter === "disabled"
            ? sql`NOT enabled`
            : filter === "unavailable"
              ? sql`NOT available`
              : sql`true`;
      const rows = await tx.execute<{
        productId: string;
        enabled: boolean;
        revision: number;
        updatedAt: Date | string | null;
        available: boolean;
        title: string | null;
      }>(sql`${sources}
      SELECT "productId",enabled,revision,"updatedAt",available,title FROM ${table} WHERE ${condition} ORDER BY added_at DESC,"productId" ASC LIMIT ${bounds.pageSize} OFFSET ${bounds.offset}`);
      return {
        collection,
        items: rows.map((row) => ({
          productId: row.productId,
          enabled: row.enabled,
          revision: row.revision,
          updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
          available: row.available,
          title: row.available ? row.title : null,
        })),
        counts,
        activeWatchCount: summary?.activeWatchCount ?? 0,
        ...bounds,
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
type EnrollmentInput = { userId: string; auditId: string } & (
  | { collectionId: string; command: ResourceReleaseWatchEnableCommand }
  | { collectionId?: undefined; command: ResourceReleaseWatchResumeCommand }
);
export function enableCollectionReleaseWatches(input: {
  userId: string;
  collectionId: string;
  command: ResourceReleaseWatchEnableCommand;
  auditId: string;
}) {
  return enrollReleaseWatches(input);
}
export function resumeResourceReleaseWatches(input: {
  userId: string;
  command: ResourceReleaseWatchResumeCommand;
  auditId: string;
}) {
  if ("collectionId" in input)
    throw new AppError("Unexpected collection scope", 400, "RELEASE_WATCH_INVALID");
  return enrollReleaseWatches(input);
}
async function enrollReleaseWatches(
  input: EnrollmentInput,
): Promise<ResourceReleaseWatchBatchResult> {
  const inCollection = input.collectionId !== undefined;
  const parsed = inCollection
    ? resourceReleaseWatchEnableCommandSchema.safeParse(input.command)
    : resourceReleaseWatchResumeCommandSchema.safeParse(input.command);
  if (
    !parsed.success ||
    (inCollection && !libraryCollectionIdSchema.safeParse(input.collectionId).success)
  )
    throw new AppError("Invalid collection watch command", 400, "RELEASE_WATCH_INVALID");
  const command = parsed.data,
    ids = command.items.map((item) => item.productId);
  return db.transaction(async (tx) => {
    await tx.execute(sql`set local lock_timeout='5s'`);
    await tx.execute(sql`set local statement_timeout='10s'`);
    if (inCollection)
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`library-collections:${input.userId}`}))`,
      );
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`resource-release-watch:${input.userId}`},0))`,
    );
    let collection: Awaited<ReturnType<typeof owner>> | null = null;
    if (input.collectionId !== undefined) {
      collection = await owner(tx, input.userId, input.collectionId, true);
      if (
        collection.status !== "active" ||
        !("expectedCollectionRevision" in command) ||
        collection.revision !== command.expectedCollectionRevision
      )
        throw fail("RELEASE_WATCH_COLLECTION_CONFLICT");
      const membership = await tx
        .select({ productId: members.productId })
        .from(members)
        .where(and(eq(members.collectionId, collection.id), inArray(members.productId, ids)))
        .orderBy(asc(members.productId))
        .for("share");
      if (membership.length !== ids.length) throw fail("RELEASE_WATCH_COLLECTION_CONFLICT");
    } else {
      const [actor] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1)
        .for("share");
      if (!actor) throw new NotFoundError("Library account");
    }
    const productRows = await tx
      .select({ id: products.id, status: products.status })
      .from(products)
      .where(inArray(products.id, ids))
      .orderBy(asc(products.id))
      .for("share");
    if (productRows.length !== ids.length || productRows.some((row) => row.status !== "published"))
      throw fail("RELEASE_WATCH_UNAVAILABLE");
    const expiries: (Date | null)[] = [];
    // Each source row is held until commit, bounded to the same 20-resource limit as other library batches.
    for (const id of ids) {
      const access = await lockUserDownloadAccess(tx, input.userId, id, sql`clock_timestamp()`);
      if (!access) throw fail("RELEASE_WATCH_UNAVAILABLE");
      expiries.push(access.expiresAt);
      const [build] = await tx
        .select({ id: builds.id })
        .from(builds)
        .where(safePublishedBuildCondition(id))
        .limit(1)
        .for("share");
      if (!build) throw fail("RELEASE_WATCH_UNAVAILABLE");
    }
    const previous = await tx
      .select(watchFields)
      .from(watches)
      .where(and(eq(watches.userId, input.userId), inArray(watches.productId, ids)))
      .orderBy(asc(watches.productId))
      .for("no key update");
    if (!inCollection && previous.length !== ids.length) throw fail();
    const previousById = new Map(previous.map((row) => [row.productId, row]));
    const matching = command.items.every((item) => {
      const row = previousById.get(item.productId);
      return row?.enabled === true && row.revision === item.expectedRevision + 1;
    });
    if (
      !matching &&
      command.items.some((item) => {
        const row = previousById.get(item.productId);
        return row
          ? row.enabled !== false || row.revision !== item.expectedRevision
          : item.expectedRevision !== 0;
      })
    )
      throw fail();
    if (!matching) {
      const [total] = await tx
        .select({ total: count() })
        .from(watches)
        .where(and(eq(watches.userId, input.userId), eq(watches.enabled, true)));
      if ((total?.total ?? 0) + ids.length > RESOURCE_RELEASE_WATCH_LIMIT)
        throw fail("RELEASE_WATCH_LIMIT");
    }
    const [clock] = await tx.execute<{ observedAt: string }>(
      sql`select date_trunc('milliseconds',clock_timestamp())::text AS "observedAt"`,
    );
    const observedAt = new Date(clock?.observedAt ?? "");
    if (!Number.isFinite(observedAt.getTime())) throw fail();
    if (expiries.some((expiry) => expiry !== null && expiry <= observedAt))
      throw fail("RELEASE_WATCH_UNAVAILABLE");
    if (matching)
      return {
        items: command.items.map((item) => {
          const row = previousById.get(item.productId);
          if (!row) throw fail();
          return row;
        }),
        changedCount: 0,
      };
    const updated = await tx.execute<{
      productId: string;
      enabled: boolean;
      revision: number;
      updatedAt: Date | string;
    }>(sql`
      WITH requested AS(SELECT * FROM jsonb_to_recordset(${JSON.stringify(command.items)}::jsonb) AS r("productId" text,"expectedRevision" integer))
      INSERT INTO ${watches}(user_id,product_id,enabled,revision,last_sequence,updated_at)
      SELECT ${input.userId},r."productId",true,r."expectedRevision"+1,
        coalesce((SELECT max(${events.sequence}) FROM ${events} WHERE ${events.productId}=r."productId"),0),${observedAt.toISOString()}::timestamptz FROM requested r WHERE true
      ON CONFLICT(user_id,product_id) DO UPDATE SET enabled=true,revision=excluded.revision,
        last_sequence=greatest(${watches.lastSequence},excluded.last_sequence),updated_at=greatest(${watches.updatedAt}+interval '1 millisecond',excluded.updated_at)
      WHERE ${watches.revision}=excluded.revision-1 AND ${watches.enabled}=false
      RETURNING product_id AS "productId",enabled,revision,updated_at AS "updatedAt"`);
    if (updated.length !== ids.length) throw fail();
    const resultById = new Map(
      updated.map((row) => [
        row.productId,
        {
          productId: row.productId,
          enabled: row.enabled,
          revision: row.revision,
          updatedAt: new Date(row.updatedAt),
        },
      ]),
    );
    const items = command.items.map((item) => {
      const row = resultById.get(item.productId);
      if (
        row?.enabled !== true ||
        row.revision !== item.expectedRevision + 1 ||
        !Number.isFinite(row.updatedAt.getTime())
      )
        throw fail();
      return row;
    });
    await tx.insert(auditEvents).values({
      id: input.auditId,
      actorId: input.userId,
      actorType: "user",
      action: collection
        ? "library.collection_release_watches_enabled"
        : "library.release_watches_resumed",
      targetType: collection ? "library_collection" : "user",
      targetId: collection?.id ?? input.userId,
      details: {
        ...(collection ? { collectionRevision: collection.revision } : {}),
        items: items.map(({ productId, revision }) => ({ productId, revision })),
        changedCount: items.length,
      },
    });
    return { items, changedCount: items.length };
  });
}
