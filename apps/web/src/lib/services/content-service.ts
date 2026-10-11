import {
  contentRepository,
  contentDiscussionRepository,
  authorContentRepository,
  productRepository,
  serverRepository,
  discussionRevision,
  discussionManagementRepository,
} from "@nexus/db";
import { can, generateId } from "@nexus/security";
import { ForbiddenError, NotFoundError, AppError } from "@nexus/domain";
import type { Content, Comment, User, Product, Server } from "@nexus/domain";
import { safeExternalWebUrl } from "@nexus/validation";
import { encodeDiscussionCursor } from "../content-discussion-contract";
type DiscussionCursor = { createdAt: string; id: string };
import { editorialTypes, communityTypes, type parseContentPage } from "../user-platform-contract";

export class ContentService {
  async manageComment(input: { slug: string; commentId: string; expectedRevision: string; text?: string; reason?: string }, actor: User) {
    return discussionManagementRepository.mutate({ ...input, actorId: actor.id, auditId: generateId("aud") });
  }
  async pageArticles(filters: ReturnType<typeof parseContentPage>) {
    return authorContentRepository.pagePublic([...editorialTypes], filters);
  }

  async pageCommunity(filters: ReturnType<typeof parseContentPage>) {
    return authorContentRepository.pagePublic([...communityTypes], filters);
  }
  async listArticles(limit = 50): Promise<Content[]> {
    const editorialTypes: Content["type"][] = [
      "article",
      "news",
      "devlog",
      "update",
      "announcement",
    ];
    return contentRepository.listPublishedByTypes(editorialTypes, limit);
  }

  async searchArticles(query: string, limit = 24): Promise<Content[]> {
    const editorialTypes: Content["type"][] = [
      "article",
      "news",
      "devlog",
      "update",
      "announcement",
    ];
    return contentRepository.searchPublishedByTypes(editorialTypes, query, limit);
  }

  async listCommunityTopics(limit = 50): Promise<Content[]> {
    return contentRepository.listPublishedByTypes(["post", "question"], limit);
  }

  async listServerUpdates(serverId: string, limit = 6): Promise<Content[]> {
    return contentRepository.listPublishedByServer(serverId, limit);
  }

  async getArticleBySlug(
    slug: string,
    options: { incrementView?: boolean } = {},
  ): Promise<Content | null> {
    return contentRepository.findPublishedBySlug(slug, options);
  }

  async commentAuthor(contentId: string, id: string) {
    const parent = await contentRepository.findCommentById(id);
    return parent?.contentId === contentId && !parent.productId ? parent.authorId : null;
  }

  async pageDiscussion(contentId: string, cursor?: DiscussionCursor & { contentId?: string; query?: string }, options: { query?: string; focusId?: string } = {}) {
    if (cursor && (options.query || cursor.contentId || cursor.query) &&
      (cursor.contentId !== contentId || cursor.query !== options.query))
      throw new AppError("Invalid comment page", 400, "INVALID_CURSOR");
    const result = options.query || options.focusId
      ? await contentDiscussionRepository.page(contentId, cursor, options)
      : await contentDiscussionRepository.page(contentId, cursor);
    return {
      items: result.items.map((row) => ({
        id: row.id,
        revision: discussionRevision(row.id, row.text),
        text: row.text,
        parentId: row.parentId,
        createdAt: row.createdAt.toISOString(),
        author:
          row.authorId && row.username
            ? {
                id: row.authorId,
                username: row.username,
                displayName: row.displayName ?? row.username,
                avatarUrl: safeExternalWebUrl(row.avatarUrl) ?? null,
              }
            : null,
        parent:
          row.parentText !== null ? { text: row.parentText, username: row.parentUsername } : null,
      })),
      hasMore: result.hasMore,
      nextCursor: result.nextCursor ? options.query
        ? JSON.stringify({ ...result.nextCursor, contentId, query: options.query })
        : encodeDiscussionCursor(result.nextCursor) : null,
    };
  }

  async getComments(
    target: { contentId?: string; productId?: string },
    limit = 100,
  ): Promise<Comment[]> {
    return contentRepository.listComments(target, limit);
  }

  async addComment(
    input: {
      contentId?: string;
      productId?: string;
      parentId?: string;
      text: string;
      rating?: number;
    },
    actor: User,
  ): Promise<Comment> {
    if (input.contentId) {
      const target = await contentRepository.findById(input.contentId);
      if (target?.status !== "published") {
        throw new NotFoundError("Content", input.contentId);
      }
    }

    if (input.parentId) {
      if (!input.contentId) {
        throw new AppError(
          "Parent comments are only supported for article discussions",
          400,
          "COMMENT_PARENT_TARGET_INVALID",
        );
      }
      const parent = await contentRepository.findCommentById(input.parentId);
      if (!parent || parent.contentId !== input.contentId || parent.productId) {
        throw new AppError(
          "Parent comment was not found for this article",
          400,
          "COMMENT_PARENT_NOT_FOUND",
        );
      }
    }

    const comment = await contentRepository.addComment(
      {
        id: generateId("cmt"),
        contentId: input.contentId,
        productId: input.productId,
        parentId: input.parentId,
        authorId: actor.id,
        text: input.text,
        rating: input.rating,
        // Article comments are not product acquisitions. Product review routes
        // set this flag only after an entitlement check.
        isVerifiedPurchase: false,
      },
      input.contentId
        ? {
            id: generateId("aud"),
            actorId: actor.id,
            actorType: "user",
            action: "content.comment_added",
            targetId: input.contentId,
            targetType: "content",
          }
        : undefined,
    );

    return comment;
  }

  async moderateContent(
    contentId: string,
    decision: "publish" | "archive",
    actor: User,
    notes?: string,
    expectedUpdatedAt?: Date,
  ): Promise<Content> {
    if (!can(actor, "admin.moderation")) {
      throw new ForbiddenError("Moderator privilege is required to moderate content");
    }

    const current = await contentRepository.findById(contentId);
    if (!current) throw new NotFoundError("Content", contentId);

    if (expectedUpdatedAt && current.updatedAt.getTime() !== expectedUpdatedAt.getTime()) throw new AppError("Content changed before moderation", 409, "CONTENT_STATE_CHANGED");

    const targetStatus: Content["status"] = decision === "publish" ? "published" : "archived";
    if (current.status === targetStatus) {
      throw new AppError(`Content is already ${targetStatus}`, 409, "CONTENT_ALREADY_IN_STATE");
    }

    const updated = await contentRepository.moderateStatusWithAudit(
      contentId,
      targetStatus,
      current.status,
      {
        id: generateId("aud"),
        actorId: actor.id,
        actorType: "admin",
        action: decision === "publish" ? "content.published" : "content.archived",
        targetId: contentId,
        targetType: "content",
        details: { from: current.status, to: targetStatus, notes },
      },
      expectedUpdatedAt ?? new Date(current.updatedAt),
    );
    if (!updated) {
      throw new AppError(
        "Content changed before moderation completed",
        409,
        "CONTENT_STATE_CHANGED",
      );
    }

    return updated;
  }

  async getFeed(): Promise<{
    featuredProducts: Product[];
    trendingServers: Server[];
    recentArticles: Content[];
  }> {
    const featuredProducts = await productRepository.list({
      featuredOnly: true,
      maxPrice: 0,
      limit: 4,
    });
    const trendingServers = await serverRepository.listActivePublic(3);
    const recentArticles = await this.listArticles(3);

    return {
      featuredProducts,
      trendingServers,
      recentArticles,
    };
  }
}

export const contentService = new ContentService();
