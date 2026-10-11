import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import {
  AppError,
  NotFoundError,
  type BuildPackageChange,
  type BuildPackageFilter,
} from "@nexus/domain";
import { db } from "../client";
import { builds, products } from "../schema";
import {
  assertBuildModerationAuthority,
  assertProductMutationAuthority,
} from "./product-mutation-authority";
import { safePublishedBuildCondition } from "./build-safety";
import { historyPageBounds } from "./history-pagination";
const buildSelection = {
  id: builds.id,
  version: builds.version,
  createdAt: builds.createdAt,
  sha256Hash: builds.sha256Hash,
  hasInventory: sql<boolean>`jsonb_typeof(${builds.packageEvidence}->'files') = 'array' AND ${builds.packageEvidence}->>'status' = 'checked'`,
};
export type BuildPackageFileRow = {
  path: string;
  status: BuildPackageChange;
  beforeHash: string | null;
  afterHash: string | null;
  beforeSize: number | null;
  afterSize: number | null;
};
export class BuildPackageComparisonRepository {
  async page(input: {
    actorId: string;
    productId: string;
    buildId: string;
    baselineId?: string;
    staff?: boolean;
    page?: number;
    filter?: BuildPackageFilter;
  }) {
    const { productId, buildId, baselineId, actorId } = input;
    if (baselineId === buildId)
      throw new AppError("Choose another version", 400, "BUILD_PACKAGE_BASELINE_INVALID");
    return db.transaction(
      async (tx) => {
        // Existing product and live management/staff authority remain locked through the read.
        const [product] = await tx
          .select({
            id: products.id,
            title: products.title,
            authorId: products.authorId,
            organizationId: products.organizationId,
          })
          .from(products)
          .where(eq(products.id, productId))
          .limit(1)
          .for("no key update");
        if (!product) throw new NotFoundError("Resource", productId);
        if (input.staff) await assertBuildModerationAuthority(tx, actorId);
        else await assertProductMutationAuthority(tx, product, actorId);
        const [build] = await tx
          .select(buildSelection)
          .from(builds)
          .where(and(eq(builds.productId, productId), eq(builds.id, buildId)))
          .limit(1)
          .for("share");
        if (!build) throw new NotFoundError("Build", buildId);
        const [baseline] = await tx
          .select(buildSelection)
          .from(builds)
          .where(
            and(
              eq(builds.productId, productId),
              ne(builds.id, buildId),
              baselineId
                ? eq(builds.id, baselineId)
                : and(
                    safePublishedBuildCondition(productId),
                    sql`(${builds.createdAt}, ${builds.id}) < (${build.createdAt}, ${build.id})`,
                  ),
            ),
          )
          .orderBy(desc(builds.createdAt), desc(builds.id))
          .limit(1)
          .for("share");
        if (baselineId && !baseline) throw new NotFoundError("Build", baselineId);
        const comparisonAvailable = Boolean(build.hasInventory && baseline?.hasInventory);
        const filter = comparisonAvailable ? (input.filter ?? "all") : "all";
        const files = sql`WITH current_files AS (SELECT f.* FROM ${builds} b CROSS JOIN LATERAL jsonb_to_recordset(CASE WHEN jsonb_typeof(b.package_evidence->'files') = 'array' THEN b.package_evidence->'files' ELSE '[]'::jsonb END) AS f(path text, "sha256Hash" text, "fileSizeBytes" integer) WHERE b.id = ${build.id} AND b.product_id = ${productId}),
        baseline_files AS (SELECT f.* FROM ${builds} b CROSS JOIN LATERAL jsonb_to_recordset(CASE WHEN jsonb_typeof(b.package_evidence->'files') = 'array' THEN b.package_evidence->'files' ELSE '[]'::jsonb END) AS f(path text, "sha256Hash" text, "fileSizeBytes" integer) WHERE b.id = ${comparisonAvailable ? baseline?.id : null} AND b.product_id = ${productId}),
        comparison AS (SELECT coalesce(c.path, p.path) AS path, p."sha256Hash" AS "beforeHash", c."sha256Hash" AS "afterHash", p."fileSizeBytes" AS "beforeSize", c."fileSizeBytes" AS "afterSize",
          CASE WHEN ${comparisonAvailable} = false THEN 'recorded' WHEN c.path IS NULL THEN 'removed' WHEN p.path IS NULL THEN 'added' WHEN p."sha256Hash" IS DISTINCT FROM c."sha256Hash" OR p."fileSizeBytes" IS DISTINCT FROM c."fileSizeBytes" THEN 'changed' ELSE 'unchanged' END AS status
          FROM current_files c FULL OUTER JOIN baseline_files p ON c.path = p.path)`;
        const counts = build.hasInventory
          ? await tx.execute<{ status: BuildPackageChange; total: number }>(
              sql`${files} SELECT status, count(*)::integer AS total FROM comparison GROUP BY status`,
            )
          : [];
        const total = counts
          .filter((v) => filter === "all" || v.status === filter)
          .reduce((sum, row) => sum + Number(row.total), 0);
        const bounds = historyPageBounds(total, input.page);
        const rows = build.hasInventory
          ? await tx.execute<BuildPackageFileRow>(
              sql`${files} SELECT * FROM comparison WHERE ${filter === "all" ? sql`true` : sql`status = ${filter}`} ORDER BY path COLLATE "C" ASC LIMIT ${bounds.pageSize} OFFSET ${bounds.offset}`,
            )
          : [];
        // A bounded set of nearby candidate versions; explicit IDs are independently scoped above.
        const candidates = await tx
          .select({ id: builds.id, version: builds.version })
          .from(builds)
          .where(and(eq(builds.productId, productId), ne(builds.id, buildId)))
          .orderBy(desc(builds.createdAt), asc(builds.id))
          .limit(20);
        return {
          product: { id: product.id, title: product.title },
          build,
          baseline: baseline ?? null,
          candidates,
          comparisonAvailable,
          counts,
          files: rows,
          filter,
          ...bounds,
        };
      },
      { isolationLevel: "repeatable read" },
    );
  }
}
export const buildPackageComparisonRepository = new BuildPackageComparisonRepository();
