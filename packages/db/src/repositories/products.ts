import type { SQL } from "drizzle-orm";
import { eq, desc, asc, and, count, gte, lte, ilike, or, sql, inArray, ne } from "drizzle-orm";
import { safePublishedBuildCondition } from "./build-safety";
import { containsPattern } from "./search-pattern";
import { db } from "../client";
import { auditEvents, builds, products, organizations, organizationMembers } from "../schema";
import type { AuditEvent, Product, ProductType, User } from "@nexus/domain";

function hasSafePublishedBuild() {
  return sql`exists (
    select 1
    from ${builds}
    where ${builds.productId} = ${products.id}
      and ${builds.status} = 'published'
      and ${builds.scanStatus} = 'clean'
      and ${builds.scanner} is not null
      and btrim(${builds.scanner}) <> ''
      and ${builds.scannedAt} is not null
  )`;
}

/** Same scope for listing, private reads and audited metadata writes. */
export function managedProductCondition(actor: Pick<User, "id" | "role">): SQL {
  if (actor.role === "admin") return sql`true`;
  return sql`(
    (${products.organizationId} is null and ${products.authorId} = ${actor.id})
    or exists (select 1 from ${organizations}
      where ${organizations.id} = ${products.organizationId} and ${organizations.ownerId} = ${actor.id})
    or exists (select 1 from ${organizationMembers}
      where ${organizationMembers.organizationId} = ${products.organizationId}
        and ${organizationMembers.userId} = ${actor.id}
        and (${organizationMembers.role} in ('owner', 'admin')
          or ${organizationMembers.permissions} @> '["manage_products"]'::jsonb))
  )`;
}

export interface ProductQueryOptions {
  type?: ProductType;
  featuredOnly?: boolean;
  minPrice?: number;
  maxPrice?: number;
  sort?: "popular" | "newest" | "price_asc" | "price_desc" | "rating" | "relevance";
  query?: string;
  limit?: number;
  offset?: number;
}

export class ProductRepository {
  async pageManaged(actor: Pick<User, "id" | "role">, status?: Product["status"], requestedPage = 1) {
    const condition = and(managedProductCondition(actor), eq(products.price, 0),
      status ? eq(products.status, status) : undefined);
    const [summary] = await db.select({ total: count() }).from(products).where(condition);
    const total = summary?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / 24));
    const page = Math.min(Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1, totalPages);
    const rows = await db.select().from(products).where(condition)
      .orderBy(desc(products.updatedAt), desc(products.id)).limit(24).offset((page - 1) * 24);
    return { products: rows as unknown as Product[], total, page, totalPages };
  }

  async findManaged(id: string, actor: Pick<User, "id" | "role">): Promise<Product | null> {
    const rows = await db.select().from(products).where(and(eq(products.id, id),
      eq(products.price, 0), managedProductCondition(actor))).limit(1);
    return (rows[0] as unknown as Product) ?? null;
  }

  async updateManagedDetails(id: string, actor: Pick<User, "id" | "role">,
    details: Pick<Product, "title" | "shortDescription" | "description" | "tags">,
    audit: Omit<AuditEvent, "createdAt">, expectedUpdatedAt?: Date): Promise<Product | null> {
    return db.transaction(async (tx) => {
      // Recheck the scope in the mutation, including organization membership.
      const rows = await tx.update(products).set({ title: details.title,
        shortDescription: details.shortDescription, description: details.description,
        tags: details.tags,
        // Millisecond revisions match JS Dates and advance even within one clock tick.
        updatedAt: sql`greatest(date_trunc('milliseconds', clock_timestamp()),
          date_trunc('milliseconds', ${products.updatedAt}) + interval '1 millisecond')` })
        .where(and(eq(products.id, id), eq(products.price, 0), managedProductCondition(actor),
          expectedUpdatedAt ? sql`date_trunc('milliseconds', ${products.updatedAt}) = ${expectedUpdatedAt.toISOString()}::timestamptz` : undefined)).returning();
      if (!rows[0]) return null;
      await tx.insert(auditEvents).values(audit);
      return rows[0] as unknown as Product;
    });
  }

  async pagePublishedFreeByAuthor(authorId: string, requestedPage = 1, requestedSize = 24) {
    return this.pagePublishedFree(eq(products.authorId, authorId), requestedPage, requestedSize);
  }

  async pagePublishedFreeByOrganization(organizationId: string, requestedPage = 1, requestedSize = 24) {
    return this.pagePublishedFree(eq(products.organizationId, organizationId), requestedPage, requestedSize);
  }

  private async pagePublishedFree(scope: SQL, requestedPage: number, requestedSize: number) {
    const pageSize = Number.isFinite(requestedSize)
      ? Math.min(Math.max(Math.floor(requestedSize), 1), 100) : 24;
    const requested = Number.isFinite(requestedPage)
      ? Math.min(Math.max(Math.floor(requestedPage), 1), Number.MAX_SAFE_INTEGER) : 1;
    const condition = and(
      scope,
      eq(products.status, "published"),
      eq(products.price, 0),
      hasSafePublishedBuild(),
    );
    const [summary] = await db.select({ total: count() }).from(products).where(condition);
    const total = summary?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(requested, totalPages);
    const rows = await db.select().from(products).where(condition)
      .orderBy(desc(products.createdAt), desc(products.id))
      .limit(pageSize).offset((page - 1) * pageSize);
    return { products: rows as unknown as Product[], total, page, pageSize, totalPages };
  }

  async countPublishedFree(): Promise<number> {
    const [row] = await db.select({ total: count() }).from(products).where(and(
      eq(products.status, "published"),
      eq(products.price, 0),
      hasSafePublishedBuild(),
    ));
    return row?.total ?? 0;
  }

  async list(options: ProductQueryOptions = {}): Promise<Product[]> {
    const conditions = [
      eq(products.status, "published"),
      eq(products.price, 0),
      hasSafePublishedBuild(),
    ];
    if (options.type) conditions.push(eq(products.type, options.type));
    if (options.featuredOnly) conditions.push(eq(products.isFeatured, true));
    if (options.minPrice !== undefined) conditions.push(gte(products.price, options.minPrice));
    if (options.maxPrice !== undefined) conditions.push(lte(products.price, options.maxPrice));
    if (options.query?.trim()) {
      const pattern = containsPattern(options.query.trim());
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
      : Math.min(Math.max(Math.floor(options.limit), 1), 101);
    const offset = options.offset === undefined || !Number.isFinite(options.offset)
      ? 0
      : Math.min(Math.max(Math.floor(options.offset), 0), 100_000);

    const rows = await db
      .select()
      .from(products)
      .where(and(...conditions))
      .orderBy(order, desc(products.id))
      .limit(limit)
      .offset(offset);
    return rows as unknown as Product[];
  }

  async listPublishedByOrganization(
    organizationId: string,
    limit = 100,
  ): Promise<Product[]> {
    const boundedLimit = Number.isFinite(limit)
      ? Math.min(Math.max(Math.floor(limit), 1), 100)
      : 100;

    const rows = await db
      .select()
      .from(products)
      .where(
        and(
          eq(products.organizationId, organizationId),
          eq(products.status, "published"),
          eq(products.price, 0),
          hasSafePublishedBuild(),
        ),
      )
      .orderBy(desc(products.createdAt), desc(products.id))
      .limit(boundedLimit);
    return rows as unknown as Product[];
  }

  async listPublishedFreeByAuthor(authorId: string): Promise<Product[]> {
    const rows = await db.select().from(products).where(and(
      eq(products.authorId, authorId),
      eq(products.status, "published"),
      eq(products.price, 0),
      hasSafePublishedBuild(),
    )).orderBy(desc(products.createdAt), desc(products.id));
    return rows as unknown as Product[];
  }

  async listPublishedFreeByIds(ids: readonly string[]): Promise<Product[]> {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) return [];
    const result: Product[] = [];
    for (let offset = 0; offset < uniqueIds.length; offset += 500) {
      const rows = await db.select().from(products).where(and(
        inArray(products.id, uniqueIds.slice(offset, offset + 500)),
        eq(products.status, "published"),
        eq(products.price, 0),
        hasSafePublishedBuild(),
      ));
      result.push(...rows as unknown as Product[]);
    }
    return result;
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
          hasSafePublishedBuild(),
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
          hasSafePublishedBuild(),
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
        .select({ id: builds.id, version: builds.version })
        .from(builds)
        .where(safePublishedBuildCondition(id))
        .orderBy(desc(builds.createdAt), desc(builds.id))
        .limit(1);
      if (!publishedBuild[0]) {
        return "no_published_build" as const;
      }

      const now = new Date();
      const restored = await tx
        .update(products)
        .set({
          status: "published",
          currentVersion: publishedBuild[0].version,
          updatedAt: now,
        })
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
