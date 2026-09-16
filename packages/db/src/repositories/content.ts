import { eq, desc, and } from "drizzle-orm";
import { db } from "../client";
import { content, comments } from "../schema";
import type { Content, Comment } from "@nexus/domain";

export class ContentRepository {
  async listPublished(): Promise<Content[]> {
    try {
      const rows = await db
        .select()
        .from(content)
        .where(eq(content.status, "published"))
        .orderBy(desc(content.createdAt));
      return rows as unknown as Content[];
    } catch {
      return [];
    }
  }

  async findBySlug(slug: string): Promise<Content | null> {
    try {
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
    } catch {
      return null;
    }
  }

  async create(data: Omit<Content, "createdAt" | "updatedAt">): Promise<Content> {
    const values = {
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      const rows = await db.insert(content).values(values).returning();
      return rows[0] as unknown as Content;
    } catch {
      return values as unknown as Content;
    }
  }

  async listComments(target: { contentId?: string; productId?: string }): Promise<Comment[]> {
    try {
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
    } catch {
      return [];
    }
  }

  async addComment(data: Omit<Comment, "createdAt">): Promise<Comment> {
    const values = {
      ...data,
      createdAt: new Date(),
    };

    try {
      const rows = await db.insert(comments).values(values).returning();
      return rows[0] as unknown as Comment;
    } catch {
      return values as unknown as Comment;
    }
  }

  async hasReviewFromUser(productId: string, authorId: string): Promise<boolean> {
    try {
      const rows = await db
        .select()
        .from(comments)
        .where(and(eq(comments.productId, productId), eq(comments.authorId, authorId)))
        .limit(1);
      return rows.length > 0;
    } catch {
      return false;
    }
  }
}

export const contentRepository = new ContentRepository();
