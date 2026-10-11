import { eq, asc, desc, and, count, sql, inArray, ilike, or, isNull } from "drizzle-orm";
import { containsPattern } from "./search-pattern";
import { db } from "../client";
import { organizationWorkspaceAccess } from "./organization-workspace";
import { resourceReviewsRepository } from "./resource-reviews";
import { auditEvents, content, comments } from "../schema";
import { AppError, NotFoundError } from "@nexus/domain";
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
      if (data.organizationId) {
        const access = await organizationWorkspaceAccess(tx, data.organizationId, data.authorId, true);
        if (!["owner", "admin", "developer"].includes(access.role))
          throw new AppError("Organization publication rights revoked", 403, "FORBIDDEN");
      }
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
        .where(and(eq(comments.productId, target.productId), isNull(comments.contentId), eq(comments.reviewStatus, "published")))
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
    if (data.productId) {
      if (data.contentId || data.parentId || data.rating === undefined) throw new AppError("Invalid review target", 400, "REVIEW_INVALID");
      return (await this.addProductReview({ ...data, productId: data.productId, rating: data.rating }, audit)).review;
    }
    const values = {
      ...data,
      createdAt: new Date(),
    };

    return db.transaction(async (tx) => {
      if (data.contentId) {
        const [target] = await tx
          .select({ status: content.status })
          .from(content)
          .where(eq(content.id, data.contentId))
          .limit(1)
          .for("update");
        if (target?.status !== "published") throw new NotFoundError("Content");
        if (data.productId)
          throw new AppError("Mixed comment targets", 400, "COMMENT_PARENT_TARGET_INVALID");
        if (data.parentId) {
          const [parent] = await tx
            .select({ id: comments.id })
            .from(comments)
            .where(
              and(
                eq(comments.id, data.parentId),
                eq(comments.contentId, data.contentId),
                isNull(comments.productId),
              ),
            )
            .limit(1)
            .for("share");
          if (!parent) throw new AppError("Parent not found", 400, "COMMENT_PARENT_NOT_FOUND");
        }
      }
      const rows = await tx.insert(comments).values(values).returning();
      if (data.contentId) {
        await tx
          .update(content)
          .set({
            commentCount: sql`${content.commentCount} + 1`,
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
    if (data.contentId || data.parentId) throw new AppError("Invalid review target", 400, "REVIEW_INVALID");
    const result = await resourceReviewsRepository.command({
      actorId: data.authorId, productId: data.productId, reviewId: data.id,
      auditId: audit?.id ?? `aud_${data.id}`,
      command: { action: "save", expectedRevision: 0, text: data.text, rating: data.rating },
    });
    const review: Comment = {
      id: result.id, productId: data.productId, authorId: data.authorId,
      text: data.text.trim(), rating: data.rating, isVerifiedPurchase: true,
      createdAt: ("review" in result ? result.review?.createdAt : undefined) ?? new Date(),
    };
    return { review, ratingCount: result.ratingCount, ratingAverage: result.ratingAverage };
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
