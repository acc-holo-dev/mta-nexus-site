import { AppError, NotFoundError, type Product } from "@nexus/domain";
import { eq, sql } from "drizzle-orm";
import { db } from "../client";
import { auditEvents, products } from "../schema";
import { assertProductMutationAuthority } from "./product-mutation-authority";

export class ResourceCompatibilityRepository {
  async update(input: {
    productId: string;
    actorId: string;
    auditId: string;
    expectedUpdatedAt: string;
    compatibility: Product["compatibility"];
  }) {
    return db.transaction(async (tx) => {
      const [product] = await tx
        .select()
        .from(products)
        .where(eq(products.id, input.productId))
        .limit(1)
        .for("no key update");
      if (product?.price !== 0) throw new NotFoundError("Resource", input.productId);
      const actor = await assertProductMutationAuthority(tx, product, input.actorId);
      if (new Date(product.updatedAt).toISOString() !== input.expectedUpdatedAt)
        throw new AppError("Resource changed; reload", 409, "PRODUCT_METADATA_CONFLICT");
      if (product.status === "suspended")
        throw new AppError("Resource is suspended", 409, "PRODUCT_STATE_CHANGED");
      if (input.compatibility.dependencies?.includes(product.slug.toLowerCase()))
        throw new AppError("A resource cannot depend on itself", 400, "RESOURCE_DEPENDENCY_SELF");
      const [updated] = await tx
        .update(products)
        .set({
          compatibility: input.compatibility,
          updatedAt: sql`greatest(date_trunc('milliseconds', clock_timestamp()),
          date_trunc('milliseconds', ${products.updatedAt}) + interval '1 millisecond')`,
        })
        .where(eq(products.id, product.id))
        .returning({
          id: products.id,
          updatedAt: products.updatedAt,
          compatibility: products.compatibility,
        });
      await tx
        .insert(auditEvents)
        .values({
          id: input.auditId,
          actorId: actor.id,
          actorType: actor.role === "admin" ? "admin" : "user",
          targetId: product.id,
          targetType: "product",
          action: "product.compatibility_updated",
          details: { previous: product.compatibility, compatibility: input.compatibility },
        });
      return updated;
    });
  }
}
export const resourceCompatibilityRepository = new ResourceCompatibilityRepository();
