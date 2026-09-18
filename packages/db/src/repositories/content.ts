import { eq, desc, and, sql } from "drizzle-orm";
import { db } from "../client";
import { content, comments } from "../schema";
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
