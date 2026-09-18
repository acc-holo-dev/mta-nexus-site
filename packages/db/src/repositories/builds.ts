import { and, eq, desc } from "drizzle-orm";
import { db } from "../client";
import { builds } from "../schema";
import type { Build } from "@nexus/domain";

export class BuildRepository {
  async listByProduct(productId: string): Promise<Build[]> {
        const rows = await db
      .select()
      .from(builds)
      .where(eq(builds.productId, productId))
      .orderBy(desc(builds.createdAt));
    return rows as unknown as Build[];
  }

  async listPendingReview(limit = 100): Promise<Build[]> {
    const rows = await db
      .select()
      .from(builds)
      .where(eq(builds.status, "pending_review"))
      .orderBy(desc(builds.createdAt))
      .limit(limit);
    return rows as unknown as Build[];
  }

  async listPublishedByProduct(productId: string): Promise<Build[]> {
    const rows = await db
      .select()
      .from(builds)
      .where(and(eq(builds.productId, productId), eq(builds.status, "published")))
      .orderBy(desc(builds.createdAt));
    return rows as unknown as Build[];
  }

  async findById(id: string): Promise<Build | null> {
    const rows = await db.select().from(builds).where(eq(builds.id, id)).limit(1);
    return (rows[0] as unknown as Build) || null;
  }

  async updateStatus(
    id: string,
    status: Build["status"],
    expectedStatus?: Build["status"]
  ): Promise<Build | null> {
    const condition = expectedStatus
      ? and(eq(builds.id, id), eq(builds.status, expectedStatus))
      : eq(builds.id, id);
    const rows = await db.update(builds).set({ status }).where(condition).returning();
    return (rows[0] as unknown as Build) || null;
  }

  async create(data: Omit<Build, "createdAt">): Promise<Build> {
    const values = {
      ...data,
      createdAt: new Date(),
    };

        const rows = await db.insert(builds).values(values).returning();
    return rows[0] as unknown as Build;
  }
}

export const buildRepository = new BuildRepository();
