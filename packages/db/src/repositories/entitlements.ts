import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { db } from "../client";
import { builds, entitlements, licenses, products } from "../schema";
import { safePublishedBuildCondition } from "./build-safety";
import { NotFoundError, ValidationError } from "@nexus/domain";
import type { Entitlement } from "@nexus/domain";

export class EntitlementRepository {
  async hasEntitlement(
    subject: { type: "user" | "server" | "organization"; id: string },
    resourceId: string,
    permission: string
  ): Promise<boolean> {
    const rows = await db
      .select({ id: entitlements.id })
      .from(entitlements)
      .where(
        and(
          eq(entitlements.subjectType, subject.type),
          eq(entitlements.subjectId, subject.id),
          eq(entitlements.resourceId, resourceId),
          eq(entitlements.permission, permission),
          or(isNull(entitlements.expiresAt), gt(entitlements.expiresAt, new Date()))
        )
      )
      .limit(1);

    if (rows.length > 0) return true;

    if (subject.type === "user") {
      const userLicenses = await db
        .select({ entitlements: licenses.entitlements })
        .from(licenses)
        .where(
          and(
            eq(licenses.userId, subject.id),
            eq(licenses.productId, resourceId),
            eq(licenses.status, "active"),
            or(isNull(licenses.expiresAt), gt(licenses.expiresAt, new Date()))
          )
        )
        .limit(1);

      if (userLicenses.length > 0) {
        const license = userLicenses[0];
        return (
          license.entitlements.includes(permission) ||
          permission === "product.download" ||
          permission === "product.update"
        );
      }
    }

    return false;
  }

  async listBySubject(subject: {
    type: "user" | "server" | "organization";
    id: string;
  }): Promise<Entitlement[]> {
    const rows = await db
      .select()
      .from(entitlements)
      .where(
        and(
          eq(entitlements.subjectType, subject.type),
          eq(entitlements.subjectId, subject.id),
          or(isNull(entitlements.expiresAt), gt(entitlements.expiresAt, new Date()))
        )
      );
    return rows as unknown as Entitlement[];
  }

  async create(data: Omit<Entitlement, "createdAt">): Promise<Entitlement> {
    const values = {
      ...data,
      createdAt: new Date(),
    };

    const rows = await db.insert(entitlements).values(values).returning();
    return rows[0] as unknown as Entitlement;
  }

  async claimFreeResource(input: {
    entitlementId: string;
    userId: string;
    productId: string;
  }): Promise<{ entitlement: Entitlement; alreadyClaimed: boolean }> {
    return db.transaction(async (tx) => {
      const lockKey = `free-resource:${input.userId}:${input.productId}`;
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lockKey}))`);

      const productRows = await tx
        .select({ status: products.status, price: products.price })
        .from(products)
        .where(eq(products.id, input.productId))
        .limit(1);
      const product = productRows[0];

      if (product?.status !== "published") {
        throw new NotFoundError("Resource", input.productId);
      }
      if (product.price !== 0) {
        throw new ValidationError("Only free resources can be claimed without a payment provider");
      }

      const safeBuildRows = await tx
        .select({ id: builds.id })
        .from(builds)
        .where(safePublishedBuildCondition(input.productId))
        .limit(1);
      if (!safeBuildRows[0]) {
        throw new ValidationError(
          "Resource is not currently available for download",
        );
      }

      const now = new Date();
      const existingRows = await tx
        .select()
        .from(entitlements)
        .where(
          and(
            eq(entitlements.subjectType, "user"),
            eq(entitlements.subjectId, input.userId),
            eq(entitlements.resourceId, input.productId),
            eq(entitlements.permission, "product.download"),
            or(isNull(entitlements.expiresAt), gt(entitlements.expiresAt, now)),
          )
        )
        .limit(1);

      if (existingRows[0]) {
        return {
          entitlement: existingRows[0] as unknown as Entitlement,
          alreadyClaimed: true,
        };
      }

      const rows = await tx
        .insert(entitlements)
        .values({
          id: input.entitlementId,
          subjectType: "user",
          subjectId: input.userId,
          permission: "product.download",
          resourceId: input.productId,
          createdAt: new Date(),
        })
        .returning();

      await tx
        .update(products)
        .set({
          salesCount: sql`${products.salesCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(products.id, input.productId));

      return {
        entitlement: rows[0] as unknown as Entitlement,
        alreadyClaimed: false,
      };
    });
  }
}

export const entitlementRepository = new EntitlementRepository();
