import {
  authorContentRepository,
  contentCommentsRepository,
  contentDiscussionRepository,
  contentRepository,
  discussionManagementRepository,
  discussionRevision,
  productRepository,
  serverRepository,
} from "@nexus/db";
import type { Comment, Content, Product, Server, User } from "@nexus/domain";
import { AppError, ForbiddenError, NotFoundError } from "@nexus/domain";
import { can, generateId } from "@nexus/security";
import { safeExternalWebUrl } from "@nexus/validation";
import { encodeDiscussionCursor } from "../../../features/community/content-discussion-contract";
import { PUBLICATION_TYPES } from "../../../features/community/publication-feed-contract";
import {
  communityTypes,
  editorialTypes,
  type parseContentPage,
} from "../../../features/community/user-platform-contract";
import { isWalletEngineEnabled } from "../commerce/wallet-payment-service";

type DiscussionCursor = { createdAt: string; id: string };

export class ContentService {
  async manageComment(
    input: {
      slug: string;
      commentId: string;
      expectedRevision: string;
      text?: string;
      reason?: string;
    },
    actor: User,
    currentToken: string,
  ) {
    return discussionManagementRepository.mutate({
      ...input,
      actorId: actor.id,
      auditId: generateId("aud"),
      currentToken,
    });
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

  async pageDiscussion(
    contentId: string,
    cursor?: DiscussionCursor & { contentId?: string; query?: string },
    options: { query?: string; focusId?: string } = {},
  ) {
    if (
      cursor &&
      (options.query || cursor.contentId || cursor.query) &&
      (cursor.contentId !== contentId || cursor.query !== options.query)
    )
      throw new AppError("Invalid comment page", 400, "INVALID_CURSOR");
    const result =
      options.query || options.focusId
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
      nextCursor: result.nextCursor
        ? options.query
          ? JSON.stringify({ ...result.nextCursor, contentId, query: options.query })
          : encodeDiscussionCursor(result.nextCursor)
        : null,
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
      intentKey?: string;
    },
    actor: User,
    currentToken: string,
  ): Promise<{ comment: Comment; replayed: boolean }> {
    if (input.contentId) {
      const target = await contentRepository.findById(input.contentId);
      if (target?.status !== "published") {
        throw new NotFoundError("Content", input.contentId);
      }
      if (!input.intentKey) {
        throw new AppError(
          "Comment intent key is required",
          400,
          "COMMENT_IDEMPOTENCY_KEY_INVALID",
        );
      }

      if (input.parentId) {
        const parent = await contentRepository.findCommentById(input.parentId);
        if (!parent || parent.contentId !== input.contentId || parent.productId) {
          throw new AppError(
            "Parent comment was not found for this article",
            400,
            "COMMENT_PARENT_NOT_FOUND",
          );
        }
      }

      const result = await contentCommentsRepository.addArticleComment({
        intentKey: input.intentKey,
        contentId: input.contentId,
        authorId: actor.id,
        currentToken,
        text: input.text,
        parentId: input.parentId,
        audit: {
          id: generateId("aud"),
          actorId: actor.id,
          actorType: "user",
          action: "content.comment_added",
          targetId: input.contentId,
          targetType: "content",
        },
      });
      if (result.kind === "key_conflict") {
        throw new AppError(
          "Comment intent key was reused with a different payload",
          409,
          "COMMENT_IDEMPOTENCY_CONFLICT",
        );
      }
      return { comment: result.comment, replayed: result.kind === "replayed" };
    }

    if (input.parentId) {
      throw new AppError(
        "Parent comments are only supported for article discussions",
        400,
        "COMMENT_PARENT_TARGET_INVALID",
      );
    }

    const comment = await contentRepository.addComment(
      {
        id: generateId("cmt"),
        productId: input.productId,
        authorId: actor.id,
        text: input.text,
        rating: input.rating,
        // Article comments are not product acquisitions. Product review routes
        // set this flag only after an entitlement check.
        isVerifiedPurchase: false,
      },
      undefined,
    );

    return { comment, replayed: false };
  }

  async moderateContent(
    contentId: string,
    decision: "publish" | "archive",
    actor: User,
    currentToken: string,
    notes?: string,
    expectedUpdatedAt?: Date,
    publicationOnly = false,
  ): Promise<Content> {
    if (!can(actor, "admin.moderation")) {
      throw new ForbiddenError("Moderator privilege is required to moderate content");
    }

    const current = await contentRepository.findById(contentId);
    if (!current) throw new NotFoundError("Content", contentId);
    if (publicationOnly && !(PUBLICATION_TYPES as readonly string[]).includes(current.type))
      throw new NotFoundError("Publication");

    if (expectedUpdatedAt && current.updatedAt.getTime() !== expectedUpdatedAt.getTime())
      throw new AppError("Content changed before moderation", 409, "CONTENT_STATE_CHANGED");

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
        // The audit union has no moderator member; the stored value remains the role.
        actorType: (actor.role === "moderator" ? "moderator" : "admin") as
          | "user"
          | "system"
          | "admin",
        action: decision === "publish" ? "content.published" : "content.archived",
        targetId: contentId,
        targetType: "content",
        details: { from: current.status, to: targetStatus, notes },
      },
      currentToken,
      expectedUpdatedAt ?? new Date(current.updatedAt),
      publicationOnly,
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
      ...(isWalletEngineEnabled() ? { includeWalletPaidSingleServer: true } : { maxPrice: 0 }),
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

  listPublished(limit: number) {
    return contentRepository.listPublished(limit);
  }

  createWithAudit(...args: Parameters<typeof contentRepository.createWithAudit>) {
    return contentRepository.createWithAudit(...args);
  }
}

export const contentService = new ContentService();
