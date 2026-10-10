import { AppError, type Build, NotFoundError } from "@nexus/domain";
import { eq } from "drizzle-orm";
import { db } from "../client";
import { auditEvents, builds, products } from "../schema";
import { assertBuildModerationAuthority } from "./product-mutation-authority";

export class BuildReviewDownloadRepository {
  /** Revalidate the live grant and exact artifact after storage has opened it. */
  async authorize(input: { actorId: string; auditId: string; expected: Build }) {
    return db.transaction(async (tx) => {
      const [product] = await tx
        .select({ id: products.id })
        .from(products)
        .where(eq(products.id, input.expected.productId))
        .limit(1)
        .for("share");
      if (!product) throw new NotFoundError("Build", input.expected.id);
      const actor = await assertBuildModerationAuthority(tx, input.actorId);
      const [build] = await tx
        .select()
        .from(builds)
        .where(eq(builds.id, input.expected.id))
        .limit(1)
        .for("share");
      if (!build) throw new NotFoundError("Build", input.expected.id);
      const expected = input.expected;
      if (
        build.productId !== product.id ||
        build.status !== expected.status ||
        (build.status !== "pending_review" && build.status !== "quarantined") ||
        build.scanStatus !== "clean" ||
        !build.scanner?.trim() ||
        !build.scannedAt ||
        build.scanner !== expected.scanner ||
        !expected.scannedAt ||
        new Date(build.scannedAt).getTime() !== new Date(expected.scannedAt).getTime() ||
        build.storageKey !== expected.storageKey ||
        build.sha256Hash !== expected.sha256Hash ||
        build.fileSizeBytes !== expected.fileSizeBytes ||
        build.fileName !== expected.fileName ||
        build.mimeType !== expected.mimeType ||
        build.version !== expected.version
      ) {
        throw new AppError("Build evidence changed; reload", 409, "BUILD_STATE_CHANGED");
      }
      await tx
        .insert(auditEvents)
        .values({
          id: input.auditId,
          actorId: input.actorId,
          actorType: actor.role === "admin" ? "admin" : "user",
          action: "build.review_artifact_download_started",
          targetId: build.id,
          targetType: "build",
          details: { productId: build.productId, version: build.version },
        });
    });
  }
}
export const buildReviewDownloadRepository = new BuildReviewDownloadRepository();
