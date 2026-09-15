import { store } from "./store";
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
    let items = Array.from(store.products.values()).filter((p) => p.status === "published");

    if (filters.query) {
      const q = filters.query.toLowerCase();
      items = items.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    if (filters.type) {
      items = items.filter((p) => p.type === filters.type);
    }

    if (filters.featuredOnly) {
      items = items.filter((p) => p.isFeatured);
    }

    if (filters.minPrice !== undefined) {
      items = items.filter((p) => p.price >= filters.minPrice!);
    }

    if (filters.maxPrice !== undefined) {
      items = items.filter((p) => p.price <= filters.maxPrice!);
    }

    // Deterministic Sorting
    items.sort((a, b) => {
      if (filters.sort === "popular") return b.salesCount - a.salesCount;
      if (filters.sort === "rating") return b.ratingAverage - a.ratingAverage;
      if (filters.sort === "price_asc") return a.price - b.price;
      if (filters.sort === "price_desc") return b.price - a.price;
      // Default: newest
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return items;
  }

  async getProductBySlug(slug: string): Promise<Product | null> {
    return Array.from(store.products.values()).find((p) => p.slug === slug) || null;
  }

  async getProductById(id: string): Promise<Product | null> {
    return store.products.get(id) || null;
  }

  async getProductBuilds(productId: string): Promise<Build[]> {
    return Array.from(store.builds.values()).filter((b) => b.productId === productId);
  }

  async createProduct(
    input: Omit<Product, "id" | "ratingAverage" | "ratingCount" | "salesCount" | "createdAt" | "updatedAt">,
    actor: User
  ): Promise<Product> {
    if (!can(actor, "product.create")) {
      throw new ForbiddenError("You must have developer privileges to create products");
    }

    const id = generateId("prd");
    const product: Product = {
      ...input,
      id,
      ratingAverage: 0,
      ratingCount: 0,
      salesCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    store.products.set(id, product);

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
    const product = store.products.get(input.productId);
    if (!product) throw new NotFoundError("Product", input.productId);

    if (!can(actor, "build.release", product)) {
      throw new ForbiddenError("Not authorized to publish builds for this product");
    }

    const buildId = generateId("bld");
    const build: Build = {
      id: buildId,
      productId: input.productId,
      version: input.version,
      releaseNotes: input.releaseNotes,
      status: "published",
      storageKey: input.storageKey,
      sha256Hash: input.sha256Hash,
      fileSizeBytes: input.fileSizeBytes,
      isSigned: true,
      createdAt: new Date(),
    };

    store.builds.set(buildId, build);

    product.currentVersion = input.version;
    product.updatedAt = new Date();
    store.products.set(product.id, product);

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
