import { eq, and, or, gt, isNull } from "drizzle-orm";
import { db } from "../client";
import { entitlements, licenses } from "../schema";
import type { Entitlement } from "@nexus/domain";

export class EntitlementRepository {
  async hasEntitlement(
    subject: { type: "user" | "server" | "organization"; id: string },
    resourceId: string,
    permission: string
  ): Promise<boolean> {
    const rows = await db
      .select()
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
        .select()
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

  async create(data: Omit<Entitlement, "createdAt">): Promise<Entitlement> {
    const values = {
      ...data,
      createdAt: new Date(),
    };

    const rows = await db.insert(entitlements).values(values).returning();
    return rows[0] as unknown as Entitlement;
  }
}

export const entitlementRepository = new EntitlementRepository();
