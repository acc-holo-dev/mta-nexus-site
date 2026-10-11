import {
  AppError,
  type ManagedResourceMedia,
  NotFoundError,
  RESOURCE_MEDIA_LIMIT,
  resourceMediaUrl,
} from "@nexus/domain";
import type { ResourceMediaCommand } from "@nexus/validation";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "../client";
import { auditEvents, products, resourceMedia, users } from "../schema";
import { safePublishedBuildCondition } from "./build-safety";
import type { ResourceTransaction } from "./entitlements";
import {
  assertBuildModerationAuthority,
  assertProductMutationAuthority,
} from "./product-mutation-authority";

const selection = {
  id: resourceMedia.id,
  caption: resourceMedia.caption,
  position: resourceMedia.position,
  width: resourceMedia.width,
  height: resourceMedia.height,
};
const publicCondition = () =>
  and(
    eq(products.status, "published"),
    eq(products.price, 0),
    sql`exists (select 1 from builds where ${safePublishedBuildCondition(sql`${products.id}`)})`,
  );
const conflict = () => new AppError("Gallery changed; reload", 409, "RESOURCE_MEDIA_CONFLICT");
async function lockProduct(
  tx: ResourceTransaction,
  productId: string,
  actorId: string,
  staff = false,
) {
  const [product] = await tx
    .select({
      id: products.id,
      title: products.title,
      status: products.status,
      price: products.price,
      authorId: products.authorId,
      organizationId: products.organizationId,
      updatedAt: products.updatedAt,
    })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1)
    .for("no key update");
  if (product?.price !== 0) throw new NotFoundError("Resource", productId);
  const authority = staff
    ? await assertBuildModerationAuthority(tx, actorId)
    : await assertProductMutationAuthority(tx, product, actorId);
  return {
    ...product,
    actorType: authority.role === "admin" ? ("admin" as const) : ("user" as const),
  };
}
async function view(tx: ResourceTransaction, productId: string): Promise<ManagedResourceMedia> {
  const [product] = await tx
    .select({
      id: products.id,
      title: products.title,
      status: products.status,
      updatedAt: products.updatedAt,
    })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (!product) throw new NotFoundError("Resource", productId);
  const items = await tx
    .select(selection)
    .from(resourceMedia)
    .where(eq(resourceMedia.productId, productId))
    .orderBy(asc(resourceMedia.position), asc(resourceMedia.id))
    .limit(RESOURCE_MEDIA_LIMIT);
  return {
    product: { ...product, updatedAt: product.updatedAt.toISOString() },
    items: items.map((row) => ({ ...row, url: resourceMediaUrl(row.id) })),
  };
}
function assertEditable(product: { status: string; updatedAt: Date }, expectedUpdatedAt: string) {
  if (product.status === "archived" || product.status === "suspended")
    throw new AppError("Withdrawn gallery is read-only", 409, "PRODUCT_STATE_CHANGED");
  if (product.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) throw conflict();
}
export class ResourceMediaRepository {
  async managed(productId: string, actorId: string, staff = false) {
    return db.transaction(
      async (tx) => {
        await lockProduct(tx, productId, actorId, staff);
        return view(tx, productId);
      },
      { isolationLevel: "repeatable read" },
    );
  }
  async publicItems(productId: string) {
    return db
      .select(selection)
      .from(resourceMedia)
      .innerJoin(products, eq(products.id, resourceMedia.productId))
      .where(and(eq(products.id, productId), publicCondition()))
      .orderBy(asc(resourceMedia.position), asc(resourceMedia.id))
      .limit(RESOURCE_MEDIA_LIMIT)
      .then((items) => items.map((item) => ({ ...item, url: resourceMediaUrl(item.id) })));
  }
  async authorizeImage(mediaId: string, actorId?: string) {
    return db.transaction(async (tx) => {
      const [image] = await tx
        .select({
          ...selection,
          productId: resourceMedia.productId,
          storageKey: resourceMedia.storageKey,
          sha256Hash: resourceMedia.sha256Hash,
          fileSizeBytes: resourceMedia.fileSizeBytes,
        })
        .from(resourceMedia)
        .where(eq(resourceMedia.id, mediaId))
        .limit(1);
      if (!image) throw new NotFoundError("Image", mediaId);
      const [visible] = await tx
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.id, image.productId), publicCondition()))
        .limit(1);
      if (!visible) {
        if (!actorId) throw new NotFoundError("Image", mediaId);
        // Load the live role rather than trusting a cookie's historical role.
        const [actor] = await tx
          .select({ role: users.role })
          .from(users)
          .where(eq(users.id, actorId))
          .limit(1);
        await lockProduct(tx, image.productId, actorId, actor?.role === "moderator");
      }
      const [held] = await tx
        .select({ id: resourceMedia.id })
        .from(resourceMedia)
        .where(and(eq(resourceMedia.id, mediaId), eq(resourceMedia.productId, image.productId)))
        .limit(1)
        .for("share");
      if (!held) throw new NotFoundError("Image", mediaId);
      return image;
    });
  }
  async add(input: {
    productId: string;
    actorId: string;
    expectedUpdatedAt: string;
    auditId: string;
    image: typeof resourceMedia.$inferInsert;
  }) {
    return db.transaction(async (tx) => {
      const parent = await lockProduct(tx, input.productId, input.actorId);
      assertEditable(parent, input.expectedUpdatedAt);
      const items = await tx
        .select({
          id: resourceMedia.id,
          sha256Hash: resourceMedia.sha256Hash,
          position: resourceMedia.position,
        })
        .from(resourceMedia)
        .where(eq(resourceMedia.productId, parent.id))
        .orderBy(asc(resourceMedia.position))
        .limit(RESOURCE_MEDIA_LIMIT)
        .for("update");
      if (items.length >= RESOURCE_MEDIA_LIMIT)
        throw new AppError("Gallery limit reached", 422, "RESOURCE_MEDIA_LIMIT");
      if (items.some((row) => row.sha256Hash === input.image.sha256Hash))
        throw new AppError("Image is already in the gallery", 409, "RESOURCE_MEDIA_DUPLICATE");
      await tx
        .insert(resourceMedia)
        .values({ ...input.image, productId: parent.id, position: items.length });
      await tx.insert(auditEvents).values({
        id: input.auditId,
        actorId: input.actorId,
        actorType: parent.actorType,
        action: "product.media.add",
        targetType: "product",
        targetId: parent.id,
        details: {
          status: "draft",
          metadataReviewRequired: true,
          mediaId: input.image.id,
          sha256Hash: input.image.sha256Hash,
          width: input.image.width,
          height: input.image.height,
        },
      });
      return view(tx, parent.id);
    });
  }
  async command(input: {
    productId: string;
    actorId: string;
    auditId: string;
    command: ResourceMediaCommand;
  }) {
    return db.transaction(async (tx) => {
      const parent = await lockProduct(tx, input.productId, input.actorId);
      assertEditable(parent, input.command.expectedUpdatedAt);
      const rows = await tx
        .select({
          id: resourceMedia.id,
          caption: resourceMedia.caption,
          position: resourceMedia.position,
        })
        .from(resourceMedia)
        .where(eq(resourceMedia.productId, parent.id))
        .orderBy(asc(resourceMedia.position), asc(resourceMedia.id))
        .limit(RESOURCE_MEDIA_LIMIT)
        .for("update");
      const command = input.command;
      if (command.action === "remove") {
        if (!rows.some((row) => row.id === command.mediaId))
          throw new NotFoundError("Image", command.mediaId);
        await tx
          .delete(resourceMedia)
          .where(
            and(eq(resourceMedia.id, command.mediaId), eq(resourceMedia.productId, parent.id)),
          );
        rows.splice(
          rows.findIndex((row) => row.id === command.mediaId),
          1,
        );
      } else if (
        command.items.length !== rows.length ||
        command.items.some((item) => !rows.some((row) => row.id === item.id)) ||
        new Set(command.items.map((item) => item.id)).size !== rows.length
      )
        throw conflict();
      const ordered = command.action === "save" ? command.items : rows;
      let changed = command.action === "remove";
      for (const [position, item] of ordered.entries()) {
        const before = rows.find((row) => row.id === item.id);
        if (before?.caption === item.caption && before.position === position) continue;
        changed = true;
        await tx
          .update(resourceMedia)
          .set({ position, caption: item.caption })
          .where(and(eq(resourceMedia.id, item.id), eq(resourceMedia.productId, parent.id)));
      }
      if (changed)
        await tx.insert(auditEvents).values({
          id: input.auditId,
          actorId: input.actorId,
          actorType: parent.actorType,
          action: `product.media.${command.action}`,
          targetType: "product",
          targetId: parent.id,
          details: {
            status: "draft",
            metadataReviewRequired: true,
            mediaId: command.action === "remove" ? command.mediaId : undefined,
            orderedMediaIds: ordered.map((item) => item.id),
          },
        });
      return view(tx, parent.id);
    });
  }
}
export const resourceMediaRepository = new ResourceMediaRepository();
