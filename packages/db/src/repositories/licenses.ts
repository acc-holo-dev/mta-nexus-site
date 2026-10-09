import { and, count, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { db } from "../client";
import { licenses, products } from "../schema";
import { historyPageBounds } from "./history-pagination";
import type { License } from "@nexus/domain";

export class LicenseRepository {
  async listActiveDownloadableByUser(userId: string): Promise<Array<Pick<License, "productId" | "createdAt">>> {
    const rows = await db.select({
      productId: licenses.productId,
      createdAt: licenses.createdAt,
    }).from(licenses).where(and(
      eq(licenses.userId, userId),
      eq(licenses.status, "active"),
      or(isNull(licenses.expiresAt), gt(licenses.expiresAt, new Date())),
    ));
    return rows;
  }

  /**
   * Bounded, user-scoped legacy license archive. Deliberately exclude the
   * secret license key, entitlement JSON, server ID and account metadata.
   */
  async pageUserHistory(userId: string, requestedPage = 1) {
    const scope = eq(licenses.userId, userId);
    const [summary] = await db.select({ total: count() }).from(licenses).where(scope);
    const bounds = historyPageBounds(summary?.total ?? 0, requestedPage);
    const rows = await db.select({
      id: licenses.id,
      productTitle: products.title,
      status: licenses.status,
      model: licenses.model,
      expiresAt: licenses.expiresAt,
      createdAt: licenses.createdAt,
      serverBound: sql<boolean>`${licenses.serverId} IS NOT NULL`,
    }).from(licenses)
      .innerJoin(products, eq(licenses.productId, products.id))
      .where(scope)
      .orderBy(desc(licenses.createdAt), desc(licenses.id))
      .limit(bounds.pageSize).offset(bounds.offset);
    return { licenses: rows, ...bounds };
  }

  async findByKey(key: string): Promise<License | null> {
        const rows = await db.select().from(licenses).where(eq(licenses.key, key)).limit(1);
    return (rows[0] as unknown as License) || null;
  }

  async listByUser(userId: string): Promise<License[]> {
        const rows = await db.select().from(licenses).where(eq(licenses.userId, userId));
    return rows as unknown as License[];
  }

  async listAll(): Promise<License[]> {
        const rows = await db.select().from(licenses);
    return rows as unknown as License[];
  }

  async create(data: Omit<License, "createdAt" | "updatedAt">): Promise<License> {
    const values = {
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

        const rows = await db.insert(licenses).values(values).returning();
    return rows[0] as unknown as License;
  }

  async updateStatus(id: string, status: License["status"]): Promise<void> {
        await db
      .update(licenses)
      .set({ status, updatedAt: new Date() })
      .where(eq(licenses.id, id));
  }
}

export const licenseRepository = new LicenseRepository();
