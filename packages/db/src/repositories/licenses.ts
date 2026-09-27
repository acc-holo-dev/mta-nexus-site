import { and, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "../client";
import { licenses } from "../schema";
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
