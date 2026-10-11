import { createHash } from "node:crypto";
import { contentReactionsRepository } from "@nexus/db";
import {
  AppError,
  NotFoundError,
  contentReactionFromEmoji,
  type ContentReaction,
  type User,
} from "@nexus/domain";
import { generateId } from "@nexus/security";
import type { ReactionPage, ReactionPageQuery, ReactionState } from "../content-reaction-contract";
const validSlug = (slug: string) => /^[a-z0-9-]{1,200}$/u.test(slug);
class ContentReactionService {
  async state(slug: string, actorId?: string): Promise<ReactionState> {
    if (!validSlug(slug)) throw new NotFoundError("Content");
    return contentReactionsRepository.state(slug, actorId);
  }
  async set(actor: User, slug: string, reaction: ContentReaction | null) {
    if (!validSlug(slug)) throw new NotFoundError("Content");
    return contentReactionsRepository.set({
      actorId: actor.id,
      slug,
      reaction,
      reactionId: generateId("rea"),
      auditId: generateId("aud"),
    });
  }
  async remove(actor: User, contentId: string) {
    if (!/^[a-zA-Z0-9_-]{1,128}$/u.test(contentId)) throw new NotFoundError("Reaction");
    await contentReactionsRepository.set({
      actorId: actor.id,
      contentId,
      reaction: null,
      reactionId: generateId("rea"),
      auditId: generateId("aud"),
    });
    return { contentId, removed: true as const };
  }
  async page(actor: User, filters: ReactionPageQuery): Promise<ReactionPage> {
    const context = createHash("sha256")
      .update(JSON.stringify([1, actor.id, filters.query, filters.reaction ?? ""]))
      .digest("hex");
    if (filters.cursor && filters.cursor.context !== context)
      throw new AppError("Reaction page context changed", 400, "INVALID_CURSOR");
    const page = await contentReactionsRepository.page(actor.id, filters);
    return {
      items: page.items.map((row) => ({
        contentId: row.contentId,
        reaction: contentReactionFromEmoji(row.emoji) as ContentReaction,
        reactedAt: row.reactedAt.toISOString(),
        title: row.title,
        slug: row.slug,
        type: row.type,
      })),
      hasMore: page.hasMore,
      nextCursor: page.nextCursor
        ? JSON.stringify({ ...page.nextCursor, version: 1, context })
        : null,
    };
  }
}
export const contentReactionService = new ContentReactionService();
