import { productRepository, buildRepository, auditRepository, organizationRepository } from "@nexus/db";
import { generateId, can } from "@nexus/security";
import { AppError, NotFoundError, ForbiddenError, eventBus } from "@nexus/domain";
import type { Product, Build, User, ProductType } from "@nexus/domain";

export interface ProductFilters {
  query?: string;
  type?: ProductType;
  tags?: string[];
  minPrice?: number;
  maxPrice?: number;
  sort?: "popular" | "newest" | "price_asc" | "price_desc" | "rating" | "relevance";
  featuredOnly?: boolean;
  limit?: number;
}

export class ProductService {
  async canManageProduct(
    product: Product,
    actor: User,
    action: "product.update" | "build.release" | "build.retire" = "product.update",
  ): Promise<boolean> {
    if (can(actor, action, product)) return true;
    if (!product.organizationId) return false;

    const [organization, organizationMemberships] = await Promise.all([
      organizationRepository.findById(product.organizationId),
      organizationRepository.listUserMemberships(actor.id),
    ]);

    if (organization?.ownerId === actor.id) return true;

    return can(actor, action, product, {
      organizationMemberships,
    });
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
    });
  }

  async getProductBySlug(slug: string): Promise<Product | null> {
    const product = await productRepository.findBySlug(slug);
    return product?.price === 0 && product.status === "published" ? product : null;
  }

  async getProductPreviewBySlug(slug: string, actor: User | null): Promise<Product | null> {
    const product = await productRepository.findBySlug(slug);
    if (!product || product.price !== 0) return null;
    if (product.status === "published") return product;
    if (!actor) return null;

    return (await this.canManageProduct(product, actor))
      ? product
      : null;
  }

  async getProductById(id: string): Promise<Product | null> {
    const product = await productRepository.findById(id);
    return product?.price === 0 && product.status === "published" ? product : null;
  }

  async getProductBuilds(productId: string, includeNonPublic = false): Promise<Build[]> {
    return includeNonPublic
      ? buildRepository.listByProduct(productId)
      : buildRepository.listPublishedByProduct(productId);
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
      const canManageOrganization =
        organization.ownerId === actor.id ||
        membership?.role === "owner" ||
        membership?.role === "admin" ||
        membership?.role === "developer";

      if (!canManageOrganization) {
        throw new ForbiddenError("You do not manage this organization");
      }
    }

    const id = generateId("prd");
    const product = await productRepository.create({
      ...input,
      id,
      price: 0,
      currency: "USD",
      licenseModel: "unlimited",
      ratingAverage: 0,
      ratingCount: 0,
      salesCount: 0,
    });

    await auditRepository.record({
      id: generateId("aud"),
      actorId: actor.id,
      actorType: "user",
      action: "product.created",
      targetId: id,
      targetType: "product",
      details: { title: product.title, price: product.price },
    });

    await eventBus.publish({
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
    });

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
    return product;
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
      if ((error as { code?: string }).code === "23505") {
        throw new AppError(
          "This resource version already exists",
          409,
          "BUILD_VERSION_EXISTS"
        );
      }
      throw error;
    }

    await eventBus.publish({
      id: generateId("evt"),
      type: "build.released",
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
    });

    return build;
  }
  async reviewBuild(
    input: { buildId: string; decision: "approve" | "reject"; notes?: string },
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

    const product = await productRepository.findById(build.productId);
    if (!product) throw new NotFoundError("Product", build.productId);
    if (input.decision === "approve" && build.scanStatus !== "clean") {
      throw new AppError(
        "Only a clean malware scan can be approved",
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
      details: { productId: product.id, version: build.version, notes: input.notes },
    });
    if (!reviewed) {
      throw new AppError(
        "Build state changed before moderation completed",
        409,
        "BUILD_STATE_CHANGED"
      );
    }

    return reviewed;
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
