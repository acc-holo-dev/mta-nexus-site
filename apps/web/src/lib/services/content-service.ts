import {
  contentRepository,
  productRepository,
  serverRepository,
  auditRepository,
} from "@nexus/db";
import { can, generateId } from "@nexus/security";
import { eventBus, ForbiddenError, NotFoundError, AppError } from "@nexus/domain";
import type { Content, Comment, User, Product, Server } from "@nexus/domain";

export class ContentService {
  async listArticles(limit = 50): Promise<Content[]> {
    return contentRepository.listPublished(limit);
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
    input: { contentId?: string; productId?: string; text: string; rating?: number },
    actor: User
  ): Promise<Comment> {
    const comment = await contentRepository.addComment({
      id: generateId("cmt"),
      contentId: input.contentId,
      productId: input.productId,
      authorId: actor.id,
      text: input.text,
      rating: input.rating,
      // Article comments are not product acquisitions. Product review routes
      // set this flag only after an entitlement check.
      isVerifiedPurchase: false,
    });

    if (input.contentId) {
      await auditRepository.record({
        id: generateId("aud"),
        actorId: actor.id,
        actorType: "user",
        action: "content.comment_added",
        targetId: input.contentId,
        targetType: "content",
      });
    }

    if (input.productId && input.rating) {
      const prod = await productRepository.findById(input.productId);
      if (prod) {
        const newCount = prod.ratingCount + 1;
        const newAvg = Math.round((prod.ratingAverage * prod.ratingCount + input.rating * 10) / newCount);
        await productRepository.update(prod.id, {
          ratingCount: newCount,
          ratingAverage: newAvg,
        });
      }
    }

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

    const updated = await contentRepository.updateStatus(
      contentId,
      targetStatus,
      current.status
    );
    if (!updated) {
      throw new AppError(
        "Content changed before moderation completed",
        409,
        "CONTENT_STATE_CHANGED"
      );
    }

    await auditRepository.record({
      id: generateId("aud"),
      actorId: actor.id,
      actorType: "admin",
      action: decision === "publish" ? "content.published" : "content.archived",
      targetId: contentId,
      targetType: "content",
      details: { from: current.status, to: targetStatus, notes },
    });

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
    const recentArticles = await contentRepository.listPublished(3);

    return {
      featuredProducts,
      trendingServers,
      recentArticles,
    };
  }
}

export const contentService = new ContentService();
