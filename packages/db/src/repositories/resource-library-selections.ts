import { and, count, desc, eq, sql } from "drizzle-orm";
import {
  AppError,
  NotFoundError,
  type LibraryReleaseCommand,
  type LibraryReleaseFilter,
  type LibraryReleaseSelection,
} from "@nexus/domain";
import { db } from "../client";
import {
  auditEvents,
  builds,
  products,
  resourceLibrarySelections as selections,
  users,
} from "../schema";
import { effectiveUserDownloadSources } from "./user-library";
import { safePublishedBuildCondition } from "./build-safety";
import { lockUserDownloadAccess, type ResourceTransaction } from "./entitlements";
import { historyPageBounds } from "./history-pagination";

const fail = (code: string) =>
  new AppError("Library selection changed or is unavailable", 409, code);
const publicBuild = {
  id: builds.id,
  version: builds.version,
  releaseNotes: builds.releaseNotes,
  createdAt: builds.createdAt,
};
const selectionFields = {
  revision: selections.revision,
  mode: selections.mode,
  buildId: selections.buildId,
  updatedAt: selections.updatedAt,
};
const emptySelection: LibraryReleaseSelection = {
  revision: 0,
  mode: "latest",
  buildId: null,
  updatedAt: null,
};
async function owned(tx: ResourceTransaction, userId: string, productId: string) {
  const [product] = await tx
    .select({
      id: products.id,
      title: products.title,
      slug: products.slug,
      status: products.status,
    })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1)
    .for("share");
  if (!product) throw new NotFoundError("Resource", productId);
  const [user] = await tx
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
    .for("share");
  const access = user ? await lockUserDownloadAccess(tx, userId, productId) : null;
  if (!access || (access.expiresAt && access.expiresAt.getTime() <= Date.now()))
    throw new NotFoundError("Library resource", productId);
  return { product, access };
}
function currentAccess(expiresAt: Date | null, productId: string) {
  if (expiresAt && expiresAt.getTime() <= Date.now())
    throw new NotFoundError("Library resource", productId);
}
export class ResourceLibrarySelectionsRepository {
  async page(userId: string, requestedPage = 1, filter: LibraryReleaseFilter = "all") {
    return db.transaction(
      async (tx) => {
        const sources = sql`${effectiveUserDownloadSources(userId, new Date())}, release_rows AS (
        SELECT owned.resource_id AS "productId", owned.added_at AS "addedAt",
          coalesce(pref.revision, 0) AS revision, coalesce(pref.mode, 'latest') AS mode,
          CASE WHEN product.status = 'published' AND latest.id IS NOT NULL THEN product.title END AS title,
          CASE WHEN product.status = 'published' AND latest.id IS NOT NULL THEN product.slug END AS slug,
          CASE WHEN product.status = 'published' THEN latest.id END AS "latestBuildId",
          CASE WHEN product.status = 'published' THEN latest.version END AS "latestVersion",
          CASE WHEN product.status = 'published' THEN selected.id END AS "selectedBuildId",
          CASE WHEN product.status = 'published' THEN selected.version END AS "selectedVersion",
          CASE WHEN product.status <> 'published' OR product.id IS NULL OR latest.id IS NULL THEN 'unavailable'
            WHEN pref.mode = 'fixed' AND selected.id IS NULL THEN 'selection_unavailable'
            WHEN pref.mode = 'fixed' AND selected.id <> latest.id THEN 'update_available'
            WHEN pref.mode = 'fixed' THEN 'pinned' ELSE 'latest' END AS state,
          CASE WHEN product.status = 'published' THEN latest.created_at ELSE owned.added_at END AS sort_time
        FROM owned LEFT JOIN ${products} product ON product.id = owned.resource_id
        LEFT JOIN ${selections} pref ON pref.user_id = ${userId} AND pref.product_id = owned.resource_id
        LEFT JOIN LATERAL (
          SELECT ${builds.id} AS id, ${builds.version} AS version, ${builds.createdAt} AS created_at FROM ${builds}
          WHERE ${safePublishedBuildCondition(sql`product.id`)}
          ORDER BY ${builds.createdAt} DESC, ${builds.id} DESC LIMIT 1
        ) latest ON true
        LEFT JOIN LATERAL (
          SELECT ${builds.id} AS id, ${builds.version} AS version FROM ${builds}
          WHERE ${safePublishedBuildCondition(sql`product.id`)} AND ${builds.id} = pref.build_id LIMIT 1
        ) selected ON true
      )`;
        const totals = await tx.execute<{
          all: number;
          updates: number;
          pinned: number;
          unavailable: number;
        }>(sql`${sources}
        SELECT count(*)::integer AS "all", count(*) FILTER (WHERE state = 'update_available')::integer AS updates,
          count(*) FILTER (WHERE mode = 'fixed')::integer AS pinned,
          count(*) FILTER (WHERE state IN ('unavailable', 'selection_unavailable'))::integer AS unavailable FROM release_rows`);
        const row = totals[0],
          counts = {
            all: Number(row?.all ?? 0),
            updates: Number(row?.updates ?? 0),
            pinned: Number(row?.pinned ?? 0),
            unavailable: Number(row?.unavailable ?? 0),
          };
        const bounds = historyPageBounds(counts[filter], requestedPage);
        const condition =
          filter === "updates"
            ? sql`state = 'update_available'`
            : filter === "pinned"
              ? sql`mode = 'fixed'`
              : filter === "unavailable"
                ? sql`state IN ('unavailable', 'selection_unavailable')`
                : sql`true`;
        const rows = await tx.execute<{
          productId: string;
          addedAt: Date;
          revision: number;
          mode: "latest" | "fixed";
          title: string | null;
          slug: string | null;
          latestBuildId: string | null;
          latestVersion: string | null;
          selectedBuildId: string | null;
          selectedVersion: string | null;
          state: "latest" | "pinned" | "update_available" | "selection_unavailable" | "unavailable";
        }>(sql`${sources}
        SELECT "productId", "addedAt", revision, mode, title, slug, "latestBuildId", "latestVersion", "selectedBuildId", "selectedVersion", state
        FROM release_rows WHERE ${condition} ORDER BY sort_time DESC NULLS LAST, "productId" ASC LIMIT ${bounds.pageSize} OFFSET ${bounds.offset}`);
        return { items: rows, counts, filter, ...bounds };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
  async detail(userId: string, productId: string, requestedPage = 1) {
    return db.transaction(
      async (tx) => {
        const { product, access } = await owned(tx, userId, productId);
        const [selection] = await tx
          .select(selectionFields)
          .from(selections)
          .where(and(eq(selections.userId, userId), eq(selections.productId, productId)))
          .limit(1);
        const preference = selection ?? emptySelection;
        const available = product.status === "published";
        const [latest] = available
          ? await tx
              .select(publicBuild)
              .from(builds)
              .where(safePublishedBuildCondition(productId))
              .orderBy(desc(builds.createdAt), desc(builds.id))
              .limit(1)
          : [];
        const [selected] =
          available && preference.mode === "fixed" && preference.buildId
            ? await tx
                .select(publicBuild)
                .from(builds)
                .where(
                  and(safePublishedBuildCondition(productId), eq(builds.id, preference.buildId)),
                )
                .limit(1)
            : [];
        const [total] = latest
          ? await tx
              .select({ total: count() })
              .from(builds)
              .where(safePublishedBuildCondition(productId))
          : [];
        const bounds = historyPageBounds(total?.total ?? 0, requestedPage);
        const versions = latest
          ? await tx
              .select(publicBuild)
              .from(builds)
              .where(safePublishedBuildCondition(productId))
              .orderBy(desc(builds.createdAt), desc(builds.id))
              .limit(bounds.pageSize)
              .offset(bounds.offset)
          : [];
        currentAccess(access.expiresAt, productId);
        return {
          product: {
            id: product.id,
            title: latest ? product.title : null,
            slug: latest ? product.slug : null,
          },
          selection: preference,
          latest: latest ?? null,
          selected: selected ?? null,
          versions,
          ...bounds,
        };
      },
      { isolationLevel: "repeatable read" },
    );
  }
  async command(input: {
    userId: string;
    productId: string;
    command: LibraryReleaseCommand;
    auditId: string;
  }) {
    return db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`library-selection:${input.userId}:${input.productId}`}))`,
      );
      const { product, access } = await owned(tx, input.userId, input.productId),
        command = input.command;
      const [existing] = await tx
        .select(selectionFields)
        .from(selections)
        .where(and(eq(selections.userId, input.userId), eq(selections.productId, input.productId)))
        .limit(1)
        .for("update");
      const previous = existing ?? emptySelection;
      const buildId = command.mode === "fixed" ? command.buildId : null;
      if (command.mode === "fixed") {
        if (product.status !== "published") throw fail("LIBRARY_RELEASE_UNAVAILABLE");
        const [build] = await tx
          .select({ id: builds.id })
          .from(builds)
          .where(and(safePublishedBuildCondition(product.id), eq(builds.id, command.buildId)))
          .limit(1)
          .for("share");
        if (!build) throw fail("LIBRARY_RELEASE_UNAVAILABLE");
      }
      const same = previous.mode === command.mode && previous.buildId === buildId;
      if (
        previous.revision !== command.expectedRevision &&
        !(same && previous.revision === command.expectedRevision + 1)
      )
        throw fail("LIBRARY_RELEASE_CONFLICT");
      currentAccess(access.expiresAt, product.id);
      if (same) return { productId: product.id, selection: previous };
      const revision = previous.revision + 1,
        updatedAt = new Date(Math.max(Date.now(), (previous.updatedAt?.getTime() ?? 0) + 1));
      const [selection] = await tx
        .insert(selections)
        .values({
          userId: input.userId,
          productId: product.id,
          mode: command.mode,
          buildId,
          revision,
          updatedAt,
        })
        .onConflictDoUpdate({
          target: [selections.userId, selections.productId],
          set: { mode: command.mode, buildId, revision, updatedAt },
        })
        .returning(selectionFields);
      if (!selection) throw fail("LIBRARY_RELEASE_CONFLICT");
      await tx.insert(auditEvents).values({
        id: input.auditId,
        actorId: input.userId,
        actorType: "user",
        action: "library.release_selected",
        targetType: "product",
        targetId: product.id,
        details: { mode: command.mode, buildId, revision },
      });
      return { productId: product.id, selection };
    });
  }
}
export const resourceLibrarySelectionsRepository = new ResourceLibrarySelectionsRepository();
