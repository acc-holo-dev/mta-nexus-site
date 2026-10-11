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
import { readLibraryReleasePage } from "./library-release-page";
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
        return readLibraryReleasePage(tx, userId, requestedPage, filter);
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
