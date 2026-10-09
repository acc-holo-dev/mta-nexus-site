import { eq, asc, desc, and, count, sql, inArray, ilike, or } from "drizzle-orm";
import { containsPattern } from "./search-pattern";
import { db } from "../client";
import { auditEvents, content, comments, products } from "../schema";
import type { AuditEvent, Content, Comment } from "@nexus/domain";

export class ContentRepository {
  async countDrafts(): Promise<number> {
    const [row] = await db.select({ total: count() }).from(content)
      .where(eq(content.status, "draft"));
    return row?.total ?? 0;
  }

  async listDraftPage(page: number, pageSize = 30): Promise<{ items: Content[]; hasMore: boolean }> {
    if (!Number.isSafeInteger(page) || page < 1 || page > 99_999 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      throw new RangeError("Invalid content review page");
    }
    const rows = await db.select().from(content)
      .where(eq(content.status, "draft"))
      .orderBy(asc(content.createdAt), asc(content.id))
      .limit(pageSize + 1)
      .offset((page - 1) * pageSize);
    return { items: rows.slice(0, pageSize) as unknown as Content[], hasMore: rows.length > pageSize };
  }

  async countPublished(): Promise<number> {
    const [row] = await db.select({ total: count() }).from(content).where(
      eq(content.status, "published"),
    );
    return row?.total ?? 0;
  }

  async searchPublished(term: string, limit = 50): Promise<Content[]> {
    const pattern = containsPattern(term);
    const boundedLimit = Number.isFinite(limit)
      ? Math.min(Math.max(Math.floor(limit), 1), 50)
      : 50;
    const rows = await db.select().from(content).where(and(
      eq(content.status, "published"),
      or(
        ilike(content.title, pattern),
        ilike(content.body, pattern),
        sql`exists (select 1 from jsonb_array_elements_text(${content.tags}) as tag(value) where tag.value ilike ${pattern})`,
      ),
    )).orderBy(desc(content.createdAt), desc(content.id)).limit(boundedLimit);
    return rows as unknown as Content[];
  }

  async searchPublishedByTypes(
    types: Content["type"][],
    term: string,
    limit = 50,
  ): Promise<Content[]> {
    if (types.length === 0) return [];
    const pattern = containsPattern(term);
    const boundedLimit = Number.isFinite(limit)
      ? Math.min(Math.max(Math.floor(limit), 1), 50)
      : 50;
    const rows = await db.select().from(content).where(and(
      eq(content.status, "published"),
      inArray(content.type, types),
      or(
        ilike(content.title, pattern),
        ilike(content.body, pattern),
        sql`exists (select 1 from jsonb_array_elements_text(${content.tags}) as tag(value) where tag.value ilike ${pattern})`,
      ),
    )).orderBy(desc(content.updatedAt), desc(content.id)).limit(boundedLimit);
    return rows as unknown as Content[];
  }

  async listPublished(limit = 50): Promise<Content[]> {
        const rows = await db
      .select()
      .from(content)
      .where(eq(content.status, "published"))
      .orderBy(desc(content.createdAt))
      .limit(Math.min(Math.max(limit, 1), 100));
    return rows as unknown as Content[];
  }

  async pagePublishedEditorialByOrganization(organizationId: string, requestedPage = 1, requestedSize = 12) {
    const pageSize = Number.isFinite(requestedSize)
      ? Math.min(Math.max(Math.floor(requestedSize), 1), 100) : 12;
    const requested = Number.isFinite(requestedPage)
      ? Math.min(Math.max(Math.floor(requestedPage), 1), Number.MAX_SAFE_INTEGER) : 1;
    const editorialTypes: Content["type"][] = ["article", "news", "devlog", "update", "announcement"];
    const condition = and(
      eq(content.organizationId, organizationId),
      eq(content.status, "published"),
      inArray(content.type, editorialTypes),
    );
    const [summary] = await db.select({ total: count() }).from(content).where(condition);
    const total = summary?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(requested, totalPages);
    const rows = await db.select().from(content).where(condition)
      .orderBy(desc(sql`coalesce(${content.publishedAt}, ${content.updatedAt})`), desc(content.id))
      .limit(pageSize).offset((page - 1) * pageSize);
    return { items: rows as unknown as Content[], total, page, pageSize, totalPages };
  }

  async listPublishedByOrganization(
    organizationId: string,
    limit = 100,
  ): Promise<Content[]> {
    const boundedLimit = Number.isFinite(limit)
      ? Math.min(Math.max(Math.floor(limit), 1), 100)
      : 100;

    const rows = await db
      .select()
      .from(content)
      .where(
        and(
          eq(content.organizationId, organizationId),
          eq(content.status, "published"),
        ),
      )
      .orderBy(
        desc(sql`coalesce(${content.publishedAt}, ${content.updatedAt})`),
        desc(content.id),
      )
      .limit(boundedLimit);
    return rows as unknown as Content[];
  }

  async listPublishedByTypes(types: Content["type"][], limit = 50): Promise<Content[]> {
    if (types.length === 0) return [];
    const rows = await db
      .select()
      .from(content)
      .where(and(eq(content.status, "published"), inArray(content.type, types)))
      .orderBy(desc(content.updatedAt))
      .limit(Math.min(Math.max(Math.floor(limit), 1), 100));
    return rows as unknown as Content[];
  }

  async listPublishedByServer(
    serverId: string,
    limit = 6,
  ): Promise<Content[]> {
    const publicServerUpdateTypes: Content["type"][] = [
      "article",
      "news",
      "devlog",
      "update",
      "announcement",
    ];
    const boundedLimit = Number.isFinite(limit)
      ? Math.min(Math.max(Math.floor(limit), 1), 12)
      : 6;

    const rows = await db
      .select()
      .from(content)
      .where(
        and(
          eq(content.serverId, serverId),
          eq(content.status, "published"),
          inArray(content.type, publicServerUpdateTypes),
        ),
      )
      .orderBy(
        desc(sql`coalesce(${content.publishedAt}, ${content.updatedAt})`),
      )
      .limit(boundedLimit);
    return rows as unknown as Content[];
  }

  async findById(id: string): Promise<Content | null> {
    const rows = await db.select().from(content).where(eq(content.id, id)).limit(1);
    return (rows[0] as unknown as Content) || null;
  }

  /**
   * Public-safe slug lookup. Draft and archived content never leave the repository
   * through the normal article read path.
   */
  async findPublishedBySlug(
    slug: string,
    options: { incrementView?: boolean } = {}
  ): Promise<Content | null> {
    const rows = await db
      .select()
      .from(content)
      .where(and(eq(content.slug, slug), eq(content.status, "published")))
      .limit(1);
    if (!rows.length) return null;
    const item = rows[0] as unknown as Content;

    if (options.incrementView !== false) {
      // Increment in PostgreSQL so concurrent article reads cannot overwrite
      // one another with the same stale in-memory value.
      const [updatedItem] = await db
        .update(content)
        .set({ viewCount: sql`${content.viewCount} + 1` })
        .where(eq(content.id, item.id))
        .returning({ viewCount: content.viewCount });
      item.viewCount = updatedItem?.viewCount ?? item.viewCount + 1;
    }

    return item;
  }

  async findBySlug(
    slug: string,
    options: { incrementView?: boolean } = {}
  ): Promise<Content | null> {
    return this.findPublishedBySlug(slug, options);
  }

  async listByStatus(
    status: Content["status"],
    limit = 100
  ): Promise<Content[]> {
    const boundedLimit = Number.isFinite(limit)
      ? Math.min(Math.max(Math.floor(limit), 1), 100)
      : 100;
    const rows = await db
      .select()
      .from(content)
      .where(eq(content.status, status))
      .orderBy(desc(content.createdAt))
      .limit(boundedLimit);
    return rows as unknown as Content[];
  }

  async updateStatus(
    id: string,
    status: Content["status"],
    expectedStatus?: Content["status"]
  ): Promise<Content | null> {
    const condition = expectedStatus
      ? and(eq(content.id, id), eq(content.status, expectedStatus))
      : eq(content.id, id);
    const rows = await db
      .update(content)
      .set({
        status,
        publishedAt: status === "published" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(condition)
      .returning();
    return (rows[0] as unknown as Content) || null;
  }

  async moderateStatusWithAudit(
    id: string,
    status: Content["status"],
    expectedStatus: Content["status"],
    audit: Omit<AuditEvent, "createdAt">,
  ): Promise<Content | null> {
    return db.transaction(async (tx) => {
      const now = new Date();
      const rows = await tx
        .update(content)
        .set({
          status,
          publishedAt: status === "published" ? now : null,
          updatedAt: now,
        })
        .where(
          and(
            eq(content.id, id),
            eq(content.status, expectedStatus),
          ),
        )
        .returning();
      const updated = rows[0];
      if (!updated) return null;

      await tx.insert(auditEvents).values({
        ...audit,
        createdAt: now,
      });
      return updated as unknown as Content;
    });
  }

  async create(data: Omit<Content, "createdAt" | "updatedAt">): Promise<Content> {
    const values = {
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

        const rows = await db.insert(content).values(values).returning();
    return rows[0] as unknown as Content;
  }

  async createWithAudit(
    data: Omit<Content, "createdAt" | "updatedAt">,
    audit: Omit<AuditEvent, "createdAt">,
  ): Promise<Content> {
    return db.transaction(async (tx) => {
      const now = new Date();
      const rows = await tx
        .insert(content)
        .values({ ...data, createdAt: now, updatedAt: now })
        .returning();
      const created = rows[0];
      if (!created) throw new Error("Content insert did not return a row");

      await tx.insert(auditEvents).values({ ...audit, createdAt: now });
      return created as unknown as Content;
    });
  }

  async findCommentById(id: string): Promise<Comment | null> {
    const rows = await db
      .select()
      .from(comments)
      .where(eq(comments.id, id))
      .limit(1);
    return (rows[0] as unknown as Comment) || null;
  }

  async listComments(
    target: { contentId?: string; productId?: string },
    limit = 100
  ): Promise<Comment[]> {
    const boundedLimit = Number.isFinite(limit)
      ? Math.min(Math.max(Math.floor(limit), 1), 100)
      : 100;

    if (target.contentId) {
      const rows = await db
        .select()
        .from(comments)
        .where(eq(comments.contentId, target.contentId))
        .orderBy(desc(comments.createdAt))
        .limit(boundedLimit);
      return rows as unknown as Comment[];
    }
    if (target.productId) {
      const rows = await db
        .select()
        .from(comments)
        .where(eq(comments.productId, target.productId))
        .orderBy(desc(comments.createdAt))
        .limit(boundedLimit);
      return rows as unknown as Comment[];
    }
    return [];
  }

  async addComment(
    data: Omit<Comment, "createdAt">,
    audit?: Omit<AuditEvent, "createdAt">,
  ): Promise<Comment> {
    const values = {
      ...data,
      createdAt: new Date(),
    };

    return db.transaction(async (tx) => {
      const rows = await tx.insert(comments).values(values).returning();
      if (data.contentId) {
        await tx
          .update(content)
          .set({
            commentCount: sql`${content.commentCount} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(content.id, data.contentId));
      }
      if (audit) {
        await tx.insert(auditEvents).values({
          ...audit,
          createdAt: values.createdAt,
        });
      }

      return rows[0] as unknown as Comment;
    });
  }

  async addProductReview(
    data: Omit<Comment, "createdAt"> & { productId: string; rating: number },
    audit?: Omit<AuditEvent, "createdAt">,
  ): Promise<{ review: Comment; ratingCount: number; ratingAverage: number }> {
    const values = {
      ...data,
      createdAt: new Date(),
    };

    return db.transaction(async (tx) => {
      // Serialize review aggregation per product. Without a product-row lock,
      // two concurrent reviewers can both calculate aggregates from incomplete
      // snapshots and the last writer can overwrite the correct counters.
      const lockedProduct = await tx
        .update(products)
        .set({ updatedAt: sql`${products.updatedAt}` })
        .where(and(eq(products.id, data.productId), eq(products.status, "published")))
        .returning({ id: products.id });

      if (!lockedProduct.length) {
        throw new Error("PRODUCT_NOT_PUBLISHED");
      }

      const rows = await tx.insert(comments).values(values).returning();
      const review = rows[0] as unknown as Comment;

      const aggregateRows = await tx
        .select({
          ratingCount: sql<number>`count(${comments.rating})::int`,
          ratingAverage: sql<number>`coalesce(round(avg(${comments.rating}) * 10), 0)::int`,
        })
        .from(comments)
        .where(eq(comments.productId, data.productId));

      const ratingCount = aggregateRows[0]?.ratingCount ?? 0;
      const ratingAverage = aggregateRows[0]?.ratingAverage ?? 0;

      await tx
        .update(products)
        .set({
          ratingCount,
          ratingAverage,
          updatedAt: new Date(),
        })
        .where(eq(products.id, data.productId));

      if (audit) {
        await tx.insert(auditEvents).values({
          ...audit,
          createdAt: values.createdAt,
        });
      }

      return { review, ratingCount, ratingAverage };
    });
  }

  async hasReviewFromUser(productId: string, authorId: string): Promise<boolean> {
    const rows = await db
      .select()
      .from(comments)
      .where(and(eq(comments.productId, productId), eq(comments.authorId, authorId)))
      .limit(1);
    return rows.length > 0;
  }
}

export const contentRepository = new ContentRepository();
