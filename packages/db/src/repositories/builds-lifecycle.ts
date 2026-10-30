import type { AuditEvent, Build } from "@nexus/domain";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "../client";
import { auditEvents, builds, products } from "../schema";
import { safePublishedBuildCondition, trustedCleanScanCondition } from "./build-safety";
import { lockInitiatingSession } from "./initiating-session";
import {
  assertBuildModerationAuthority,
  assertProductMutationAuthority,
} from "./product-mutation-authority";

export async function retireAndRefreshProduct(
  id: string,
  expectedStatus: Build["status"],
  audit: Omit<AuditEvent, "createdAt">,
): Promise<Build | null> {
  return db.transaction(async (tx) => {
    const [target] = await tx
      .select({ productId: builds.productId })
      .from(builds)
      .where(eq(builds.id, id))
      .limit(1);
    if (!target) return null;
    const [parent] = await tx
      .select({
        id: products.id,
        status: products.status,
        authorId: products.authorId,
        organizationId: products.organizationId,
        metadataReviewRequired: products.metadataReviewRequired,
      })
      .from(products)
      .where(eq(products.id, target.productId))
      .limit(1)
      .for("no key update");
    if (!parent) return null;
    await assertProductMutationAuthority(tx, parent, audit.actorId);

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
      .where(and(safePublishedBuildCondition(retired.productId), ne(builds.id, retired.id)))
      .orderBy(desc(builds.createdAt), desc(builds.id))
      .limit(1);
    const pending = await tx
      .select({ version: builds.version })
      .from(builds)
      .where(and(eq(builds.productId, retired.productId), eq(builds.status, "pending_review")))
      .orderBy(desc(builds.createdAt), desc(builds.id))
      .limit(1);
    await tx
      .update(products)
      .set(
        parent.status === "archived" || parent.status === "suspended"
          ? { updatedAt: new Date() }
          : fallback[0] && !parent.metadataReviewRequired
            ? { currentVersion: fallback[0].version, status: "published", updatedAt: new Date() }
            : pending[0]
              ? {
                  currentVersion: pending[0].version,
                  status: "pending_review",
                  updatedAt: new Date(),
                }
              : { status: "draft", updatedAt: new Date() },
      )
      .where(eq(products.id, retired.productId));

    await tx.insert(auditEvents).values({ ...audit, createdAt: new Date() });
    return retired as unknown as Build;
  });
}

export async function quarantinePublishedAndRefreshProduct(
  id: string,
  actorId: string,
  reason: string,
  audit: Omit<AuditEvent, "createdAt">,
  currentToken: string,
): Promise<Build | null> {
  return db.transaction(async (tx) => {
    const [target] = await tx
      .select({ productId: builds.productId })
      .from(builds)
      .where(eq(builds.id, id))
      .limit(1);
    if (!target) return null;
    const [parent] = await tx
      .select({
        id: products.id,
        status: products.status,
        authorId: products.authorId,
        organizationId: products.organizationId,
        metadataReviewRequired: products.metadataReviewRequired,
      })
      .from(products)
      .where(eq(products.id, target.productId))
      .limit(1)
      .for("no key update");
    if (!parent) return null;
    await assertBuildModerationAuthority(tx, audit.actorId);
    await lockInitiatingSession(tx, audit.actorId, currentToken);

    const now = new Date();
    const rows = await tx
      .update(builds)
      .set({
        status: "quarantined",
        quarantinePreviousStatus: "published",
        quarantineReason: reason,
        quarantinedAt: now,
        quarantinedBy: actorId,
      })
      .where(and(eq(builds.id, id), eq(builds.status, "published")))
      .returning();
    const quarantined = rows[0];
    if (!quarantined) return null;

    const productRows = await tx
      .update(products)
      .set({ updatedAt: sql`${products.updatedAt}` })
      .where(eq(products.id, quarantined.productId))
      .returning({ id: products.id, status: products.status });
    const product = productRows[0];
    if (!product) {
      throw new Error("Build product disappeared during quarantine");
    }

    const fallback = await tx
      .select({ version: builds.version })
      .from(builds)
      .where(safePublishedBuildCondition(quarantined.productId))
      .orderBy(desc(builds.createdAt), desc(builds.id))
      .limit(1);

    if (product.status === "published") {
      await tx
        .update(products)
        .set(
          fallback[0]
            ? {
                currentVersion: fallback[0].version,
                status: "published",
                updatedAt: now,
              }
            : { status: "draft", updatedAt: now },
        )
        .where(eq(products.id, quarantined.productId));
    } else if (fallback[0]) {
      await tx
        .update(products)
        .set({ currentVersion: fallback[0].version, updatedAt: now })
        .where(eq(products.id, quarantined.productId));
    }

    await tx.insert(auditEvents).values({ ...audit, createdAt: now });
    return quarantined as unknown as Build;
  });
}

export async function restoreQuarantinedAndRefreshProduct(
  id: string,
  audit: Omit<AuditEvent, "createdAt">,
  currentToken: string,
): Promise<Build | null> {
  return db.transaction(async (tx) => {
    const [target] = await tx
      .select({ productId: builds.productId })
      .from(builds)
      .where(eq(builds.id, id))
      .limit(1);
    if (!target) return null;
    const [parent] = await tx
      .select({
        id: products.id,
        status: products.status,
        authorId: products.authorId,
        organizationId: products.organizationId,
        metadataReviewRequired: products.metadataReviewRequired,
      })
      .from(products)
      .where(eq(products.id, target.productId))
      .limit(1)
      .for("no key update");
    if (!parent) return null;
    await assertBuildModerationAuthority(tx, audit.actorId);
    await lockInitiatingSession(tx, audit.actorId, currentToken);

    const now = new Date();
    const rows = await tx
      .update(builds)
      .set({
        status: "published",
        quarantinePreviousStatus: null,
        quarantineReason: null,
        quarantinedAt: null,
        quarantinedBy: null,
      })
      .where(
        and(
          eq(builds.id, id),
          eq(builds.status, "quarantined"),
          eq(builds.quarantinePreviousStatus, "published"),
          trustedCleanScanCondition(),
        ),
      )
      .returning();
    const restored = rows[0];
    if (!restored) return null;

    const productRows = await tx
      .update(products)
      .set({ updatedAt: sql`${products.updatedAt}` })
      .where(eq(products.id, restored.productId))
      .returning({ id: products.id, status: products.status });
    const product = productRows[0];
    if (!product) {
      throw new Error("Build product disappeared during quarantine restore");
    }

    const latestPublished = await tx
      .select({ version: builds.version })
      .from(builds)
      .where(safePublishedBuildCondition(restored.productId))
      .orderBy(desc(builds.createdAt), desc(builds.id))
      .limit(1);
    if (!latestPublished[0]) {
      throw new Error("Restored build disappeared from safe publication scope");
    }

    await tx
      .update(products)
      .set(
        (product.status === "draft" || product.status === "published") &&
          !parent.metadataReviewRequired
          ? {
              currentVersion: latestPublished[0].version,
              status: "published",
              updatedAt: now,
            }
          : {
              currentVersion: latestPublished[0].version,
              updatedAt: now,
            },
      )
      .where(eq(products.id, restored.productId));

    await tx.insert(auditEvents).values({ ...audit, createdAt: now });
    return restored as unknown as Build;
  });
}
