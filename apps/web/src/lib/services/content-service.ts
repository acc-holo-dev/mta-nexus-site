import { store } from "./store";
import { generateId } from "@nexus/security";
import { NotFoundError, eventBus } from "@nexus/domain";
import type { Content, Comment, User } from "@nexus/domain";

export class ContentService {
  async listArticles(): Promise<Content[]> {
    return Array.from(store.content.values())
      .filter((c) => c.status === "published")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getArticleBySlug(slug: string): Promise<Content | null> {
    const item = Array.from(store.content.values()).find((c) => c.slug === slug);
    if (item) {
      item.viewCount += 1;
      store.content.set(item.id, item);
    }
    return item || null;
  }

  async getComments(target: { contentId?: string; productId?: string }): Promise<Comment[]> {
    return Array.from(store.comments.values()).filter((c) => {
      if (target.contentId && c.contentId === target.contentId) return true;
      if (target.productId && c.productId === target.productId) return true;
      return false;
    });
  }

  async addComment(
    input: { contentId?: string; productId?: string; text: string; rating?: number },
    actor: User
  ): Promise<Comment> {
    const comment: Comment = {
      id: generateId("cmt"),
      contentId: input.contentId,
      productId: input.productId,
      authorId: actor.id,
      text: input.text,
      rating: input.rating,
      isVerifiedPurchase: true,
      createdAt: new Date(),
    };

    store.comments.set(comment.id, comment);

    if (input.contentId) {
      const c = store.content.get(input.contentId);
      if (c) {
        c.commentCount += 1;
        store.content.set(c.id, c);
      }
    }

    if (input.productId && input.rating) {
      const p = store.products.get(input.productId);
      if (p) {
        const newCount = p.ratingCount + 1;
        p.ratingAverage = Math.round((p.ratingAverage * p.ratingCount + input.rating * 10) / newCount);
        p.ratingCount = newCount;
        store.products.set(p.id, p);
      }
    }

    return comment;
  }

  async getFeed(): Promise<{
    featuredProducts: any[];
    trendingServers: any[];
    recentArticles: Content[];
  }> {
    const featuredProducts = Array.from(store.products.values())
      .filter((p) => p.status === "published")
      .slice(0, 4);

    const trendingServers = Array.from(store.servers.values())
      .filter((s) => s.status === "active")
      .sort((a, b) => b.currentPlayers - a.currentPlayers)
      .slice(0, 3);

    const recentArticles = Array.from(store.content.values())
      .filter((c) => c.status === "published")
      .slice(0, 3);

    return { featuredProducts, trendingServers, recentArticles };
  }
}

export const contentService = new ContentService();
