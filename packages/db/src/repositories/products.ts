import { eq, desc, asc, and, gte, lte, ilike, or, sql, inArray, ne } from "drizzle-orm";
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
  limit?: number;
}

export class ProductRepository {
  async list(options: ProductQueryOptions = {}): Promise<Product[]> {
    const conditions = [eq(products.status, "published")];
    if (options.type) conditions.push(eq(products.type, options.type));
    if (options.featuredOnly) conditions.push(eq(products.isFeatured, true));
    if (options.minPrice !== undefined) conditions.push(gte(products.price, options.minPrice));
    if (options.maxPrice !== undefined) conditions.push(lte(products.price, options.maxPrice));
    if (options.query?.trim()) {
      const pattern = `%${options.query.trim()}%`;
      conditions.push(or(
        ilike(products.title, pattern),
        ilike(products.description, pattern),
        sql`${products.tags}::text ILIKE ${pattern}`
      )!);
    }

    const order = options.sort === "popular"
      ? desc(products.salesCount)
      : options.sort === "rating"
        ? desc(products.ratingAverage)
        : options.sort === "price_asc"
          ? asc(products.price)
          : options.sort === "price_desc"
            ? desc(products.price)
            : desc(products.createdAt);
    const limit = options.limit === undefined || !Number.isFinite(options.limit)
      ? 100
      : Math.min(Math.max(Math.floor(options.limit), 1), 100);

    const rows = await db
      .select()
      .from(products)
      .where(and(...conditions))
      .orderBy(order)
      .limit(limit);
    return rows as unknown as Product[];
  }

  async findById(id: string): Promise<Product | null> {
        const rows = await db.select().from(products).where(eq(products.id, id)).limit(1);
    return (rows[0] as unknown as Product) || null;
  }

  async findBySlug(slug: string): Promise<Product | null> {
        const rows = await db.select().from(products).where(eq(products.slug, slug)).limit(1);
    return (rows[0] as unknown as Product) || null;
  }

  async findPublishedFreeBySlugs(slugs: readonly string[]): Promise<Product[]> {
    const normalized = Array.from(
      new Set(
        slugs
          .map((slug) => slug.trim().toLowerCase())
          .filter(Boolean),
      ),
    ).slice(0, 25);
    if (normalized.length === 0) return [];

    const rows = await db
      .select()
      .from(products)
      .where(
        and(
          inArray(products.slug, normalized),
          eq(products.status, "published"),
          eq(products.price, 0),
        ),
      )
      .limit(25);
    return rows as unknown as Product[];
  }

  async listPublishedFreeDependingOnSlug(
    dependencySlug: string,
    limit = 51,
  ): Promise<Product[]> {
    const normalized = dependencySlug.trim().toLowerCase();
    if (!normalized) return [];

    const boundedLimit = Number.isFinite(limit)
      ? Math.min(Math.max(Math.floor(limit), 1), 51)
      : 51;

    const rows = await db
      .select()
      .from(products)
      .where(
        and(
          eq(products.status, "published"),
          eq(products.price, 0),
          ne(products.slug, normalized),
          sql`coalesce(${products.compatibility}->'dependencies', '[]'::jsonb) @> ${JSON.stringify([normalized])}::jsonb`,
        ),
      )
      .orderBy(desc(products.updatedAt))
      .limit(boundedLimit);
    return rows as unknown as Product[];
  }

  async create(data: Omit<Product, "createdAt" | "updatedAt">): Promise<Product> {
    const values = {
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

        const rows = await db.insert(products).values(values).returning();
    return rows[0] as unknown as Product;
  }

  async update(id: string, updates: Partial<Product>): Promise<Product | null> {
        const rows = await db
      .update(products)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return (rows[0] as unknown as Product) || null;
  }
}

export const productRepository = new ProductRepository();
