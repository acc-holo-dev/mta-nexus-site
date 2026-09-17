import { eq, desc, and } from "drizzle-orm";
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

  async findBySlug(slug: string): Promise<Content | null> {
        const rows = await db.select().from(content).where(eq(content.slug, slug)).limit(1);
    if (!rows.length) return null;
    const item = rows[0] as unknown as Content;

    // Increment view count
    await db
      .update(content)
      .set({ viewCount: item.viewCount + 1 })
      .where(eq(content.id, item.id));

    item.viewCount += 1;
    return item;
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

  async listComments(target: { contentId?: string; productId?: string }): Promise<Comment[]> {
        if (target.contentId) {
      const rows = await db
        .select()
        .from(comments)
        .where(eq(comments.contentId, target.contentId))
        .orderBy(desc(comments.createdAt));
      return rows as unknown as Comment[];
    }
    if (target.productId) {
      const rows = await db
        .select()
        .from(comments)
        .where(eq(comments.productId, target.productId))
        .orderBy(desc(comments.createdAt));
      return rows as unknown as Comment[];
    }
    return [];
  }

  async addComment(data: Omit<Comment, "createdAt">): Promise<Comment> {
    const values = {
      ...data,
      createdAt: new Date(),
    };

        const rows = await db.insert(comments).values(values).returning();
    return rows[0] as unknown as Comment;
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
