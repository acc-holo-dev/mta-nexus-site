import {
  contentRepository,
  productRepository,
  serverRepository,
  auditRepository,
} from "@nexus/db";
import { generateId } from "@nexus/security";
import { eventBus } from "@nexus/domain";
import type { Content, Comment, User, Product, Server } from "@nexus/domain";

export class ContentService {
  async listArticles(): Promise<Content[]> {
    return contentRepository.listPublished();
  }

  async getArticleBySlug(slug: string): Promise<Content | null> {
    return contentRepository.findBySlug(slug);
  }

  async getComments(target: { contentId?: string; productId?: string }): Promise<Comment[]> {
    return contentRepository.listComments(target);
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
      isVerifiedPurchase: true,
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

  async getFeed(): Promise<{
    featuredProducts: Product[];
    trendingServers: Server[];
    recentArticles: Content[];
  }> {
    const featuredProducts = await productRepository.list({ featuredOnly: true });
    const allServers = await serverRepository.listActivePublic();
    const recentArticles = await contentRepository.listPublished();

    return {
      featuredProducts: featuredProducts.slice(0, 4),
      trendingServers: allServers.slice(0, 3),
      recentArticles: recentArticles.slice(0, 3),
    };
  }
}

export const contentService = new ContentService();
