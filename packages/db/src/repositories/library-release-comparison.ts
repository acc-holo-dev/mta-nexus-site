import {
  AppError,
  NotFoundError,
  compareLibraryReleases,
  type LibraryReleaseComparisonQuery,
} from "@nexus/domain";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../client";
import { builds, products, users } from "../schema";
import { effectiveUserDownloadSources } from "./user-library";
import { safePublishedBuildCondition } from "./build-safety";
export async function readLibraryReleaseComparison(
  userId: string,
  productId: string,
  query: LibraryReleaseComparisonQuery,
) {
  const validId = (id: string, max: number) =>
    typeof id === "string" && new RegExp(`^[A-Za-z0-9_-]{1,${max}}$`, "u").test(id);
  if (
    !validId(productId, 160) ||
    !validId(query.from, 128) ||
    !validId(query.to, 128) ||
    query.from === query.to ||
    !Number.isInteger(query.returnPage) ||
    query.returnPage < 1 ||
    query.returnPage > 1000
  )
    throw new AppError("Invalid release comparison", 400, "RESOURCE_CONTROL_INVALID");
  return db.transaction(
    async (tx) => {
      const [actor] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (!actor) throw new NotFoundError("Library", userId);
      const [clock] = await tx.execute<{ observedAt: Date | string }>(
        sql`SELECT transaction_timestamp() AS "observedAt"`,
      );
      const date = new Date(clock?.observedAt ?? "");
      if (!Number.isFinite(date.getTime()))
        throw new AppError("Invalid comparison snapshot", 500, "LIBRARY_COMPARISON_INVALID");
      const [product] = await tx.execute<{
        id: string;
        title: string;
        slug: string;
      }>(sql`${effectiveUserDownloadSources(userId, sql`transaction_timestamp()`)}
      SELECT product.id,left(product.title,200) AS title,product.slug FROM owned JOIN ${products} product ON product.id=owned.resource_id
      WHERE product.id=${productId} AND product.status='published' LIMIT 1`);
      if (!product) throw new NotFoundError("Library resource", productId);
      const rows = await tx
        .select({
          id: builds.id,
          version: builds.version,
          createdAt: builds.createdAt,
          sha256Hash: builds.sha256Hash,
          fileSizeBytes: builds.fileSizeBytes,
          fileName: builds.fileName,
          mimeType: builds.mimeType,
          releaseNotes: builds.releaseNotes,
          mtaVersionTarget: builds.mtaVersionTarget,
          isSigned: builds.isSigned,
          packageEvidence: builds.packageEvidence,
        })
        .from(builds)
        .where(
          and(safePublishedBuildCondition(productId), inArray(builds.id, [query.from, query.to])),
        )
        .limit(2);
      const from = rows.find((row) => row.id === query.from),
        to = rows.find((row) => row.id === query.to);
      if (!from || !to) throw new NotFoundError("Release comparison", productId);
      for (const row of [from, to])
        if (
          !/^[a-f0-9]{64}$/u.test(row.sha256Hash) ||
          !Number.isSafeInteger(row.fileSizeBytes) ||
          row.fileSizeBytes < 1
        )
          throw new AppError("Invalid artifact identity", 500, "LIBRARY_COMPARISON_INVALID");
      return {
        schemaVersion: 1 as const,
        product,
        generatedAt: date.toISOString(),
        returnPage: query.returnPage,
        ...compareLibraryReleases(from, to),
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
