import { productRepository, buildRepository, auditRepository } from "@nexus/db";
import { generateId, can } from "@nexus/security";
import { NotFoundError, ForbiddenError, eventBus } from "@nexus/domain";
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
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      sort: filters.sort,
      query: filters.query,
    });
  }

  async getProductBySlug(slug: string): Promise<Product | null> {
    return productRepository.findBySlug(slug);
  }

  async getProductById(id: string): Promise<Product | null> {
    return productRepository.findById(id);
  }

  async getProductBuilds(productId: string): Promise<Build[]> {
    return buildRepository.listByProduct(productId);
  }

  async createProduct(
    input: Omit<Product, "id" | "ratingAverage" | "ratingCount" | "salesCount" | "createdAt" | "updatedAt">,
    actor: User
  ): Promise<Product> {
    if (!can(actor, "product.create")) {
      throw new ForbiddenError("You must have developer privileges to create products");
    }

    const id = generateId("prd");
    const product = await productRepository.create({
      ...input,
      id,
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
      isSigned: true,
    });

    await productRepository.update(product.id, {\n      currentVersion: input.version,\n      status: "published",\n    });

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
