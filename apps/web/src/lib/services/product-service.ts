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

  async getProductBuilds(productId: string): Promise<Build[]> {
    return buildRepository.listByProduct(productId);
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

    const buildId = generateId("bld");
    const build = await buildRepository.create({
      id: buildId,
      productId: input.productId,
      version: input.version,
      releaseNotes: input.releaseNotes,
      status: "published",
      storageKey: input.storageKey,
      sha256Hash: input.sha256Hash,
      fileSizeBytes: input.fileSizeBytes,
      // Signing is a separate release-pipeline step; never claim a user upload is signed.
      isSigned: false,
    });

    await productRepository.update(product.id, {
      currentVersion: input.version,
      status: "published",
    });

    await auditRepository.record({
      id: generateId("aud"),
      actorId: actor.id,
      actorType: "user",
      action: "build.released",
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
}

export const productService = new ProductService();
