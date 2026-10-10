import {
  AppError,
  type ManagedResourceVariants,
  NotFoundError,
  type PublicResourceVariants,
  RESOURCE_VARIANT_LIMIT,
  type ResourceVariantCommand,
  sameResourcePublisher,
  type User,
} from "@nexus/domain";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { type AnyPgColumn, alias } from "drizzle-orm/pg-core";
import { db } from "../client";
import {
  auditEvents,
  builds,
  products,
  productVariantGroups,
  productVariantMembers,
} from "../schema";
import { assertProductMutationAuthority } from "./product-mutation-authority";
import { managedProductCondition } from "./products";

const anchor = alias(products, "variant_anchor");
function publicResource(table: { id: AnyPgColumn; status: AnyPgColumn; price: AnyPgColumn }) {
  return and(
    eq(table.status, "published"),
    eq(table.price, 0),
    sql`exists (
    select 1 from ${builds} where ${builds.productId} = ${table.id}
      and ${builds.status} = 'published' and ${builds.scanStatus} = 'clean'
      and ${builds.scanner} is not null and btrim(${builds.scanner}) <> ''
      and ${builds.scannedAt} is not null
  )`,
  );
}
const samePublisher = sql`(
  (${anchor.organizationId} is not null and ${products.organizationId} = ${anchor.organizationId})
  or (${anchor.organizationId} is null and ${products.organizationId} is null
    and ${products.authorId} = ${anchor.authorId})
)`;
const variantProjection = {
  productId: products.id,
  label: productVariantMembers.label,
  title: products.title,
  slug: products.slug,
  currentVersion: products.currentVersion,
};
const conflict = () =>
  new AppError("Variant group changed; reload", 409, "RESOURCE_VARIANTS_CONFLICT");

export class ResourceVariantsRepository {
  async publicVariants(productId: string): Promise<PublicResourceVariants | null> {
    return db.transaction(
      async (tx) => {
        // Even the starting membership is discovered only from a live public resource.
        const [group] = await tx
          .select({ id: productVariantGroups.id, title: productVariantGroups.title })
          .from(productVariantMembers)
          .innerJoin(products, eq(products.id, productVariantMembers.productId))
          .innerJoin(
            productVariantGroups,
            eq(productVariantGroups.id, productVariantMembers.groupId),
          )
          .innerJoin(anchor, eq(anchor.id, productVariantGroups.anchorProductId))
          .where(
            and(
              eq(products.id, productId),
              publicResource(products),
              publicResource(anchor),
              samePublisher,
            ),
          )
          .limit(1);
        if (!group) return null;
        const variants = await tx
          .select(variantProjection)
          .from(productVariantMembers)
          .innerJoin(products, eq(products.id, productVariantMembers.productId))
          .innerJoin(
            productVariantGroups,
            eq(productVariantGroups.id, productVariantMembers.groupId),
          )
          .innerJoin(anchor, eq(anchor.id, productVariantGroups.anchorProductId))
          .where(
            and(
              eq(productVariantMembers.groupId, group.id),
              publicResource(products),
              samePublisher,
            ),
          )
          .orderBy(asc(productVariantMembers.position), asc(products.id))
          .limit(RESOURCE_VARIANT_LIMIT);
        return { title: group.title, variants };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }

  async managed(
    productId: string,
    actor: Pick<User, "id" | "role">,
  ): Promise<ManagedResourceVariants> {
    return db.transaction(
      async (tx) => {
        const [product] = await tx
          .select({
            id: products.id,
            authorId: products.authorId,
            organizationId: products.organizationId,
          })
          .from(products)
          .where(
            and(eq(products.id, productId), eq(products.price, 0), managedProductCondition(actor)),
          )
          .limit(1);
        if (!product) throw new NotFoundError("Resource", productId);
        const [group] = await tx
          .select({
            id: productVariantGroups.id,
            anchorProductId: productVariantGroups.anchorProductId,
            title: productVariantGroups.title,
            revision: productVariantGroups.revision,
          })
          .from(productVariantMembers)
          .innerJoin(
            productVariantGroups,
            eq(productVariantGroups.id, productVariantMembers.groupId),
          )
          .where(eq(productVariantMembers.productId, productId))
          .limit(1);
        if (!group) return { anchorProductId: productId, group: null };
        const [owner] = await tx
          .select({ authorId: products.authorId, organizationId: products.organizationId })
          .from(products)
          .where(
            and(
              eq(products.id, group.anchorProductId),
              eq(products.price, 0),
              managedProductCondition(actor),
            ),
          )
          .limit(1);
        if (!owner || !sameResourcePublisher(product, owner))
          throw new NotFoundError("Variant group", productId);
        const variants = await tx
          .select({ ...variantProjection, status: products.status })
          .from(productVariantMembers)
          .innerJoin(products, eq(products.id, productVariantMembers.productId))
          .innerJoin(
            productVariantGroups,
            eq(productVariantGroups.id, productVariantMembers.groupId),
          )
          .innerJoin(anchor, eq(anchor.id, productVariantGroups.anchorProductId))
          .where(
            and(
              eq(productVariantMembers.groupId, group.id),
              samePublisher,
              eq(products.price, 0),
              managedProductCondition(actor),
            ),
          )
          .orderBy(asc(productVariantMembers.position), asc(products.id))
          .limit(RESOURCE_VARIANT_LIMIT);
        return {
          anchorProductId: group.anchorProductId,
          group: {
            id: group.id,
            title: group.title,
            revision: group.revision,
            variants: variants as NonNullable<ManagedResourceVariants["group"]>["variants"],
          },
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }

  async candidates(productId: string, actor: Pick<User, "id" | "role">, requestedPage = 1) {
    const page =
      Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 1000) : 1;
    const [owner] = await db
      .select({ authorId: products.authorId, organizationId: products.organizationId })
      .from(products)
      .where(and(eq(products.id, productId), eq(products.price, 0), managedProductCondition(actor)))
      .limit(1);
    if (!owner) throw new NotFoundError("Resource", productId);
    const [group] = await db
      .select({ id: productVariantGroups.id })
      .from(productVariantGroups)
      .where(eq(productVariantGroups.anchorProductId, productId))
      .limit(1);
    const rows = await db
      .select({
        productId: products.id,
        title: products.title,
        slug: products.slug,
        status: products.status,
      })
      .from(products)
      .where(
        and(
          eq(products.price, 0),
          managedProductCondition(actor),
          owner.organizationId !== null
            ? eq(products.organizationId, owner.organizationId)
            : and(sql`${products.organizationId} is null`, eq(products.authorId, owner.authorId)),
          sql`not exists (select 1 from ${productVariantMembers} where ${productVariantMembers.productId} = ${products.id}
          and ${productVariantMembers.groupId} <> ${group?.id ?? ""})`,
        ),
      )
      .orderBy(asc(products.title), asc(products.id))
      .limit(25)
      .offset((page - 1) * 24);
    return { candidates: rows.slice(0, 24), page, hasMore: rows.length > 24 };
  }

  async command(input: {
    productId: string;
    actorId: string;
    groupId: string;
    auditId: string;
    command: ResourceVariantCommand;
  }) {
    const command = input.command;
    if (
      command.action === "save" &&
      !command.variants.some((row) => row.productId === input.productId)
    )
      throw new AppError("Include the anchor resource", 400, "RESOURCE_VARIANTS_ANCHOR_MISSING");
    try {
      return await db.transaction(async (tx) => {
        const [initial] = await tx
          .select({ id: productVariantGroups.id, revision: productVariantGroups.revision })
          .from(productVariantGroups)
          .where(eq(productVariantGroups.anchorProductId, input.productId))
          .limit(1);
        const oldMembers = initial
          ? await tx
              .select({ productId: productVariantMembers.productId })
              .from(productVariantMembers)
              .where(eq(productVariantMembers.groupId, initial.id))
              .limit(RESOURCE_VARIANT_LIMIT)
          : [];
        const ids = [
          ...new Set([
            input.productId,
            ...oldMembers.map((row) => row.productId),
            ...(command.action === "save" ? command.variants.map((row) => row.productId) : []),
          ]),
        ].sort();
        // All affected products, then authority, then group: concurrent regrouping
        // has one lock order and cannot move a product through a stale snapshot.
        const locked = await tx
          .select({
            id: products.id,
            authorId: products.authorId,
            organizationId: products.organizationId,
            price: products.price,
          })
          .from(products)
          .where(inArray(products.id, ids))
          .orderBy(asc(products.id))
          .for("no key update");
        const parent = locked.find((row) => row.id === input.productId);
        if (parent?.price !== 0) throw new NotFoundError("Resource", input.productId);
        const actor = await assertProductMutationAuthority(tx, parent, input.actorId);
        const [group] = await tx
          .select()
          .from(productVariantGroups)
          .where(eq(productVariantGroups.anchorProductId, input.productId))
          .limit(1)
          .for("update");
        if (
          (group?.id ?? null) !== command.expectedGroupId ||
          (group?.revision ?? 0) !== command.expectedRevision ||
          (initial?.id ?? null) !== (group?.id ?? null) ||
          (initial?.revision ?? 0) !== (group?.revision ?? 0)
        )
          throw conflict();
        const [anchorMembership] = await tx
          .select({ groupId: productVariantMembers.groupId })
          .from(productVariantMembers)
          .where(eq(productVariantMembers.productId, input.productId))
          .limit(1);
        if (anchorMembership && anchorMembership.groupId !== group?.id) throw conflict();
        if (command.action === "remove") {
          if (!group) throw conflict();
          await tx.delete(productVariantGroups).where(eq(productVariantGroups.id, group.id));
        } else {
          for (const row of command.variants) {
            const target = locked.find((product) => product.id === row.productId);
            if (target?.price !== 0 || !sameResourcePublisher(parent, target))
              throw new NotFoundError("Resource", row.productId);
          }
          const [occupied] = await tx
            .select({ productId: productVariantMembers.productId })
            .from(productVariantMembers)
            .where(
              and(
                inArray(
                  productVariantMembers.productId,
                  command.variants.map((row) => row.productId),
                ),
                ne(productVariantMembers.groupId, group?.id ?? ""),
              ),
            )
            .limit(1);
          if (occupied) throw conflict();
          const groupId = group?.id ?? input.groupId;
          if (group) {
            await tx
              .update(productVariantGroups)
              .set({ title: command.title, revision: group.revision + 1, updatedAt: new Date() })
              .where(eq(productVariantGroups.id, group.id));
            await tx
              .delete(productVariantMembers)
              .where(eq(productVariantMembers.groupId, group.id));
          } else {
            await tx
              .insert(productVariantGroups)
              .values({ id: groupId, anchorProductId: parent.id, title: command.title });
          }
          await tx
            .insert(productVariantMembers)
            .values(command.variants.map((row, position) => ({ ...row, groupId, position })));
        }
        await tx.insert(auditEvents).values({
          id: input.auditId,
          actorId: actor.id,
          actorType: actor.role === "admin" ? "admin" : "user",
          targetId: parent.id,
          targetType: "product",
          action: command.action === "save" ? "product.variants_saved" : "product.variants_removed",
          details: {
            groupId: group?.id ?? input.groupId,
            reason: command.reason,
            ...(command.action === "save"
              ? { title: command.title, variants: command.variants }
              : {}),
          },
        });
        return {
          productId: parent.id,
          groupId: command.action === "remove" ? null : (group?.id ?? input.groupId),
          revision: command.action === "remove" ? 0 : (group?.revision ?? 0) + 1,
        };
      });
    } catch (error) {
      // Unique membership/label constraints remain the last line of defense.
      const failure = error as { code?: unknown; cause?: { code?: unknown } };
      if (failure?.code === "23505" || failure?.cause?.code === "23505") throw conflict();
      throw error;
    }
  }
}
export const resourceVariantsRepository = new ResourceVariantsRepository();
