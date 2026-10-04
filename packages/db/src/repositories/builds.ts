import { and, asc, count, eq, desc, ne, sql, inArray } from "drizzle-orm";
import { safePublishedBuildCondition, trustedCleanScanCondition } from "./build-safety";
import { db } from "../client";
import { auditEvents, builds, products, users, organizations, organizationMembers, notificationPreferences, notifications } from "../schema";
import type { AuditEvent, Build } from "@nexus/domain";

export type PendingReviewBuild = Build & {
  productTitle: string;
  productSlug: string;
  productStatus: string;
  publisherId: string;
  publisherUsername: string;
};

export class BuildRepository {
  async pageHistory(productId: string, requestedPage = 1) {
    const condition = eq(builds.productId, productId);
    const [summary] = await db.select({ total: count() }).from(builds).where(condition);
    const totalPages = Math.max(1, Math.ceil((summary?.total ?? 0) / 20));
    const page = Math.min(Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1, totalPages);
    const rows = await db.select().from(builds).where(condition)
      .orderBy(desc(builds.createdAt), desc(builds.id)).limit(20).offset((page - 1) * 20);
    const decisions = rows.length ? await db.select({ id: auditEvents.id, buildId: auditEvents.targetId,
      action: auditEvents.action, details: auditEvents.details, createdAt: auditEvents.createdAt })
      .from(auditEvents).where(and(eq(auditEvents.targetType, "build"),
        inArray(auditEvents.targetId, rows.map((row) => row.id)),
        inArray(auditEvents.action, ["build.approved", "build.rejected", "build.retired"])))
      .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id)) : [];
    return { builds: rows as unknown as Build[], decisions, page, totalPages };
  }

  async countPendingReview(): Promise<number> {
    const [row] = await db.select({ total: count() }).from(builds)
      .where(eq(builds.status, "pending_review"));
    return row?.total ?? 0;
  }

  async listPendingReviewPage(page: number, pageSize = 30): Promise<{ builds: PendingReviewBuild[]; hasMore: boolean }> {
    if (!Number.isSafeInteger(page) || page < 1 || page > 99_999 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      throw new RangeError("Invalid build review page");
    }
    const rows = await db.select({
      build: builds,
      productTitle: products.title,
      productSlug: products.slug,
      productStatus: products.status,
      publisherId: users.id,
      publisherUsername: users.username,
    }).from(builds)
      .innerJoin(products, eq(builds.productId, products.id))
      .innerJoin(users, eq(products.authorId, users.id))
      .where(eq(builds.status, "pending_review"))
      .orderBy(asc(builds.createdAt), asc(builds.id))
      .limit(pageSize + 1)
      .offset((page - 1) * pageSize);
    return {
      builds: rows.slice(0, pageSize).map((row) => ({
        ...(row.build as unknown as Build),
        productTitle: row.productTitle,
        productSlug: row.productSlug,
        productStatus: row.productStatus,
        publisherId: row.publisherId,
        publisherUsername: row.publisherUsername,
      })),
      hasMore: rows.length > pageSize,
    };
  }

  async listByProduct(productId: string): Promise<Build[]> {
        const rows = await db
      .select()
      .from(builds)
      .where(eq(builds.productId, productId))
      .orderBy(desc(builds.createdAt), desc(builds.id));
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
      .where(safePublishedBuildCondition(productId))
      .orderBy(desc(builds.createdAt), desc(builds.id));
    return rows as unknown as Build[];
  }

  async findById(id: string): Promise<Build | null> {
    const rows = await db.select().from(builds).where(eq(builds.id, id)).limit(1);
    return (rows[0] as unknown as Build) || null;
  }

  async findLatestPublishedByProduct(productId: string): Promise<Build | null> {
    const rows = await db
      .select()
      .from(builds)
      .where(safePublishedBuildCondition(productId))
      .orderBy(desc(builds.createdAt), desc(builds.id))
      .limit(1);
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

  async submitForReview(
    data: Omit<Build, "createdAt">,
    audit: Omit<AuditEvent, "createdAt">
  ): Promise<Build> {
    return db.transaction(async (tx) => {
      const createdAt = new Date();
      const rows = await tx
        .insert(builds)
        .values({ ...data, createdAt })
        .returning();
      const build = rows[0];

      const published = await tx
        .select({ id: builds.id })
        .from(builds)
        .where(safePublishedBuildCondition(data.productId))
        .limit(1);
      if (!published[0]) {
        await tx
          .update(products)
          .set({
            currentVersion: data.version,
            status: "pending_review",
            updatedAt: createdAt,
          })
          .where(eq(products.id, data.productId));
      }

      await tx.insert(auditEvents).values({ ...audit, createdAt });
      return build as unknown as Build;
    });
  }

  async moderatePending(
    id: string,
    decision: "approve" | "reject",
    audit: Omit<AuditEvent, "createdAt">
  ): Promise<Build | null> {
    return db.transaction(async (tx) => {
      const targetStatus = decision === "approve" ? "published" : "rejected";
      const reviewCondition =
        decision === "approve"
          ? and(
              eq(builds.id, id),
              eq(builds.status, "pending_review"),
              trustedCleanScanCondition(),
            )
          : and(eq(builds.id, id), eq(builds.status, "pending_review"));

      const rows = await tx
        .update(builds)
        .set({ status: targetStatus })
        .where(reviewCondition)
        .returning();
      const reviewed = rows[0];
      if (!reviewed) return null;

      const lockedProduct = await tx
        .update(products)
        .set({ updatedAt: sql`${products.updatedAt}` })
        .where(eq(products.id, reviewed.productId))
        .returning({ id: products.id, title: products.title, authorId: products.authorId, organizationId: products.organizationId });
      if (!lockedProduct[0]) {
        throw new Error("Build product disappeared during moderation");
      }

      if (decision === "approve") {
        const latestPublished = await tx
          .select({
            id: builds.id,
            version: builds.version,
          })
          .from(builds)
          .where(safePublishedBuildCondition(reviewed.productId))
          .orderBy(desc(builds.createdAt), desc(builds.id))
          .limit(1);
        if (!latestPublished[0]) {
          throw new Error("Published build disappeared during moderation");
        }

        await tx
          .update(products)
          .set({
            currentVersion: latestPublished[0].version,
            status: "published",
            updatedAt: new Date(),
          })
          .where(eq(products.id, reviewed.productId));
      } else {
        const fallback = await tx
          .select({ version: builds.version })
          .from(builds)
          .where(
            and(
              safePublishedBuildCondition(reviewed.productId),
              ne(builds.id, reviewed.id),
            ),
          )
          .orderBy(desc(builds.createdAt), desc(builds.id))
          .limit(1);
        await tx
          .update(products)
          .set(fallback[0]
            ? { currentVersion: fallback[0].version, status: "published", updatedAt: new Date() }
            : { status: "draft", updatedAt: new Date() }
          )
          .where(eq(products.id, reviewed.productId));
      }

      await tx.insert(auditEvents).values({ ...audit, createdAt: new Date() });
      const product = lockedProduct[0];
      const notes = typeof audit.details?.notes === "string" ? audit.details.notes : "";
      const title = decision === "approve" ? "Resource version approved" : "Resource version rejected";
      const data = { kind: "build_review", decision, resourceTitle: product.title, version: reviewed.version, notes };
      // Resolve current recipients in SQL, without exposing notes to former owners.
      // The pending-state compare-and-set above makes a replay a no-op, including delivery.
      await tx.execute(sql`
        insert into ${notifications} (id, recipient_id, title, message, link, type, category, is_read, data, created_at)
        select 'ntf_build_review_' || ${reviewed.id} || '_' || ${users.id}, ${users.id},
          ${title}, ${`${product.title} · ${reviewed.version}${notes ? `\n${notes}` : ""}`},
          ${`/workspace/resources/${product.id}`}, 'system', 'system', false, ${JSON.stringify(data)}::jsonb, now()
        from ${users}
        where (
          (${product.organizationId}::text is null and ${users.id} = ${product.authorId})
          or exists (select 1 from ${organizations}
            where ${organizations.id} = ${product.organizationId} and ${organizations.ownerId} = ${users.id})
          or exists (select 1 from ${organizationMembers}
            where ${organizationMembers.organizationId} = ${product.organizationId}
              and ${organizationMembers.userId} = ${users.id}
              and (${organizationMembers.role} in ('owner', 'admin')
                or ${organizationMembers.permissions} @> '["manage_products"]'::jsonb))
        ) and not exists (select 1 from ${notificationPreferences}
          where ${notificationPreferences.userId} = ${users.id}
            and ${notificationPreferences.systemEnabled} = false)
      `);
      return reviewed as unknown as Build;
    });
  }

  async retireAndRefreshProduct(
    id: string,
    expectedStatus: Build["status"],
    audit: Omit<AuditEvent, "createdAt">
  ): Promise<Build | null> {
    return db.transaction(async (tx) => {
      const rows = await tx
        .update(builds)
        .set({ status: "retired" })
        .where(and(eq(builds.id, id), eq(builds.status, expectedStatus)))
        .returning();
      const retired = rows[0];
      if (!retired) return null;

      const lockedProduct = await tx
        .update(products)
        .set({ updatedAt: sql`${products.updatedAt}` })
        .where(eq(products.id, retired.productId))
        .returning({ id: products.id });
      if (!lockedProduct[0]) {
        throw new Error("Build product disappeared during retirement");
      }

      const fallback = await tx
        .select({ version: builds.version })
        .from(builds)
        .where(
          and(
            safePublishedBuildCondition(retired.productId),
            ne(builds.id, retired.id),
          ),
        )
        .orderBy(desc(builds.createdAt), desc(builds.id))
        .limit(1);
      await tx
        .update(products)
        .set(fallback[0]
          ? { currentVersion: fallback[0].version, status: "published", updatedAt: new Date() }
          : { status: "draft", updatedAt: new Date() }
        )
        .where(eq(products.id, retired.productId));

      await tx.insert(auditEvents).values({ ...audit, createdAt: new Date() });
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
