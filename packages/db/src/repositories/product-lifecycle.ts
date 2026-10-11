import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import {
  AppError,
  NotFoundError,
  canTransitionResource,
  type Product,
  type ResourceLifecycleAction,
  type User,
} from "@nexus/domain";
import { db } from "../client";
import { auditEvents, builds, products } from "../schema";
import { trustedCleanScanCondition } from "./build-safety";
import { assertProductMutationAuthority } from "./product-mutation-authority";
import { managedProductCondition } from "./products";

/** Audited commands, never a generic caller-controlled publication status. */
export class ProductLifecycleRepository {
  async transition(input: {
    productId: string;
    actorId: string;
    action: ResourceLifecycleAction;
    expectedUpdatedAt: Date;
    reason: string;
    auditId: string;
  }): Promise<Product> {
    return db.transaction(async (tx) => {
      const [product] = await tx
        .select()
        .from(products)
        .where(eq(products.id, input.productId))
        .limit(1)
        .for("no key update");
      if (product?.price !== 0) throw new NotFoundError("Resource", input.productId);
      const actor = await assertProductMutationAuthority(tx, product, input.actorId);
      if (new Date(product.updatedAt).getTime() !== input.expectedUpdatedAt.getTime()) {
        throw new AppError(
          "Resource changed; reload before continuing",
          409,
          "PRODUCT_METADATA_CONFLICT",
        );
      }
      if (!canTransitionResource(product.status as Product["status"], input.action)) {
        throw new AppError(
          "Resource state does not allow this action",
          409,
          "PRODUCT_STATE_CHANGED",
        );
      }
      let target: Product["status"] = "archived";
      let submittedBuildId: string | undefined;
      if (input.action === "restore") {
        // Every formerly public/pending version must pass review again. Keep
        // retired/rejected/quarantined history and every file/grant intact.
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
        target = "draft";
      } else if (input.action === "submit") {
        const [candidate] = await tx
          .select({ id: builds.id })
          .from(builds)
          .where(
            and(
              eq(builds.productId, product.id),
              inArray(builds.status, ["draft", "published"]),
              trustedCleanScanCondition(),
            ),
          )
          .orderBy(sql`case when ${builds.status} = 'draft' then 0 else 1 end`, desc(builds.createdAt), desc(builds.id))
          .limit(1)
          .for("update");
        if (!candidate)
          throw new AppError(
            "A clean draft or retained published version is required before submission",
            422,
            "RESOURCE_REVIEW_BUILD_REQUIRED",
          );
        await tx
          .update(builds)
          .set({ status: "pending_review" })
          .where(eq(builds.id, candidate.id));
        submittedBuildId = candidate.id;
        target = "pending_review";
      }
      const [updated] = await tx
        .update(products)
        .set({
          status: target,
          isFeatured: false,
          updatedAt: sql`greatest(date_trunc('milliseconds', clock_timestamp()),
          date_trunc('milliseconds', ${products.updatedAt}) + interval '1 millisecond')`,
        })
        .where(eq(products.id, product.id))
        .returning();
      await tx
        .insert(auditEvents)
        .values({
          id: input.auditId,
          actorId: actor.id,
          actorType: actor.role === "admin" ? "admin" : "user",
          action: `product.${input.action}`,
          targetType: "product",
          targetId: product.id,
          details: {
            previousStatus: product.status,
            status: target,
            reason: input.reason,
            submittedBuildId,
          },
        });
      return updated as unknown as Product;
    });
  }

  async history(productId: string, actor: Pick<User, "id" | "role">) {
    return db
      .select({
        id: auditEvents.id,
        action: auditEvents.action,
        details: auditEvents.details,
        createdAt: auditEvents.createdAt,
      })
      .from(auditEvents)
      .innerJoin(products, eq(products.id, auditEvents.targetId))
      .where(
        and(
          managedProductCondition(actor),
          eq(auditEvents.targetType, "product"),
          eq(auditEvents.targetId, productId),
          inArray(auditEvents.action, ["product.archive", "product.restore", "product.submit"]),
        ),
      )
      .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
      .limit(20);
  }
}

export const productLifecycleRepository = new ProductLifecycleRepository();
