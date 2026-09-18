import { and, eq, desc, ne } from "drizzle-orm";
import { db } from "../client";
import { builds, products } from "../schema";
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

  async moderatePending(
    id: string,
    decision: "approve" | "reject"
  ): Promise<Build | null> {
    return db.transaction(async (tx) => {
      const targetStatus = decision === "approve" ? "published" : "rejected";
      const conditions = [eq(builds.id, id), eq(builds.status, "pending_review")];
      if (decision === "approve") conditions.push(eq(builds.scanStatus, "clean"));

      const rows = await tx
        .update(builds)
        .set({ status: targetStatus })
        .where(and(...conditions))
        .returning();
      const reviewed = rows[0];
      if (!reviewed) return null;

      if (decision === "approve") {
        await tx
          .update(products)
          .set({
            currentVersion: reviewed.version,
            status: "published",
            updatedAt: new Date(),
          })
          .where(eq(products.id, reviewed.productId));
      } else {
        const fallback = await tx
          .select({ version: builds.version })
          .from(builds)
          .where(and(
            eq(builds.productId, reviewed.productId),
            ne(builds.id, reviewed.id),
            eq(builds.status, "published")
          ))
          .orderBy(desc(builds.createdAt))
          .limit(1);
        await tx
          .update(products)
          .set(fallback[0]
            ? { currentVersion: fallback[0].version, status: "published", updatedAt: new Date() }
            : { status: "draft", updatedAt: new Date() }
          )
          .where(eq(products.id, reviewed.productId));
      }

      return reviewed as unknown as Build;
    });
  }

  async retireAndRefreshProduct(
    id: string,
    expectedStatus: Build["status"]
  ): Promise<Build | null> {
    return db.transaction(async (tx) => {
      const rows = await tx
        .update(builds)
        .set({ status: "retired" })
        .where(and(eq(builds.id, id), eq(builds.status, expectedStatus)))
        .returning();
      const retired = rows[0];
      if (!retired) return null;

      const fallback = await tx
        .select({ version: builds.version })
        .from(builds)
        .where(and(
          eq(builds.productId, retired.productId),
          ne(builds.id, retired.id),
          eq(builds.status, "published")
        ))
        .orderBy(desc(builds.createdAt))
        .limit(1);
      await tx
        .update(products)
        .set(fallback[0]
          ? { currentVersion: fallback[0].version, status: "published", updatedAt: new Date() }
          : { status: "draft", updatedAt: new Date() }
        )
        .where(eq(products.id, retired.productId));

      return retired as unknown as Build;
    });
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
