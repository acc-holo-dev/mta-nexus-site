import { productRepository, buildRepository, organizationRepository, productLifecycleRepository } from "@nexus/db";
import { generateId, can } from "@nexus/security";
import { AppError, NotFoundError, ForbiddenError, eventBus } from "@nexus/domain";
import type { Product, Build, User, ProductType, NexusDomainEvent, ResourceLifecycleAction } from "@nexus/domain";
import { buildProductDependencyResolution } from "../product-dependency-resolution";
import { buildReverseDependencySummary, reverseDependencyLimits } from "../reverse-dependency-summary";
import { isUniqueConstraintViolation } from "../postgres-error";

/**
 * The database mutation and audit are already durable before the event
 * notification. A delivery failure must not cause callers to delete assets
 * still referenced by the newly persisted build or retry the entire write.
 */
async function publishCommittedEvent(factory: () => NexusDomainEvent): Promise<void> {
  let event: NexusDomainEvent | undefined;
  try {
    event = factory();
    await eventBus.publish(event);
  } catch {
    console.error("Nexus committed write succeeded but event dispatch failed", {
      eventType: event?.type ?? "unknown",
      aggregateType: event?.aggregateType ?? "unknown",
      aggregateId: event?.aggregateId ?? "unknown",
    });
  }
}

export interface ProductFilters {
  query?: string;
  type?: ProductType;
  tags?: string[];
  minPrice?: number;
  maxPrice?: number;
  sort?: "popular" | "newest" | "price_asc" | "price_desc" | "rating" | "relevance";
  featuredOnly?: boolean;
  limit?: number;
  offset?: number;
}

export class ProductService {
  async transitionResource(
    productId: string,
    input: { action: ResourceLifecycleAction; expectedUpdatedAt: string; reason: string },
    actor: User,
  ) {
    return productLifecycleRepository.transition({
      productId,
      actorId: actor.id,
      action: input.action,
      expectedUpdatedAt: new Date(input.expectedUpdatedAt),
      reason: input.reason,
      auditId: generateId("aud"),
    });
  }

  async getResourceLifecycleHistory(productId: string, actor: User) {
    if (!(await this.getManagedProduct(productId, actor)))
      throw new NotFoundError("Product", productId);
    return productLifecycleRepository.history(productId, actor);
  }


  async listManagedProducts(actor: User, status?: Product["status"], page = 1) {
    return productRepository.pageManaged(actor, status, page);
  }

  async getManagedProduct(id: string, actor: User) {
    return productRepository.findManaged(id, actor);
  }

  async getManagedHistory(id: string, actor: User, page = 1) {
    const product = await this.getManagedProduct(id, actor);
    if (!product) throw new NotFoundError("Product", id);
    return buildRepository.pageHistory(product.id, page);
  }

  async updateProductDetails(id: string,
    details: Pick<Product, "title" | "shortDescription" | "description" | "tags">, actor: User, expectedUpdatedAt?: Date) {
    const product = await productRepository.updateManagedDetails(id, actor, details, {
      id: generateId("aud"), actorId: actor.id, actorType: actor.role === "admin" ? "admin" : "user",
      action: "product.details_updated", targetId: id, targetType: "product",
      details: { fields: ["title", "shortDescription", "description", "tags"] },
    }, expectedUpdatedAt);
    if (!product) {
      // Reveal a revision conflict only while the actor still has management access.
      if (expectedUpdatedAt && await productRepository.findManaged(id, actor)) {
        throw new AppError("Resource details changed; reload before saving", 409, "PRODUCT_METADATA_CONFLICT");
      }
      throw new NotFoundError("Product", id);
    }
    return product;
  }

  async canManageProduct(
    product: Product,
    actor: User,
    _action: "product.update" | "build.release" | "build.retire" = "product.update",
  ): Promise<boolean> {
    return productRepository.hasManagementAccess(product.id, actor);
  }

  async listProducts(filters: ProductFilters = {}): Promise<Product[]> {
    return productRepository.list({
      type: filters.type,
      featuredOnly: filters.featuredOnly,
      minPrice: 0,
      maxPrice: 0,
      sort: filters.sort,
      query: filters.query,
      limit: filters.limit,
      offset: filters.offset,
    });
  }

  async listPublicPage(filters: Omit<ProductFilters, "limit" | "offset"> & {
    page: number;
    pageSize: number;
  }): Promise<{ products: Product[]; hasMore: boolean }> {
    const pageSize = Number.isFinite(filters.pageSize)
      ? Math.min(Math.max(Math.floor(filters.pageSize), 1), 100)
      : 24;
    const page = Number.isFinite(filters.page)
      ? Math.min(Math.max(Math.floor(filters.page), 1), 1000)
      : 1;
    const rows = await this.listProducts({
      ...filters,
      limit: pageSize + 1,
      offset: (page - 1) * pageSize,
    });
    return { products: rows.slice(0, pageSize), hasMore: rows.length > pageSize };
  }

  async getProductBySlug(slug: string): Promise<Product | null> {
    const product = await productRepository.findBySlug(slug);
    if (product?.price !== 0 || product.status !== "published") {
      return null;
    }
    const build = await buildRepository.findLatestPublishedByProduct(product.id);
    return build ? product : null;
  }

  async getProductPreviewBySlug(slug: string, actor: User | null): Promise<Product | null> {
    const product = await productRepository.findBySlug(slug);
    if (product?.price !== 0) return null;
    if (product.status === "published") return product;
    if (!actor) return null;

    return (await this.canManageProduct(product, actor))
      ? product
      : null;
  }

  async getProductById(id: string): Promise<Product | null> {
    const product = await productRepository.findById(id);
    if (product?.price !== 0 || product.status !== "published") {
      return null;
    }
    const build = await buildRepository.findLatestPublishedByProduct(product.id);
    return build ? product : null;
  }

  async getProductBuilds(productId: string, includeNonPublic = false): Promise<Build[]> {
    return includeNonPublic
      ? buildRepository.listByProduct(productId)
      : buildRepository.listPublishedByProduct(productId);
  }

  async getDependencyResolution(
    product: Pick<Product, "slug" | "compatibility">,
  ) {
    const declared = product.compatibility.dependencies ?? [];
    if (declared.length === 0) {
      return buildProductDependencyResolution(product, []);
    }

    const publishedDependencies =
      await productRepository.findPublishedFreeBySlugs(declared);
    return buildProductDependencyResolution(
      product,
      publishedDependencies,
    );
  }

  async getReverseDependencySummary(productSlug: string) {
    const dependents =
      await productRepository.listPublishedFreeDependingOnSlug(
        productSlug,
        reverseDependencyLimits.query,
      );
    return buildReverseDependencySummary(productSlug, dependents);
  }

  async createProduct(
    input: Omit<Product, "id" | "ratingAverage" | "ratingCount" | "salesCount" | "createdAt" | "updatedAt">,
    actor: User
  ): Promise<Product> {
    if (input.price !== 0) {
      throw new AppError(
        "Paid resources are disabled during the closed beta",
        422,
        "PAID_RESOURCES_DISABLED"
      );
    }

    if (!can(actor, "product.create")) {
      throw new ForbiddenError("You must have developer privileges to create products");
    }

    if (input.organizationId) {
      const organization = await organizationRepository.findById(input.organizationId);
      if (!organization) throw new NotFoundError("Organization", input.organizationId);

      const memberships = await organizationRepository.listUserMemberships(actor.id);
      const membership = memberships.find((item) => item.organizationId === input.organizationId);
      const canManageProducts =
        organization.ownerId === actor.id ||
        membership?.role === "owner" ||
        membership?.role === "admin" ||
        membership?.permissions.includes("manage_products");

      if (!canManageProducts) {
        throw new ForbiddenError(
          "You do not have permission to create resources for this organization",
        );
      }
    }

    const id = generateId("prd");
    const product = await productRepository.createWithAudit(
      {
        ...input,
        id,
        price: 0,
        currency: "USD",
        licenseModel: "unlimited",
        ratingAverage: 0,
        ratingCount: 0,
        salesCount: 0,
      },
      {
        id: generateId("aud"),
        actorId: actor.id,
        actorType: "user",
        action: "product.created",
        targetId: id,
        targetType: "product",
        details: { title: input.title, price: 0 },
      },
    );

    await publishCommittedEvent(() => ({
      id: generateId("evt"),
      type: "product.created",
      version: 1,
      timestamp: new Date().toISOString(),
      actor: { id: actor.id, type: "user" },
      aggregateId: id,
      aggregateType: "product",
      payload: {
        productId: id,
        title: product.title,
        authorId: actor.id,
        type: product.type,
        price: product.price,
      },
    }));

    return product;
  }

  async assertCanReleaseBuild(
    productId: string,
    actor: User,
  ): Promise<Product> {
    const product = await productRepository.findById(productId);
    if (!product) throw new NotFoundError("Product", productId);
    if (product.price !== 0) {
      throw new AppError(
        "Build releases for paid resources are disabled during the closed beta",
        422,
        "PAID_RESOURCES_DISABLED"
      );
    }
    if (!(await this.canManageProduct(product, actor, "build.release"))) {
      throw new ForbiddenError("Not authorized to publish builds for this product");
    }
    if (product.status === "archived" || product.status === "suspended") {
      throw new AppError("Restore the resource before uploading a version", 409, "PRODUCT_STATE_CHANGED");
    }
    return product;
  }

  async recoverPendingBuildUpload(
    input: Pick<Build, "productId" | "version" | "sha256Hash" | "fileSizeBytes" | "fileName" | "mimeType" | "releaseNotes" | "mtaVersionTarget">,
    actor: User,
  ): Promise<Build | null> {
    // Permissions can change while scanning or uploading; do not reuse preflight access.
    await this.assertCanReleaseBuild(input.productId, actor);
    return buildRepository.findExactPendingRetry(input);
  }

  async releaseBuild(
    input: {
      productId: string;
      version: string;
      releaseNotes?: string;
      mtaVersionTarget?: string;
      storageKey: string;
      sha256Hash: string;
      fileSizeBytes: number;
      fileName: string;
      mimeType: string;
      scanStatus: Build["scanStatus"];
      scanner?: string;
      scannedAt?: Date;
    },
    actor: User
  ): Promise<Build> {
    const product = await this.assertCanReleaseBuild(
      input.productId,
      actor,
    );

    const buildId = generateId("bld");
    const auditId = generateId("aud");
    let build: Build;
    try {
      build = await buildRepository.submitForReview(
        {
          id: buildId,
          productId: input.productId,
          version: input.version,
          releaseNotes: input.releaseNotes,
          mtaVersionTarget: input.mtaVersionTarget,
          status: "pending_review",
          storageKey: input.storageKey,
          sha256Hash: input.sha256Hash,
          fileSizeBytes: input.fileSizeBytes,
          fileName: input.fileName,
          mimeType: input.mimeType,
          scanStatus: input.scanStatus,
          scanner: input.scanner,
          scannedAt: input.scannedAt,
          // Signing is a separate release-pipeline step; never claim a user upload is signed.
          isSigned: false,
        },
        {
          id: auditId,
          actorId: actor.id,
          actorType: "user",
          action: "build.submitted_for_review",
          targetId: buildId,
          targetType: "build",
          details: { productId: product.id, version: input.version },
        }
      );
    } catch (error: unknown) {
      if (isUniqueConstraintViolation(error, ["builds_product_version_idx"])) {
        throw new AppError(
          "This resource version already exists",
          409,
          "BUILD_VERSION_EXISTS"
        );
      }
      throw error;
    }

    await publishCommittedEvent(() => ({
      id: generateId("evt"),
      type: "build.submitted_for_review",
      version: 1,
      timestamp: new Date().toISOString(),
      actor: { id: actor.id, type: "user" },
      aggregateId: buildId,
      aggregateType: "build",
      payload: {
        buildId,
        productId: product.id,
        version: input.version,
        hash: input.sha256Hash,
      },
    }));

    return build;
  }
  async reviewBuild(
    input: { buildId: string; decision: "approve" | "reject"; notes?: string; expectedRevision: number },
    actor: User
  ): Promise<Build> {
    if (!can(actor, "admin.moderation")) {
      throw new ForbiddenError("Moderator privilege is required to review builds");
    }

    const build = await buildRepository.findById(input.buildId);
    if (!build) throw new NotFoundError("Build", input.buildId);
    if (build.status !== "pending_review") {
      throw new AppError("Only pending builds can be reviewed", 409, "BUILD_NOT_PENDING_REVIEW");
    }

    if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1 || build.revision !== input.expectedRevision) {
      throw new AppError("Build changed; reload before reviewing", 409, "BUILD_REVISION_CONFLICT");
    }
    const product = await productRepository.findById(build.productId);
    if (!product) throw new NotFoundError("Product", build.productId);
    if (
      input.decision === "approve" &&
      (
        build.scanStatus !== "clean" ||
        !build.scanner?.trim() ||
        !build.scannedAt
      )
    ) {
      throw new AppError(
        "Only a provenance-backed clean malware scan can be approved",
        422,
        "BUILD_SCAN_NOT_CLEAN"
      );
    }

    const reviewed = await buildRepository.moderatePending(build.id, input.decision, {
      id: generateId("aud"),
      actorId: actor.id,
      actorType: actor.role === "admin" ? "admin" : "user",
      action: input.decision === "approve" ? "build.approved" : "build.rejected",
      targetId: build.id,
      targetType: "build",
      details: { productId: product.id, version: build.version, notes: input.notes, expectedRevision: input.expectedRevision },
    }, input.expectedRevision);
    if (!reviewed) {
      throw new AppError(
        "Build state changed before moderation completed",
        409,
        "BUILD_STATE_CHANGED"
      );
    }

    if (input.decision === "approve") {
      await publishCommittedEvent(() => ({
        id: generateId("evt"),
        type: "build.released",
        version: 1,
        timestamp: new Date().toISOString(),
        actor: { id: actor.id, type: "user" },
        aggregateId: reviewed.id,
        aggregateType: "build",
        payload: {
          buildId: reviewed.id,
          productId: reviewed.productId,
          version: reviewed.version,
          hash: reviewed.sha256Hash,
        },
      }));
    }

    return reviewed;
  }

  async quarantineBuild(
    input: { buildId: string; reason: string },
    actor: User,
  ): Promise<Build> {
    if (!can(actor, "admin.moderation")) {
      throw new ForbiddenError(
        "Moderator privilege is required to quarantine builds",
      );
    }

    const build = await buildRepository.findById(input.buildId);
    if (!build) throw new NotFoundError("Build", input.buildId);
    if (build.status !== "published") {
      throw new AppError(
        "Only a published build can enter quarantine",
        409,
        "BUILD_QUARANTINE_INVALID_STATE",
      );
    }

    const quarantined = await buildRepository.quarantinePublishedAndRefreshProduct(
      build.id,
      actor.id,
      input.reason,
      {
        id: generateId("aud"),
        actorId: actor.id,
        actorType: actor.role === "admin" ? "admin" : "user",
        action: "build.quarantined",
        targetId: build.id,
        targetType: "build",
        details: {
          productId: build.productId,
          version: build.version,
          reason: input.reason,
          previousStatus: build.status,
        },
      },
    );
    if (!quarantined) {
      throw new AppError(
        "Build state changed before quarantine completed",
        409,
        "BUILD_STATE_CHANGED",
      );
    }
    return quarantined;
  }

  async restoreQuarantinedBuild(
    input: { buildId: string; reason: string },
    actor: User,
  ): Promise<Build> {
    if (!can(actor, "admin.moderation")) {
      throw new ForbiddenError(
        "Moderator privilege is required to restore quarantined builds",
      );
    }

    const build = await buildRepository.findById(input.buildId);
    if (!build) throw new NotFoundError("Build", input.buildId);
    if (build.status !== "quarantined") {
      throw new AppError(
        "Only a quarantined build can be restored",
        409,
        "BUILD_QUARANTINE_INVALID_STATE",
      );
    }
    if (
      build.quarantinePreviousStatus !== "published" ||
      build.scanStatus !== "clean" ||
      !build.scanner?.trim() ||
      !build.scannedAt
    ) {
      throw new AppError(
        "Quarantined build is not eligible for safe publication restore",
        422,
        "BUILD_QUARANTINE_RESTORE_UNSAFE",
      );
    }

    const restored = await buildRepository.restoreQuarantinedAndRefreshProduct(
      build.id,
      {
        id: generateId("aud"),
        actorId: actor.id,
        actorType: actor.role === "admin" ? "admin" : "user",
        action: "build.quarantine_restored",
        targetId: build.id,
        targetType: "build",
        details: {
          productId: build.productId,
          version: build.version,
          reason: input.reason,
          quarantineReason: build.quarantineReason,
        },
      },
    );
    if (!restored) {
      throw new AppError(
        "Build state or safety evidence changed before restore completed",
        409,
        "BUILD_STATE_CHANGED",
      );
    }
    return restored;
  }

  async retireBuild(
    input: { productId: string; buildId: string; reason?: string },
    actor: User
  ): Promise<Build> {
    const product = await productRepository.findById(input.productId);
    if (!product) throw new NotFoundError("Product", input.productId);
    if (!(await this.canManageProduct(product, actor, "build.retire"))) {
      throw new ForbiddenError("Not authorized to retire builds for this product");
    }

    const build = await buildRepository.findById(input.buildId);
    if (!build || build.productId !== product.id) {
      throw new NotFoundError("Build", input.buildId);
    }
    if (build.status === "retired") {
      throw new AppError("This build is already retired", 409, "BUILD_ALREADY_RETIRED");
    }

    const retired = await buildRepository.retireAndRefreshProduct(build.id, build.status, {
      id: generateId("aud"),
      actorId: actor.id,
      actorType: actor.role === "admin" ? "admin" : "user",
      action: "build.retired",
      targetId: build.id,
      targetType: "build",
      details: { productId: product.id, version: build.version, reason: input.reason },
    });
    if (!retired) {
      throw new AppError("Build state changed before retirement", 409, "BUILD_STATE_CHANGED");
    }

    return retired;
  }

}

export const productService = new ProductService();
