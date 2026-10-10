import { and, eq, gt, isNull, or } from "drizzle-orm";
import { AppError, ForbiddenError, NotFoundError, type Build } from "@nexus/domain";
import { db } from "../client";
import { auditEvents, builds, entitlements, licenses, products, users } from "../schema";
import { assertProductMutationAuthority } from "./product-mutation-authority";

export class ResourceDownloadAuthorizationRepository {
  /** Final gate after opening storage. Locks live access and exact build evidence
   * through the start audit; revocation denies subsequent transfers. */
  async authorize(input: { actorId: string; auditId: string; expected: Build; pinned: boolean }) {
    return db.transaction(async (tx) => {
      const [product] = await tx
        .select({
          id: products.id,
          slug: products.slug,
          status: products.status,
          authorId: products.authorId,
          organizationId: products.organizationId,
        })
        .from(products)
        .where(eq(products.id, input.expected.productId))
        .limit(1)
        .for("share");
      if (product?.status !== "published")
        throw new NotFoundError("Resource", input.expected.productId);
      let accessSource: "manager" | "entitlement" | "license" = "manager";
      let actorRole = "user";
      let accessExpiresAt: Date | null = null;
      try {
        const actor = await assertProductMutationAuthority(tx, product, input.actorId);
        actorRole = actor.role;
      } catch (error) {
        if (!(error instanceof NotFoundError)) throw error;
        // An expired session/user or a cached admin role cannot authorize a file.
        const [actor] = await tx
          .select({ role: users.role })
          .from(users)
          .where(eq(users.id, input.actorId))
          .limit(1)
          .for("share");
        if (!actor) throw new ForbiddenError("Current download access is required");
        actorRole = actor.role;
        const now = new Date();
        const [grant] = await tx
          .select({ id: entitlements.id, expiresAt: entitlements.expiresAt })
          .from(entitlements)
          .where(
            and(
              eq(entitlements.subjectType, "user"),
              eq(entitlements.subjectId, input.actorId),
              eq(entitlements.resourceId, product.id),
              eq(entitlements.permission, "product.download"),
              or(isNull(entitlements.expiresAt), gt(entitlements.expiresAt, now)),
            ),
          )
          .limit(1)
          .for("share");
        if (grant) {
          accessSource = "entitlement";
          accessExpiresAt = grant.expiresAt;
        } else {
          const [license] = await tx
            .select({ id: licenses.id, expiresAt: licenses.expiresAt })
            .from(licenses)
            .where(
              and(
                eq(licenses.userId, input.actorId),
                eq(licenses.productId, product.id),
                eq(licenses.status, "active"),
                or(isNull(licenses.expiresAt), gt(licenses.expiresAt, new Date())),
              ),
            )
            .limit(1)
            .for("share");
          if (!license) throw new ForbiddenError("Current download access is required");
          accessSource = "license";
          accessExpiresAt = license.expiresAt;
        }
      }
      const [build] = await tx
        .select()
        .from(builds)
        .where(eq(builds.id, input.expected.id))
        .limit(1)
        .for("share");
      const expected = input.expected;
      if (
        !build ||
        build.productId !== product.id ||
        build.status !== "published" ||
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
      )
        throw new AppError("Build changed; reload before downloading", 409, "BUILD_STATE_CHANGED");
      if (accessExpiresAt && new Date(accessExpiresAt).getTime() <= Date.now())
        throw new ForbiddenError("Current download access is required");
      await tx
        .insert(auditEvents)
        .values({
          id: input.auditId,
          actorId: input.actorId,
          actorType: actorRole === "admin" ? "admin" : "user",
          action: "product.download_started",
          targetId: product.id,
          targetType: "product",
          details: {
            buildId: build.id,
            version: build.version,
            pinned: input.pinned,
            accessSource,
          },
        });
      return { slug: product.slug };
    });
  }
}
export const resourceDownloadAuthorizationRepository =
  new ResourceDownloadAuthorizationRepository();
