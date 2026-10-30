import type { Build } from "@nexus/domain";
import { buildPackageSummary, releaseHistoryPageBounds } from "@nexus/domain";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../client";
import { auditEvents, builds, products, users } from "../schema";
import { safePublishedBuildCondition, trustedCleanScanCondition } from "./build-safety";
import type { PendingReviewBuild, RiskReviewBuild } from "./builds-types";

export async function findExactPendingRetry(
  input: Pick<
    Build,
    | "productId"
    | "version"
    | "sha256Hash"
    | "fileSizeBytes"
    | "fileName"
    | "mimeType"
    | "releaseNotes"
    | "mtaVersionTarget"
  >,
): Promise<Build | null> {
  const rows = await db
    .select()
    .from(builds)
    .where(
      and(
        eq(builds.productId, input.productId),
        eq(builds.version, input.version),
        eq(builds.status, "pending_review"),
        trustedCleanScanCondition(),
        eq(builds.sha256Hash, input.sha256Hash),
        eq(builds.fileSizeBytes, input.fileSizeBytes),
        eq(builds.fileName, input.fileName),
        eq(builds.mimeType, input.mimeType),
        sql`coalesce(${builds.releaseNotes}, '') = ${input.releaseNotes ?? ""}`,
        sql`coalesce(${builds.mtaVersionTarget}, '') = ${input.mtaVersionTarget ?? ""}`,
      ),
    )
    .limit(1);
  return (rows[0] as unknown as Build) || null;
}

export async function pageHistory(productId: string, requestedPage = 1) {
  const condition = eq(builds.productId, productId);
  const [summary] = await db.select({ total: count() }).from(builds).where(condition);
  const totalPages = Math.max(1, Math.ceil((summary?.total ?? 0) / 20));
  const page = Math.min(
    Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1,
    totalPages,
  );
  const rows = await db
    .select()
    .from(builds)
    .where(condition)
    .orderBy(desc(builds.createdAt), desc(builds.id))
    .limit(20)
    .offset((page - 1) * 20);
  const decisions = rows.length
    ? await db
        .select({
          id: auditEvents.id,
          buildId: auditEvents.targetId,
          action: auditEvents.action,
          details: auditEvents.details,
          createdAt: auditEvents.createdAt,
        })
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.targetType, "build"),
            inArray(
              auditEvents.targetId,
              rows.map((row) => row.id),
            ),
            inArray(auditEvents.action, [
              "build.approved",
              "build.rejected",
              "build.retired",
              "build.quarantined",
              "build.quarantine_restored",
              "build.metadata_saved",
              "build.review_withdrawn",
              "build.review_resubmitted",
            ]),
          ),
        )
        .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
        .limit(200)
    : [];
  return { builds: rows as unknown as Build[], decisions, page, totalPages };
}

export async function countPendingReview(): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(builds)
    .where(eq(builds.status, "pending_review"));
  return row?.total ?? 0;
}

export async function listPendingReviewPage(
  page: number,
  pageSize = 30,
): Promise<{ builds: PendingReviewBuild[]; hasMore: boolean }> {
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > 99_999 ||
    !Number.isSafeInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 100
  ) {
    throw new RangeError("Invalid build review page");
  }
  const rows = await db
    .select({
      build: builds,
      productTitle: products.title,
      productSlug: products.slug,
      productStatus: products.status,
      publisherId: users.id,
      publisherUsername: users.username,
    })
    .from(builds)
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

export async function listRiskReviewPage(
  page: number,
  pageSize = 30,
): Promise<{ builds: RiskReviewBuild[]; hasMore: boolean }> {
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > 99_999 ||
    !Number.isSafeInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 100
  ) {
    throw new RangeError("Invalid build risk-review page");
  }

  const rows = await db
    .select({
      build: builds,
      productTitle: products.title,
      productSlug: products.slug,
      productStatus: products.status,
      publisherId: users.id,
      publisherUsername: users.username,
    })
    .from(builds)
    .innerJoin(products, eq(builds.productId, products.id))
    .innerJoin(users, eq(products.authorId, users.id))
    .where(inArray(builds.status, ["published", "quarantined"]))
    .orderBy(desc(builds.createdAt), desc(builds.id))
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

export async function countQuarantined(): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(builds)
    .where(eq(builds.status, "quarantined"));
  return row?.total ?? 0;
}

export async function listByProduct(productId: string): Promise<Build[]> {
  const rows = await db
    .select()
    .from(builds)
    .where(eq(builds.productId, productId))
    .orderBy(desc(builds.createdAt), desc(builds.id));
  return rows as unknown as Build[];
}

export async function listPendingReview(limit = 100): Promise<Build[]> {
  const rows = await db
    .select()
    .from(builds)
    .where(eq(builds.status, "pending_review"))
    .orderBy(desc(builds.createdAt))
    .limit(limit);
  return rows as unknown as Build[];
}

export async function listPublishedByProduct(productId: string): Promise<Build[]> {
  const rows = await db
    .select()
    .from(builds)
    .where(safePublishedBuildCondition(productId))
    .orderBy(desc(builds.createdAt), desc(builds.id));
  return rows as unknown as Build[];
}

export async function findById(id: string): Promise<Build | null> {
  const rows = await db.select().from(builds).where(eq(builds.id, id)).limit(1);
  return (rows[0] as unknown as Build) || null;
}

/**
 * Public release archive: project only safe publication metadata. Never
 * return storage keys, quarantine reasons or moderation/private audit data.
 */
export async function pagePublishedReleases(productId: string, requestedPage = 1) {
  const condition = safePublishedBuildCondition(productId);
  const [summary] = await db.select({ total: count() }).from(builds).where(condition);
  const bounds = releaseHistoryPageBounds(summary?.total ?? 0, requestedPage);
  const releases = await db
    .select({
      packageEvidence: builds.packageEvidence,
      id: builds.id,
      version: builds.version,
      releaseNotes: builds.releaseNotes,
      sha256Hash: builds.sha256Hash,
      fileName: builds.fileName,
      fileSizeBytes: builds.fileSizeBytes,
      mimeType: builds.mimeType,
      mtaVersionTarget: builds.mtaVersionTarget,
      scanStatus: builds.scanStatus,
      scanner: builds.scanner,
      scannedAt: builds.scannedAt,
      isSigned: builds.isSigned,
      createdAt: builds.createdAt,
    })
    .from(builds)
    .where(condition)
    .orderBy(desc(builds.createdAt), desc(builds.id))
    .limit(bounds.pageSize)
    .offset(bounds.offset);
  return {
    releases: releases.map(({ packageEvidence, ...release }) => ({
      ...release,
      packageSummary: buildPackageSummary(packageEvidence),
    })),
    ...bounds,
  };
}

/**
 * Pinned download lookup is always scoped by product *and* current trusted
 * publication. A build from another product or retired/quarantined version
 * must be indistinguishable from an unknown version.
 */
export async function findPublishedByProductAndId(
  productId: string,
  buildId: string,
): Promise<Build | null> {
  const [build] = await db
    .select()
    .from(builds)
    .where(and(safePublishedBuildCondition(productId), eq(builds.id, buildId)))
    .limit(1);
  return (build as unknown as Build) ?? null;
}

export async function findLatestPublishedByProduct(productId: string): Promise<Build | null> {
  const rows = await db
    .select()
    .from(builds)
    .where(safePublishedBuildCondition(productId))
    .orderBy(desc(builds.createdAt), desc(builds.id))
    .limit(1);
  return (rows[0] as unknown as Build) || null;
}

export async function updateStatus(
  id: string,
  status: Build["status"],
  expectedStatus?: Build["status"],
): Promise<Build | null> {
  const condition = expectedStatus
    ? and(eq(builds.id, id), eq(builds.status, expectedStatus))
    : eq(builds.id, id);
  const rows = await db.update(builds).set({ status }).where(condition).returning();
  return (rows[0] as unknown as Build) || null;
}

export async function create(data: Omit<Build, "createdAt">): Promise<Build> {
  const values = {
    ...data,
    createdAt: new Date(),
  };

  const rows = await db.insert(builds).values(values).returning();
  return rows[0] as unknown as Build;
}
