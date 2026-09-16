import { eq, desc, asc, and } from "drizzle-orm";
import { db } from "../client";
import { products } from "../schema";
import type { Product, ProductType } from "@nexus/domain";

export interface ProductQueryOptions {
  type?: ProductType;
  featuredOnly?: boolean;
  minPrice?: number;
  maxPrice?: number;
  sort?: "popular" | "newest" | "price_asc" | "price_desc" | "rating" | "relevance";
  query?: string;
}

export class ProductRepository {
  async list(options: ProductQueryOptions = {}): Promise<Product[]> {
    try {
      let query = db.select().from(products);
      const rows = await query;
      let items = (rows as unknown as Product[]).filter((p) => p.status === "published");

      if (options.type) {
        items = items.filter((p) => p.type === options.type);
      }
      if (options.featuredOnly) {
        items = items.filter((p) => p.isFeatured);
      }
      if (options.minPrice !== undefined) {
        items = items.filter((p) => p.price >= options.minPrice!);
      }
      if (options.maxPrice !== undefined) {
        items = items.filter((p) => p.price <= options.maxPrice!);
      }
      if (options.query) {
        const q = options.query.toLowerCase();
        items = items.filter(
          (p) =>
            p.title.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q) ||
            p.tags.some((t) => t.toLowerCase().includes(q))
        );
      }

      // Sort
      items.sort((a, b) => {
        if (options.sort === "popular") return b.salesCount - a.salesCount;
        if (options.sort === "rating") return b.ratingAverage - a.ratingAverage;
        if (options.sort === "price_asc") return a.price - b.price;
        if (options.sort === "price_desc") return b.price - a.price;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      return items;
    } catch {
      return [];
    }
  }

  async findById(id: string): Promise<Product | null> {
    try {
      const rows = await db.select().from(products).where(eq(products.id, id)).limit(1);
      return (rows[0] as unknown as Product) || null;
    } catch {
      return null;
    }
  }

  async findBySlug(slug: string): Promise<Product | null> {
    try {
      const rows = await db.select().from(products).where(eq(products.slug, slug)).limit(1);
      return (rows[0] as unknown as Product) || null;
    } catch {
      return null;
    }
  }

  async create(data: Omit<Product, "createdAt" | "updatedAt">): Promise<Product> {
    const values = {
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      const rows = await db.insert(products).values(values).returning();
      return rows[0] as unknown as Product;
    } catch {
      return values as unknown as Product;
    }
  }

  async update(id: string, updates: Partial<Product>): Promise<Product | null> {
    try {
      const rows = await db
        .update(products)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(products.id, id))
        .returning();
      return (rows[0] as unknown as Product) || null;
    } catch {
      return null;
    }
  }
}

export const productRepository = new ProductRepository();
