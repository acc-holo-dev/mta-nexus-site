import { productRepository, buildRepository, auditRepository } from "@nexus/db";
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
}

export class ProductService {
  async listProducts(filters: ProductFilters = {}): Promise<Product[]> {
    return productRepository.list({
      type: filters.type,
      featuredOnly: filters.featuredOnly,
      minPrice: 0,
      maxPrice: 0,
      sort: filters.sort,
      query: filters.query,
    });
  }

  async getProductBySlug(slug: string): Promise<Product | null> {
    const product = await productRepository.findBySlug(slug);
    return product?.price === 0 ? product : null;
  }

  async getProductById(id: string): Promise<Product | null> {
    const product = await productRepository.findById(id);
    return product?.price === 0 ? product : null;
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

  async releaseBuild(
    input: {
      productId: string;
      version: string;
      releaseNotes?: string;
      storageKey: string;
      sha256Hash: string;
      fileSizeBytes: number;
      fileName: string;
      mimeType: string;
    },
    actor: User
  ): Promise<Build> {
    const product = await productRepository.findById(input.productId);
    if (!product) throw new NotFoundError("Product", input.productId);
    if (product.price !== 0) {
      throw new AppError(
        "Build releases for paid resources are disabled during the closed beta",
        422,
        "PAID_RESOURCES_DISABLED"
      );
    }

    if (!can(actor, "build.release", product)) {
      throw new ForbiddenError("Not authorized to publish builds for this product");
    }

    const hasPublishedBuild = (await buildRepository.listByProduct(product.id)).some(
      (candidate) => candidate.status === "published"
    );

    const buildId = generateId("bld");
    const build = await buildRepository.create({
      id: buildId,
      productId: input.productId,
      version: input.version,
      releaseNotes: input.releaseNotes,
      status: "pending_review",
      storageKey: input.storageKey,
      sha256Hash: input.sha256Hash,
      fileSizeBytes: input.fileSizeBytes,
      fileName: input.fileName,
      mimeType: input.mimeType,
      // Signing is a separate release-pipeline step; never claim a user upload is signed.
      isSigned: false,
    });

    if (!hasPublishedBuild) {
      await productRepository.update(product.id, {
        currentVersion: input.version,
        status: "pending_review",
      });
    }

    await auditRepository.record({
      id: generateId("aud"),
      actorId: actor.id,
      actorType: "user",
      action: "build.submitted_for_review",
      targetId: buildId,
      targetType: "build",
      details: { productId: product.id, version: input.version },
    });

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

    const status = input.decision === "approve" ? "published" : "rejected";
    const reviewed = await buildRepository.updateStatus(build.id, status);
    if (!reviewed) throw new NotFoundError("Build", build.id);

    if (input.decision === "approve") {
      await productRepository.update(product.id, {
        currentVersion: build.version,
        status: "published",
      });
    } else {
      const fallback = (await buildRepository.listByProduct(product.id)).find(
        (candidate) => candidate.id !== build.id && candidate.status === "published"
      );
      await productRepository.update(product.id, fallback
        ? { currentVersion: fallback.version, status: "published" }
        : { status: "draft" }
      );
    }

    await auditRepository.record({
      id: generateId("aud"),
      actorId: actor.id,
      actorType: actor.role === "admin" ? "admin" : "user",
      action: input.decision === "approve" ? "build.approved" : "build.rejected",
      targetId: build.id,
      targetType: "build",
      details: { productId: product.id, version: build.version, notes: input.notes },
    });

    return reviewed;
  }

  async retireBuild(
    input: { productId: string; buildId: string; reason?: string },
    actor: User
  ): Promise<Build> {
    const product = await productRepository.findById(input.productId);
    if (!product) throw new NotFoundError("Product", input.productId);
    if (!can(actor, "build.retire", product)) {
      throw new ForbiddenError("Not authorized to retire builds for this product");
    }

    const build = await buildRepository.findById(input.buildId);
    if (!build || build.productId !== product.id) {
      throw new NotFoundError("Build", input.buildId);
    }
    if (build.status === "retired") {
      throw new AppError("This build is already retired", 409, "BUILD_ALREADY_RETIRED");
    }

    const retired = await buildRepository.updateStatus(build.id, "retired");
    if (!retired) throw new NotFoundError("Build", input.buildId);

    const remainingPublished = (await buildRepository.listByProduct(product.id)).find(
      (candidate) => candidate.id !== build.id && candidate.status === "published"
    );
    await productRepository.update(product.id, remainingPublished
      ? { currentVersion: remainingPublished.version }
      : { status: "draft" }
    );

    await auditRepository.record({
      id: generateId("aud"),
      actorId: actor.id,
      actorType: actor.role === "admin" ? "admin" : "user",
      action: "build.retired",
      targetId: build.id,
      targetType: "build",
      details: { productId: product.id, version: build.version, reason: input.reason },
    });

    return retired;
  }

}

export const productService = new ProductService();
