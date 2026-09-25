import { eq, desc, and, sql, inArray } from "drizzle-orm";
import { db } from "../client";
import { content, comments, products } from "../schema";
import type { Content, Comment } from "@nexus/domain";

export class ContentRepository {
  async listPublished(limit = 50): Promise<Content[]> {
        const rows = await db
      .select()
      .from(content)
      .where(eq(content.status, "published"))
      .orderBy(desc(content.createdAt))
      .limit(Math.min(Math.max(limit, 1), 100));
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
      await db
        .update(content)
        .set({ viewCount: item.viewCount + 1 })
        .where(eq(content.id, item.id));

      item.viewCount += 1;
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

  async create(data: Omit<Content, "createdAt" | "updatedAt">): Promise<Content> {
    const values = {
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

        const rows = await db.insert(content).values(values).returning();
    return rows[0] as unknown as Content;
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

  async addComment(data: Omit<Comment, "createdAt">): Promise<Comment> {
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
      return rows[0] as unknown as Comment;
    });
  }

  async addProductReview(
    data: Omit<Comment, "createdAt"> & { productId: string; rating: number }
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
