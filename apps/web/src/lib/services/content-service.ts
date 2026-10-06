import {
  contentRepository,
  productRepository,
  serverRepository,
} from "@nexus/db";
import { can, generateId } from "@nexus/security";
import { ForbiddenError, NotFoundError, AppError } from "@nexus/domain";
import type { Content, Comment, User, Product, Server } from "@nexus/domain";
import { notifyServerFollowersOfPublishedContent } from "./server-follow-notification-service";

export class ContentService {
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

  async listCommunityTopics(limit = 50): Promise<Content[]> {
    return contentRepository.listPublishedByTypes(["post", "question"], limit);
  }

  async listServerUpdates(serverId: string, limit = 6): Promise<Content[]> {
    return contentRepository.listPublishedByServer(serverId, limit);
  }

  async getArticleBySlug(
    slug: string,
    options: { incrementView?: boolean } = {}
  ): Promise<Content | null> {
    return contentRepository.findPublishedBySlug(slug, options);
  }

  async getComments(
    target: { contentId?: string; productId?: string },
    limit = 100
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
    actor: User
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
          "COMMENT_PARENT_TARGET_INVALID"
        );
      }
      const parent = await contentRepository.findCommentById(input.parentId);
      if (!parent || parent.contentId !== input.contentId) {
        throw new AppError(
          "Parent comment was not found for this article",
          400,
          "COMMENT_PARENT_NOT_FOUND"
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
    notes?: string
  ): Promise<Content> {
    if (!can(actor, "admin.moderation")) {
      throw new ForbiddenError("Moderator privilege is required to moderate content");
    }

    const current = await contentRepository.findById(contentId);
    if (!current) throw new NotFoundError("Content", contentId);

    const targetStatus: Content["status"] =
      decision === "publish" ? "published" : "archived";
    if (current.status === targetStatus) {
      throw new AppError(
        `Content is already ${targetStatus}`,
        409,
        "CONTENT_ALREADY_IN_STATE"
      );
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
    );
    if (!updated) {
      throw new AppError(
        "Content changed before moderation completed",
        409,
        "CONTENT_STATE_CHANGED"
      );
    }

    if (decision === "publish" && updated.serverId) {
      await notifyServerFollowersOfPublishedContent(updated).catch(
        () => undefined,
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
