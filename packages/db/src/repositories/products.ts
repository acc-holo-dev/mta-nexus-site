import { eq, desc, asc, and, gte, lte, ilike, or, sql, inArray, ne } from "drizzle-orm";
import { db } from "../client";
import { auditEvents, builds, products } from "../schema";
import type { AuditEvent, Product, ProductType } from "@nexus/domain";

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

  async createWithAudit(
    data: Omit<Product, "createdAt" | "updatedAt">,
    audit: Omit<AuditEvent, "createdAt">,
  ): Promise<Product> {
    return db.transaction(async (tx) => {
      const now = new Date();
      const rows = await tx
        .insert(products)
        .values({ ...data, createdAt: now, updatedAt: now })
        .returning();
      const product = rows[0];
      if (!product) throw new Error("Product insert did not return a row");

      await tx.insert(auditEvents).values({ ...audit, createdAt: now });
      return product as unknown as Product;
    });
  }

  async update(id: string, updates: Partial<Product>): Promise<Product | null> {
        const rows = await db
      .update(products)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return (rows[0] as unknown as Product) || null;
  }

  async updateWithAudit(
    id: string,
    updates: Partial<Product>,
    audit: Omit<AuditEvent, "createdAt">,
  ): Promise<Product | null> {
    return db.transaction(async (tx) => {
      const now = new Date();
      const rows = await tx
        .update(products)
        .set({ ...updates, updatedAt: now })
        .where(eq(products.id, id))
        .returning();
      const updated = rows[0];
      if (!updated) return null;

      await tx.insert(auditEvents).values({
        ...audit,
        createdAt: now,
      });
      return updated as unknown as Product;
    });
  }

  async suspendPublished(
    id: string,
    audit?: Omit<AuditEvent, "createdAt">,
  ): Promise<Product | null> {
    return db.transaction(async (tx) => {
      const now = new Date();
      const rows = await tx
        .update(products)
        .set({ status: "suspended", updatedAt: now })
        .where(
          and(
            eq(products.id, id),
            eq(products.status, "published"),
          ),
        )
        .returning();
      const suspended = rows[0];
      if (!suspended) return null;

      if (audit) {
        await tx.insert(auditEvents).values({
          ...audit,
          createdAt: now,
        });
      }
      return suspended as unknown as Product;
    });
  }

  async restoreSuspendedWithPublishedBuild(
    id: string,
    audit?: Omit<AuditEvent, "createdAt">,
  ): Promise<"restored" | "not_found" | "invalid_state" | "no_published_build"> {
    return db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: products.id, status: products.status })
        .from(products)
        .where(eq(products.id, id))
        .limit(1);
      if (!existing[0]) return "not_found" as const;
      if (existing[0].status !== "suspended") {
        return "invalid_state" as const;
      }

      const publishedBuild = await tx
        .select({ id: builds.id })
        .from(builds)
        .where(
          and(
            eq(builds.productId, id),
            eq(builds.status, "published"),
          ),
        )
        .orderBy(desc(builds.createdAt), desc(builds.id))
        .limit(1);
      if (!publishedBuild[0]) {
        return "no_published_build" as const;
      }

      const now = new Date();
      const restored = await tx
        .update(products)
        .set({ status: "published", updatedAt: now })
        .where(
          and(
            eq(products.id, id),
            eq(products.status, "suspended"),
          ),
        )
        .returning({ id: products.id });

      if (!restored[0]) return "invalid_state" as const;

      if (audit) {
        await tx.insert(auditEvents).values({
          ...audit,
          createdAt: now,
        });
      }

      return "restored" as const;
    });
  }
}

export const productRepository = new ProductRepository();
