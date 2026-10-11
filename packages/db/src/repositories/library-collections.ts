import { createHash } from "node:crypto";
import {
  AppError,
  LIBRARY_COLLECTION_COMMAND_LIMIT,
  LIBRARY_COLLECTION_ITEM_LIMIT,
  LIBRARY_COLLECTION_LIMIT,
  type LibraryCollectionCommand,
  type LibraryCollectionCopyPreview,
  type LibraryReleaseFilter,
  type LibraryCollectionReceipt,
  type LibraryCollectionSnapshot,
  NotFoundError,
} from "@nexus/domain";
import { libraryCollectionCommandSchema, libraryCollectionIdSchema } from "@nexus/validation";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../client";
import {
  auditEvents,
  builds,
  libraryCollections as collections,
  libraryCollectionItems as members,
  products,
  libraryCollectionReceipts as receipts,
  resourceLibrarySelections as selections,
  users,
} from "../schema";
import { safePublishedBuildCondition } from "./build-safety";
import { lockUserDownloadAccess, type ResourceTransaction } from "./entitlements";
import { historyPageBounds } from "./history-pagination";
import { containsPattern } from "./search-pattern";
import { readLibraryReleasePage } from "./library-release-page";
import { effectiveUserDownloadSources } from "./user-library";

const fail = (code: string) => new AppError("Collection command is unavailable", 409, code);
const fields = {
  id: collections.id,
  name: collections.name,
  status: collections.status,
  revision: collections.revision,
  createdAt: collections.createdAt,
  updatedAt: collections.updatedAt,
};
const receiptFields = {
  id: receipts.id,
  requestId: receipts.requestId,
  command: receipts.command,
  snapshot: receipts.snapshot,
  createdAt: receipts.createdAt,
};
function publicReceipt(
  row: Pick<
    typeof receipts.$inferSelect,
    "id" | "requestId" | "command" | "snapshot" | "createdAt"
  >,
): LibraryCollectionReceipt {
  return {
    id: row.id,
    requestId: row.requestId,
    command: row.command,
    collection: row.snapshot,
    createdAt: row.createdAt,
  };
}
async function liveUser(tx: ResourceTransaction, userId: string, lock = false) {
  const query = tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  const [actor] = await (lock ? query.for("share") : query);
  if (!actor) throw new NotFoundError("Library", userId);
}
async function owned(tx: ResourceTransaction, userId: string, id: string, lock = false) {
  const query = tx
    .select(fields)
    .from(collections)
    .where(and(eq(collections.id, id), eq(collections.userId, userId)))
    .limit(1);
  const [collection] = await (lock ? query.for("no key update") : query);
  if (!collection) throw new NotFoundError("Collection", id);
  return collection;
}
const readOptions = { isolationLevel: "repeatable read", accessMode: "read only" } as const;

async function copySource(
  tx: ResourceTransaction,
  userId: string,
  id: string,
  lock = false,
): Promise<LibraryCollectionCopyPreview & { productIds: string[] }> {
  const sourceRow = await owned(tx, userId, id, lock);
  const source: LibraryCollectionSnapshot = {
    id: sourceRow.id,
    name: sourceRow.name,
    status: sourceRow.status,
    revision: sourceRow.revision,
  };
  const rows = await tx
    .select({ productId: members.productId })
    .from(members)
    .where(eq(members.collectionId, id))
    .limit(LIBRARY_COLLECTION_ITEM_LIMIT + 1);
  if (rows.length > LIBRARY_COLLECTION_ITEM_LIMIT) throw fail("COLLECTION_ITEM_LIMIT");
  const productIds = rows.map((row) => row.productId).sort();
  const sourceDigest = createHash("sha256")
    .update(JSON.stringify({ source, productIds }))
    .digest("hex");
  return { source, itemCount: productIds.length, sourceDigest, productIds };
}

/** All entries are references. Current entitlement and clean publication are
 * independently projected; membership never widens download authorization. */
function resourceRows(userId: string, collectionId: string, candidates: boolean) {
  const source = candidates
    ? sql`FROM owned JOIN ${products} product ON product.id=owned.resource_id
        LEFT JOIN ${members} member ON member.collection_id=${collectionId} AND member.product_id=owned.resource_id`
    : sql`FROM ${members} member LEFT JOIN owned ON owned.resource_id=member.product_id
        LEFT JOIN ${products} product ON product.id=member.product_id`;
  return sql`${effectiveUserDownloadSources(userId, new Date())}, resource_rows AS (
    SELECT ${candidates ? sql`owned.resource_id` : sql`member.product_id`} AS "productId",
      ${candidates ? sql`owned.added_at` : sql`member.added_at`} AS "addedAt",
      owned.resource_id IS NOT NULL AS "hasAccess", member.product_id IS NOT NULL AS "inCollection",
      CASE WHEN owned.resource_id IS NOT NULL AND product.status='published' AND latest.id IS NOT NULL THEN product.title END AS title,
      CASE WHEN owned.resource_id IS NOT NULL AND product.status='published' AND latest.id IS NOT NULL THEN product.slug END AS slug,
      CASE WHEN owned.resource_id IS NOT NULL AND product.status='published' AND latest.id IS NOT NULL
        THEN CASE WHEN pref.mode='fixed' THEN selected.version ELSE latest.version END END AS version,
      CASE WHEN owned.resource_id IS NOT NULL AND product.status='published' AND latest.id IS NOT NULL AND pref.mode='fixed' THEN selected.id END AS "buildId",
      coalesce(owned.resource_id IS NOT NULL AND product.status='published' AND latest.id IS NOT NULL AND (pref.mode IS NULL OR pref.mode='latest' OR selected.id IS NOT NULL),false) AS downloadable
    ${source}
    LEFT JOIN ${selections} pref ON pref.user_id=${userId} AND pref.product_id=product.id
    LEFT JOIN LATERAL (
      SELECT ${builds.id} AS id,${builds.version} AS version FROM ${builds}
      WHERE ${safePublishedBuildCondition(sql`product.id`)} ORDER BY ${builds.createdAt} DESC,${builds.id} DESC LIMIT 1
    ) latest ON true
    LEFT JOIN LATERAL (
      SELECT ${builds.id} AS id,${builds.version} AS version FROM ${builds}
      WHERE ${safePublishedBuildCondition(sql`product.id`)} AND ${builds.id}=pref.build_id LIMIT 1
    ) selected ON true
    ${candidates ? sql`` : sql`WHERE member.collection_id=${collectionId}`}
  )`;
}
export type LibraryCollectionItem = {
  productId: string;
  addedAt: Date;
  title: string | null;
  slug: string | null;
  version: string | null;
  buildId: string | null;
  downloadable: boolean;
  hasAccess: boolean;
  inCollection: boolean;
};
export class LibraryCollectionsRepository {
  async page(userId: string, page = 1, status: "all" | "active" | "archived" = "active") {
    return db.transaction(async (tx) => {
      await liveUser(tx, userId);
      const scope = and(
        eq(collections.userId, userId),
        status === "all" ? undefined : eq(collections.status, status),
      );
      const [summary] = await tx.select({ total: count() }).from(collections).where(scope);
      const bounds = historyPageBounds(summary?.total ?? 0, page);
      const items = await tx
        .select({
          ...fields,
          itemCount: sql<number>`(select count(*)::integer from ${members} where ${members.collectionId}=${collections.id})`,
        })
        .from(collections)
        .where(scope)
        .orderBy(desc(collections.updatedAt), collections.id)
        .limit(bounds.pageSize)
        .offset(bounds.offset);
      return { items, status, ...bounds, limit: LIBRARY_COLLECTION_LIMIT };
    }, readOptions);
  }
  async detail(userId: string, id: string, page = 1, q = "", candidates = false) {
    return db.transaction(async (tx) => {
      await liveUser(tx, userId);
      const collection = await owned(tx, userId, id);
      if (candidates && collection.status !== "active") throw fail("COLLECTION_ARCHIVED");
      const sources = resourceRows(userId, id, candidates),
        search = q ? sql`WHERE title ILIKE ${containsPattern(q)}` : sql``;
      const [summary] = await tx.execute<{ total: number; ready: number }>(sql`${sources}
        SELECT count(*)::integer AS total, count(*) FILTER(WHERE downloadable)::integer AS ready FROM resource_rows ${search}`);
      const bounds = historyPageBounds(Number(summary?.total ?? 0), page);
      const items = await tx.execute<LibraryCollectionItem>(sql`${sources}
        SELECT "productId","addedAt",title,slug,version,"buildId",downloadable,"hasAccess","inCollection"
        FROM resource_rows ${search} ORDER BY "addedAt" DESC,"productId" ASC LIMIT ${bounds.pageSize} OFFSET ${bounds.offset}`);
      return {
        collection,
        items,
        ...bounds,
        ready: Number(summary?.ready ?? 0),
        q,
        candidates,
        itemLimit: LIBRARY_COLLECTION_ITEM_LIMIT,
      };
    }, readOptions);
  }
  async releases(
    userId: string,
    id: string,
    page = 1,
    filter: LibraryReleaseFilter = "all",
    q = "",
  ) {
    // biome-ignore lint/suspicious/noControlCharactersInRegex: Reject control characters in private searches.
    const controls = /[\u0000-\u001f\u007f]/u.test(q);
    if (
      !libraryCollectionIdSchema.safeParse(id).success ||
      controls ||
      !["all", "updates", "pinned", "unavailable"].includes(filter) ||
      !Number.isInteger(page) ||
      page < 1 ||
      page > 9999 ||
      q.length > 80
    )
      throw new AppError("Invalid collection releases", 400, "COLLECTION_INVALID");
    return db.transaction(async (tx) => {
      await liveUser(tx, userId);
      const current = await owned(tx, userId, id);
      const collection: LibraryCollectionSnapshot = {
        id: current.id,
        name: current.name,
        status: current.status,
        revision: current.revision,
      };
      const [snapshot] = await tx.execute<{ observedAt: Date | string; itemCount: number }>(
        sql`SELECT transaction_timestamp() AS "observedAt", (SELECT count(*)::integer FROM ${members} WHERE ${members.collectionId}=${id}) AS "itemCount"`,
      );
      const timestamp = new Date(snapshot?.observedAt ?? "");
      if (!Number.isFinite(timestamp.getTime()))
        throw new AppError("Invalid database snapshot", 500, "COLLECTION_SNAPSHOT_INVALID");
      const result = await readLibraryReleasePage(tx, userId, page, filter, q.trim(), id);
      return {
        schemaVersion: 1 as const,
        collection,
        generatedAt: timestamp.toISOString(),
        itemCount: Number(snapshot.itemCount),
        ...result,
      };
    }, readOptions);
  }
  async copyPreview(userId: string, id: string): Promise<LibraryCollectionCopyPreview> {
    if (!libraryCollectionIdSchema.safeParse(id).success)
      throw new AppError("Invalid collection", 400, "COLLECTION_INVALID");
    return db.transaction(async (tx) => {
      await liveUser(tx, userId);
      const { productIds: _ids, ...preview } = await copySource(tx, userId, id);
      return preview;
    }, readOptions);
  }
  async history(userId: string, id: string, page = 1) {
    return db.transaction(async (tx) => {
      await liveUser(tx, userId);
      const collection = await owned(tx, userId, id),
        scope = and(eq(receipts.userId, userId), eq(receipts.collectionId, id));
      const [summary] = await tx.select({ total: count() }).from(receipts).where(scope);
      const bounds = historyPageBounds(summary?.total ?? 0, page);
      const items = await tx
        .select(receiptFields)
        .from(receipts)
        .where(scope)
        .orderBy(desc(receipts.createdAt), desc(receipts.id))
        .limit(bounds.pageSize)
        .offset(bounds.offset);
      return { collection, items: items.map(publicReceipt), ...bounds };
    }, readOptions);
  }
  async command(input: {
    userId: string;
    collectionId?: string;
    command: LibraryCollectionCommand;
    newCollectionId: string;
    receiptId: string;
    auditId: string;
  }) {
    const parsed = libraryCollectionCommandSchema.safeParse(input.command);
    if (
      !parsed.success ||
      (parsed.data.action === "create" || parsed.data.action === "duplicate") !==
        !input.collectionId ||
      (input.collectionId && !libraryCollectionIdSchema.safeParse(input.collectionId).success)
    )
      throw new AppError("Invalid collection command", 400, "COLLECTION_INVALID");
    const command = parsed.data,
      digest = createHash("sha256").update(JSON.stringify(command)).digest("hex");
    return db.transaction(async (tx) => {
      await tx.execute(sql`set local lock_timeout='5s'`);
      await tx.execute(sql`set local statement_timeout='10s'`);
      // Serialize quota, command keys and collection mutations for this owner.
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`library-collections:${input.userId}`}))`,
      );
      await liveUser(tx, input.userId, true);
      const [previous] = await tx
        .select()
        .from(receipts)
        .where(and(eq(receipts.userId, input.userId), eq(receipts.requestId, command.requestId)))
        .limit(1);
      if (previous) {
        if (
          previous.commandDigest !== digest ||
          (input.collectionId && previous.collectionId !== input.collectionId)
        )
          throw fail("COLLECTION_REQUEST_REUSED");
        await owned(tx, input.userId, previous.collectionId);
        return { receipt: publicReceipt(previous), replayed: true };
      }
      let collection: LibraryCollectionSnapshot;
      if (command.action === "create" || command.action === "duplicate") {
        let copy: Awaited<ReturnType<typeof copySource>> | undefined;
        if (command.action === "duplicate") {
          if (input.newCollectionId === command.sourceCollectionId)
            throw fail("COLLECTION_CONFLICT");
          copy = await copySource(tx, input.userId, command.sourceCollectionId, true);
          if (
            copy.source.revision !== command.expectedRevision ||
            copy.itemCount !== command.expectedItemCount ||
            copy.sourceDigest !== command.sourceDigest
          )
            throw fail("COLLECTION_CONFLICT");
        }
        const [summary] = await tx
          .select({ total: count() })
          .from(collections)
          .where(eq(collections.userId, input.userId));
        if ((summary?.total ?? 0) >= LIBRARY_COLLECTION_LIMIT) throw fail("COLLECTION_LIMIT");
        const [created] = await tx
          .insert(collections)
          .values({ id: input.newCollectionId, userId: input.userId, name: command.name })
          .returning(fields);
        collection = created;
        if (copy?.productIds.length)
          await tx
            .insert(members)
            .values(copy.productIds.map((productId) => ({ collectionId: created.id, productId })));
      } else {
        if (!input.collectionId)
          throw new AppError("Missing collection", 400, "COLLECTION_INVALID");
        const current = await owned(tx, input.userId, input.collectionId, true);
        if (current.revision !== command.expectedRevision) throw fail("COLLECTION_CONFLICT");
        const [summary] = await tx
          .select({ total: count() })
          .from(receipts)
          .where(eq(receipts.collectionId, current.id));
        if ((summary?.total ?? 0) >= LIBRARY_COLLECTION_COMMAND_LIMIT)
          throw fail("COLLECTION_HISTORY_LIMIT");
        if (
          command.action === "restore" ? current.status !== "archived" : current.status !== "active"
        )
          throw fail("COLLECTION_ARCHIVED");
        if (command.action === "add-many") {
          // Lock resources and grants in canonical order. Do not write a partial batch.
          const accessTerms: { productId: string; expiresAt: Date | null }[] = [];
          for (const productId of command.productIds) {
            const [product] = await tx
              .select({ id: products.id })
              .from(products)
              .where(eq(products.id, productId))
              .limit(1)
              .for("share");
            const access = product
              ? await lockUserDownloadAccess(tx, input.userId, productId)
              : null;
            if (!access) throw new NotFoundError("Library resource", productId);
            accessTerms.push({ productId, expiresAt: access.expiresAt });
          }
          const present = await tx
            .select({ productId: members.productId })
            .from(members)
            .where(
              and(
                eq(members.collectionId, current.id),
                inArray(members.productId, command.productIds),
              ),
            );
          const presentIds = new Set(present.map((item) => item.productId));
          const missing = command.productIds.filter((id) => !presentIds.has(id));
          const [total] = await tx
            .select({ total: count() })
            .from(members)
            .where(eq(members.collectionId, current.id));
          if ((total?.total ?? 0) + missing.length > LIBRARY_COLLECTION_ITEM_LIMIT)
            throw fail("COLLECTION_ITEM_LIMIT");
          // Recheck every expiry against database time after all potentially blocking locks.
          const [term] = await tx.execute<{ valid: boolean }>(
            sql`select ${sql.join(
              accessTerms.map((access) =>
                access.expiresAt === null
                  ? sql`true`
                  : sql`${access.expiresAt}::timestamptz > clock_timestamp()`,
              ),
              sql` AND `,
            )} AS valid`,
          );
          if (term?.valid !== true) throw fail("COLLECTION_ACCESS_CHANGED");
          if (missing.length)
            await tx
              .insert(members)
              .values(missing.map((productId) => ({ collectionId: current.id, productId })));
        } else if (command.action === "remove-many") {
          // References can be cleaned up even after resource deletion or revoked access.
          await tx
            .delete(members)
            .where(
              and(
                eq(members.collectionId, current.id),
                inArray(members.productId, command.productIds),
              ),
            );
        } else if (command.action === "add") {
          const [product] = await tx
            .select({ id: products.id })
            .from(products)
            .where(eq(products.id, command.productId))
            .limit(1)
            .for("share");
          const access = product
            ? await lockUserDownloadAccess(tx, input.userId, command.productId)
            : null;
          if (!access) throw new NotFoundError("Library resource", command.productId);
          const [member] = await tx
            .select({ productId: members.productId })
            .from(members)
            .where(
              and(eq(members.collectionId, current.id), eq(members.productId, command.productId)),
            )
            .limit(1);
          if (!member) {
            const [total] = await tx
              .select({ total: count() })
              .from(members)
              .where(eq(members.collectionId, current.id));
            if ((total?.total ?? 0) >= LIBRARY_COLLECTION_ITEM_LIMIT)
              throw fail("COLLECTION_ITEM_LIMIT");
          }
          // Recheck expiry against the database clock after acquiring all locks.
          const [term] = await tx.execute<{ valid: boolean }>(
            sql`select ${access.expiresAt === null ? sql`true` : sql`${access.expiresAt}::timestamptz > clock_timestamp()`} AS valid`,
          );
          if (term?.valid !== true) throw new NotFoundError("Library resource", command.productId);
          if (!member)
            await tx
              .insert(members)
              .values({ collectionId: current.id, productId: command.productId });
        } else if (command.action === "remove") {
          // Lost access does not prevent removal of the owner's private reference.
          await tx
            .delete(members)
            .where(
              and(eq(members.collectionId, current.id), eq(members.productId, command.productId)),
            );
        }
        const [updated] = await tx
          .update(collections)
          .set({
            name: command.action === "rename" ? command.name : current.name,
            status: command.action === "archive" ? "archived" : "active",
            revision: current.revision + 1,
            updatedAt: sql`greatest(clock_timestamp(),${collections.updatedAt})`,
          })
          .where(and(eq(collections.id, current.id), eq(collections.userId, input.userId)))
          .returning(fields);
        collection = updated;
      }
      const [record] = await tx
        .insert(receipts)
        .values({
          id: input.receiptId,
          userId: input.userId,
          requestId: command.requestId,
          collectionId: collection.id,
          commandDigest: digest,
          command,
          snapshot: {
            id: collection.id,
            name: collection.name,
            status: collection.status,
            revision: collection.revision,
          },
        })
        .returning(receiptFields);
      await tx.insert(auditEvents).values({
        id: input.auditId,
        actorId: input.userId,
        actorType: "user",
        action: `library.collection_${command.action}`,
        targetType: "library_collection",
        targetId: collection.id,
        details: {
          requestId: command.requestId,
          receiptId: record.id,
          revision: collection.revision,
          ...(command.action === "add" || command.action === "remove"
            ? { productId: command.productId }
            : "productIds" in command
              ? { productIds: command.productIds }
              : command.action === "duplicate"
                ? {
                    sourceCollectionId: command.sourceCollectionId,
                    sourceRevision: command.expectedRevision,
                    itemCount: command.expectedItemCount,
                    sourceDigest: command.sourceDigest,
                  }
                : {}),
        },
      });
      return { receipt: publicReceipt(record), replayed: false };
    });
  }
}
export const libraryCollectionsRepository = new LibraryCollectionsRepository();
