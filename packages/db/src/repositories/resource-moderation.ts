import { and, asc, count, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import {
  AppError,
  NotFoundError,
  resourceModerationTarget,
  type ProductStatus,
  type ResourceModerationCommand,
} from "@nexus/domain";
import { db } from "../client";
import { auditEvents, builds, products } from "../schema";
import {
  assertBuildModerationAuthority,
  assertProductMutationAuthority,
} from "./product-mutation-authority";
import { lockInitiatingSession } from "./initiating-session";
import { containsPattern } from "./search-pattern";
import { historyPageBounds } from "./history-pagination";
import type { ResourceTransaction } from "./entitlements";
const selection = {
  id: products.id,
  title: products.title,
  slug: products.slug,
  status: products.status,
  currentVersion: products.currentVersion,
  updatedAt: products.updatedAt,
};
const actions = [
  "product.moderation_suspended",
  "product.moderation_released",
  "admin.suspend",
  "admin.restore",
];
async function history(tx: ResourceTransaction, productId: string, page = 1, staff = false) {
  const condition = and(
    eq(auditEvents.targetType, "product"),
    eq(auditEvents.targetId, productId),
    inArray(auditEvents.action, actions),
  );
  const [total] = await tx.select({ total: count() }).from(auditEvents).where(condition);
  const bounds = historyPageBounds(total?.total ?? 0, page);
  const events = await tx
    .select({
      id: auditEvents.id,
      action: auditEvents.action,
      reason: staff
        ? sql<string>`coalesce(${auditEvents.details}->>'reason', ${auditEvents.details}->>'notes', '')`
        : sql<string>`case when ${auditEvents.action} in ('product.moderation_suspended', 'product.moderation_released') then coalesce(${auditEvents.details}->>'reason', '') else '' end`,
      createdAt: auditEvents.createdAt,
    })
    .from(auditEvents)
    .where(condition)
    .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
    .limit(bounds.pageSize)
    .offset(bounds.offset);
  return { events, ...bounds };
}
export class ResourceModerationRepository {
  async page(actorId: string, page = 1, status?: ProductStatus, query = "") {
    return db.transaction(async (tx) => {
      await assertBuildModerationAuthority(tx, actorId);
      const condition = and(
        status ? eq(products.status, status) : undefined,
        query ? ilike(products.title, containsPattern(query)) : undefined,
      );
      const [total] = await tx.select({ total: count() }).from(products).where(condition);
      const bounds = historyPageBounds(total?.total ?? 0, page);
      const resources = await tx
        .select(selection)
        .from(products)
        .where(condition)
        .orderBy(desc(products.updatedAt), desc(products.id))
        .limit(bounds.pageSize)
        .offset(bounds.offset);
      return { resources, ...bounds };
    });
  }
  async detail(actorId: string, productId: string, page = 1) {
    return db.transaction(
      async (tx) => {
        const [product] = await tx
          .select(selection)
          .from(products)
          .where(eq(products.id, productId))
          .limit(1)
          .for("share");
        await assertBuildModerationAuthority(tx, actorId);
        if (!product) throw new NotFoundError("Resource", productId);
        return { product, ...(await history(tx, productId, page, true)) };
      },
      { isolationLevel: "repeatable read" },
    );
  }
  async publisherHistory(actorId: string, productId: string, page = 1) {
    return db.transaction(
      async (tx) => {
        const [product] = await tx
          .select({
            id: products.id,
            authorId: products.authorId,
            organizationId: products.organizationId,
          })
          .from(products)
          .where(eq(products.id, productId))
          .limit(1)
          .for("share");
        if (!product) throw new NotFoundError("Resource", productId);
        await assertProductMutationAuthority(tx, product, actorId);
        return history(tx, productId, page);
      },
      { isolationLevel: "repeatable read" },
    );
  }
  async command(input: {
    actorId: string;
    productId: string;
    command: ResourceModerationCommand;
    auditId: string;
    currentToken: string;
  }) {
    return db.transaction(async (tx) => {
      const [product] = await tx
        .select(selection)
        .from(products)
        .where(eq(products.id, input.productId))
        .limit(1)
        .for("no key update");
      await assertBuildModerationAuthority(tx, input.actorId);
      await lockInitiatingSession(tx, input.actorId, input.currentToken);
      if (!product) throw new NotFoundError("Resource", input.productId);
      const command = input.command,
        target = resourceModerationTarget(product.status as ProductStatus, command.action);
      if (product.updatedAt.toISOString() !== command.expectedUpdatedAt)
        throw new AppError("Resource changed", 409, "PRODUCT_METADATA_CONFLICT");
      if (!target) throw new AppError("Resource state changed", 409, "PRODUCT_STATE_CHANGED");
      if (command.reason.trim().length < 5 || command.reason.length > 2000)
        throw new AppError("A moderation reason is required", 400, "RESOURCE_MODERATION_INVALID");
      if (command.action === "release") {
        await tx
          .select({ id: builds.id })
          .from(builds)
          .where(eq(builds.productId, product.id))
          .orderBy(asc(builds.id))
          .for("update");
        await tx
          .update(builds)
          .set({ status: "draft" })
          .where(
            and(
              eq(builds.productId, product.id),
              inArray(builds.status, ["published", "pending_review"]),
            ),
          );
      }
      const [updated] = await tx
        .update(products)
        .set({
          status: target,
          isFeatured: false,
          updatedAt: sql`greatest(date_trunc('milliseconds', clock_timestamp()), date_trunc('milliseconds', ${products.updatedAt}) + interval '1 millisecond')`,
        })
        .where(eq(products.id, product.id))
        .returning(selection);
      if (!updated) throw new AppError("Resource changed", 409, "PRODUCT_METADATA_CONFLICT");
      await tx.insert(auditEvents).values({
        id: input.auditId,
        actorId: input.actorId,
        actorType: "admin",
        action:
          command.action === "suspend"
            ? "product.moderation_suspended"
            : "product.moderation_released",
        targetType: "product",
        targetId: product.id,
        details: {
          reason: command.reason.trim(),
          previousStatus: product.status,
          status: target,
        },
      });
      return { product: updated };
    });
  }
}
export const resourceModerationRepository = new ResourceModerationRepository();
