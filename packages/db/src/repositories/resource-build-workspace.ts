import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  AppError,
  NotFoundError,
  resourceBuildTargetStatus,
  type BuildStatus,
  type ResourceBuildCommand,
  type ResourceBuildView,
} from "@nexus/domain";
import { db } from "../client";
import { auditEvents, builds, products } from "../schema";
import { safePublishedBuildCondition, trustedCleanScanCondition } from "./build-safety";
import {
  assertBuildModerationAuthority,
  assertProductMutationAuthority,
} from "./product-mutation-authority";
import type { ResourceTransaction } from "./entitlements";
const buildProjection = {
  id: builds.id,
  productId: builds.productId,
  version: builds.version,
  status: builds.status,
  revision: builds.revision,
  releaseNotes: builds.releaseNotes,
  mtaVersionTarget: builds.mtaVersionTarget,
  fileName: builds.fileName,
  fileSizeBytes: builds.fileSizeBytes,
  sha256Hash: builds.sha256Hash,
  scanStatus: builds.scanStatus,
  scanner: builds.scanner,
  scannedAt: builds.scannedAt,
  isSigned: builds.isSigned,
  createdAt: builds.createdAt,
};
const historyActions = [
  "build.submitted_for_review",
  "build.approved",
  "build.rejected",
  "build.retired",
  "build.quarantined",
  "build.quarantine_restored",
  "build.metadata_saved",
  "build.review_withdrawn",
  "build.review_resubmitted",
];
async function lockProduct(
  tx: ResourceTransaction,
  productId: string,
  actorId: string,
  staff: boolean,
) {
  const [product] = await tx
    .select({
      id: products.id,
      title: products.title,
      slug: products.slug,
      status: products.status,
      authorId: products.authorId,
      organizationId: products.organizationId,
    })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1)
    .for("no key update");
  if (!product) throw new NotFoundError("Resource", productId);
  if (staff) await assertBuildModerationAuthority(tx, actorId);
  else await assertProductMutationAuthority(tx, product, actorId);
  return product;
}
/** Product -> live management grant -> build; shares the upload/moderation lock order. */
export class ResourceBuildWorkspaceRepository {
  async detail(productId: string, buildId: string, actorId: string, staff = false) {
    return db.transaction(async (tx) => {
      const product = await lockProduct(tx, productId, actorId, staff);
      const [build] = await tx
        .select(buildProjection)
        .from(builds)
        .where(and(eq(builds.productId, productId), eq(builds.id, buildId)))
        .limit(1)
        .for("share");
      if (!build) throw new NotFoundError("Build", buildId);
      const history = await tx
        .select({
          id: auditEvents.id,
          action: auditEvents.action,
          reason: sql<
            string | null
          >`coalesce(${auditEvents.details}->>'reason', ${auditEvents.details}->>'notes')`,
          createdAt: auditEvents.createdAt,
        })
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.targetType, "build"),
            eq(auditEvents.targetId, buildId),
            inArray(auditEvents.action, historyActions),
          ),
        )
        .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
        .limit(20);
      return {
        product: {
          id: product.id,
          title: product.title,
          slug: product.slug,
          status: product.status,
        },
        build: build as ResourceBuildView,
        history,
      };
    });
  }
  async command(input: {
    productId: string;
    buildId: string;
    actorId: string;
    auditId: string;
    command: ResourceBuildCommand;
  }) {
    return db.transaction(async (tx) => {
      const product = await lockProduct(tx, input.productId, input.actorId, false);
      const [current] = await tx
        .select(buildProjection)
        .from(builds)
        .where(and(eq(builds.productId, product.id), eq(builds.id, input.buildId)))
        .limit(1)
        .for("update");
      if (!current) throw new NotFoundError("Build", input.buildId);
      if (current.revision !== input.command.expectedRevision)
        throw new AppError(
          "Build changed; reload before continuing",
          409,
          "BUILD_REVISION_CONFLICT",
        );
      const status = resourceBuildTargetStatus(current.status as BuildStatus, input.command.action);
      if (!status)
        throw new AppError("Action unavailable in this state", 409, "BUILD_TRANSITION_INVALID");
      if (
        (input.command.action === "save" || input.command.action === "submit") &&
        (product.status === "archived" || product.status === "suspended")
      )
        throw new AppError("Resource is withdrawn", 409, "PRODUCT_STATE_CHANGED");
      const metadata =
        input.command.action === "save"
          ? {
              releaseNotes: input.command.releaseNotes || null,
              mtaVersionTarget: input.command.mtaVersionTarget || null,
            }
          : {};
      if (
        input.command.action === "save" &&
        current.status === "draft" &&
        current.releaseNotes === metadata.releaseNotes &&
        current.mtaVersionTarget === metadata.mtaVersionTarget
      )
        return current as ResourceBuildView;
      const [updated] = await tx
        .update(builds)
        .set({ status, ...metadata })
        .where(
          and(
            eq(builds.id, current.id),
            eq(builds.productId, product.id),
            eq(builds.revision, input.command.expectedRevision),
            eq(builds.status, current.status),
            input.command.action === "submit" ? trustedCleanScanCondition() : undefined,
          ),
        )
        .returning(buildProjection);
      if (!updated)
        throw new AppError(
          "A provenance-backed clean scan is required",
          422,
          "BUILD_SCAN_NOT_CLEAN",
        );
      if (
        status !== current.status &&
        product.status !== "archived" &&
        product.status !== "suspended"
      ) {
        const [published] = await tx
          .select({ version: builds.version })
          .from(builds)
          .where(safePublishedBuildCondition(product.id))
          .orderBy(desc(builds.createdAt), desc(builds.id))
          .limit(1);
        const [pending] = await tx
          .select({ version: builds.version })
          .from(builds)
          .where(and(eq(builds.productId, product.id), eq(builds.status, "pending_review")))
          .orderBy(desc(builds.createdAt), desc(builds.id))
          .limit(1);
        await tx
          .update(products)
          .set({
            status: published ? "published" : pending ? "pending_review" : "draft",
            ...(published || pending ? { currentVersion: (published ?? pending).version } : {}),
            updatedAt: sql`greatest(date_trunc('milliseconds', clock_timestamp()), ${products.updatedAt} + interval '1 millisecond')`,
          })
          .where(eq(products.id, product.id));
      }
      const action = {
        save: "build.metadata_saved",
        withdraw: "build.review_withdrawn",
        submit: "build.review_resubmitted",
        retire: "build.retired",
      }[input.command.action];
      await tx
        .insert(auditEvents)
        .values({
          id: input.auditId,
          actorId: input.actorId,
          actorType: "user",
          action,
          targetType: "build",
          targetId: current.id,
          details: {
            productId: product.id,
            version: current.version,
            previousStatus: current.status,
            status,
            previousRevision: current.revision,
            revision: updated.revision,
            ...(input.command.action !== "save"
              ? { reason: input.command.reason }
              : { fields: ["releaseNotes", "mtaVersionTarget"] }),
          },
        });
      return updated as ResourceBuildView;
    });
  }
}
export const resourceBuildWorkspaceRepository = new ResourceBuildWorkspaceRepository();
