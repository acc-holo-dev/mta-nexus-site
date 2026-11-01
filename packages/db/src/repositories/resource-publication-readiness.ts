import {
  type BuildScanStatus,
  type BuildStatus,
  buildResourcePublicationReadiness,
  NotFoundError,
  type ResourcePublicationReadinessBuild,
  type ResourcePublicationReadinessSummary,
  type User,
} from "@nexus/domain";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../client";
import { builds, products, resourceMedia } from "../schema";
import { trustedCleanScanCondition } from "./build-safety";
import { assertProductMutationAuthority } from "./product-mutation-authority";
import { managedProductCondition } from "./products";

const buildProjection = {
  id: builds.id,
  version: builds.version,
  status: builds.status,
  scanStatus: builds.scanStatus,
  scanner: builds.scanner,
  scannedAt: builds.scannedAt,
};

function hasCompatibilityMetadata(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as { mtaMinVersion?: unknown; dependencies?: unknown };
  if (typeof record.mtaMinVersion === "string" && record.mtaMinVersion.trim().length > 0) {
    return true;
  }
  return Array.isArray(record.dependencies) && record.dependencies.length > 0;
}

function mapBuild(row: {
  id: string;
  version: string;
  status: string;
  scanStatus: string;
  scanner: string | null;
  scannedAt: Date | null;
}): ResourcePublicationReadinessBuild {
  return {
    id: row.id,
    version: row.version,
    status: row.status as BuildStatus,
    scanStatus: row.scanStatus as BuildScanStatus,
    scanner: row.scanner,
    scannedAt: row.scannedAt ? row.scannedAt.toISOString() : null,
  };
}

export class ResourcePublicationReadinessRepository {
  async summary(
    productId: string,
    actor: Pick<User, "id" | "role">,
  ): Promise<ResourcePublicationReadinessSummary> {
    return db.transaction(
      async (tx) => {
        const [product] = await tx
          .select({
            id: products.id,
            status: products.status,
            title: products.title,
            description: products.description,
            shortDescription: products.shortDescription,
            metadataReviewRequired: products.metadataReviewRequired,
            compatibility: products.compatibility,
            authorId: products.authorId,
            organizationId: products.organizationId,
          })
          .from(products)
          .where(
            and(eq(products.id, productId), eq(products.price, 0), managedProductCondition(actor)),
          )
          .limit(1)
          .for("share");
        if (!product) throw new NotFoundError("Resource", productId);
        await assertProductMutationAuthority(tx, product, actor.id);

        const [[mediaSummary], submitRows, latestRows] = await Promise.all([
          tx
            .select({ total: count() })
            .from(resourceMedia)
            .where(eq(resourceMedia.productId, productId)),
          tx
            .select(buildProjection)
            .from(builds)
            .where(
              and(
                eq(builds.productId, productId),
                inArray(builds.status, ["draft", "published"]),
                trustedCleanScanCondition(),
              ),
            )
            .orderBy(
              sql`case when ${builds.status} = 'draft' then 0 else 1 end`,
              desc(builds.createdAt),
              desc(builds.id),
            )
            .limit(1),
          tx
            .select(buildProjection)
            .from(builds)
            .where(eq(builds.productId, productId))
            .orderBy(desc(builds.createdAt), desc(builds.id))
            .limit(1),
        ]);

        return buildResourcePublicationReadiness({
          productId: product.id,
          productStatus: product.status as ResourcePublicationReadinessSummary["productStatus"],
          metadataReviewRequired: product.metadataReviewRequired,
          title: product.title,
          description: product.description ?? "",
          shortDescription: product.shortDescription ?? "",
          hasCompatibilityMetadata: hasCompatibilityMetadata(product.compatibility),
          mediaCount: mediaSummary?.total ?? 0,
          submitCandidate: submitRows[0] ? mapBuild(submitRows[0]) : null,
          latestBuild: latestRows[0] ? mapBuild(latestRows[0]) : null,
        });
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
}

export const resourcePublicationReadinessRepository = new ResourcePublicationReadinessRepository();
