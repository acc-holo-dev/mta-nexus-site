import {
  discussionManagementRepository,
  communityModerationWorkspaceRepository as repository,
} from "@nexus/db";
import { AppError, ForbiddenError, NotFoundError, type User } from "@nexus/domain";
import { can, generateId } from "@nexus/security";
import { safeExternalWebUrl } from "@nexus/validation";
import type { z } from "zod";
import type { ModerationQuery, moderationCommandSchema } from "../community-moderation-contract";
import type { DiscussionReportsQuery } from "../discussion-reports-contract";
import {
  type ModeratedDiscussionQuery,
  moderatedDiscussionRemoveSchema,
} from "../moderated-discussion-contract";
import { contentService } from "./content-service";

function authority(actor: User, id?: string) {
  if (!can(actor, "admin.moderation")) throw new ForbiddenError();
  if (id !== undefined && !/^[a-zA-Z0-9_-]{1,128}$/u.test(id))
    throw new NotFoundError("Publication");
}
type Row = Omit<Awaited<ReturnType<typeof repository.page>>["items"][number], "cursorTime">;
const summary = (row: Row) => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  type: row.type,
  status: row.status,
  excerpt: row.excerpt,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  author: {
    username: row.username,
    name: row.name,
    avatar: safeExternalWebUrl(row.avatar) ?? null,
  },
});
const encode = (result: {
  nextCursor: { createdAt: string; id: string } | null;
  context: string;
}) =>
  result.nextCursor
    ? JSON.stringify({ ...result.nextCursor, context: result.context, version: 1 })
    : null;
class CommunityModerationService {
  async discussionReports(
    actor: User,
    id: string,
    commentId: string,
    filters: DiscussionReportsQuery,
  ) {
    authority(actor, id);
    authority(actor, commentId);
    const result = await repository.discussionReports(actor.id, id, commentId, filters);
    return {
      publication: result.publication,
      commentId: result.commentId,
      removed: result.removed,
      items: result.items.map((item) => ({
        id: item.id,
        type: item.type,
        reason: item.reason,
        status: item.status,
        createdAt: item.createdAt.toISOString(),
        resolvedAt: item.resolvedAt?.toISOString() ?? null,
      })),
      hasMore: result.hasMore,
      nextCursor: encode(result),
    };
  }
  async discussion(actor: User, id: string, filters: ModeratedDiscussionQuery) {
    authority(actor, id);
    const result = await repository.discussion(actor.id, id, filters);
    return {
      publication: result.publication,
      items: result.items.map((item) => ({
        id: item.id,
        text: item.text,
        createdAt: item.createdAt.toISOString(),
        author: item.username && item.name ? { username: item.username, name: item.name } : null,
      })),
      hasMore: result.hasMore,
      nextCursor: encode(result),
    };
  }
  async discussionDetail(
    actor: User,
    id: string,
    commentId: string,
    cursor?: ModeratedDiscussionQuery["cursor"],
  ) {
    authority(actor, id);
    authority(actor, commentId);
    const result = await repository.discussionDetail(actor.id, id, commentId, cursor),
      row = result.comment;
    return {
      publication: result.publication,
      comment: row
        ? {
            id: row.id,
            text: row.text,
            truncated: row.truncated,
            revision: row.revision,
            createdAt: row.createdAt.toISOString(),
            author: row.username && row.name ? { username: row.username, name: row.name } : null,
            parent: row.parent,
          }
        : null,
      history: result.history.map((event) => ({
        id: event.id,
        action: event.action,
        moderator: event.moderator,
        reason: event.reason,
        createdAt: event.createdAt.toISOString(),
      })),
      hasMore: result.hasMore,
      nextCursor: encode(result),
    };
  }
  async removeDiscussion(actor: User, id: string, commentId: string, input: unknown) {
    authority(actor, id);
    authority(actor, commentId);
    const parsed = moderatedDiscussionRemoveSchema.safeParse(input);
    if (!parsed.success) throw new AppError("Invalid removal command", 400, "VALIDATION_ERROR");
    return discussionManagementRepository.mutate({
      actorId: actor.id,
      contentId: id,
      commentId,
      moderationWorkspace: true,
      ...parsed.data,
      auditId: generateId("aud"),
    });
  }
  async page(actor: User, filters: ModerationQuery) {
    authority(actor);
    const result = await repository.page(actor.id, filters);
    return {
      items: result.items.map(summary),
      hasMore: result.hasMore,
      nextCursor: encode(result),
    };
  }
  async detail(actor: User, id: string, cursor?: ModerationQuery["cursor"]) {
    authority(actor, id);
    const result = await repository.detail(actor.id, id, cursor),
      row = result.item;
    const context = (name: string | null, slug: string | null, path: string) =>
      name && slug ? { name, href: `/${path}/${encodeURIComponent(slug)}` } : null;
    const state = (value: string | null) =>
      value && ["draft", "published", "archived"].includes(value) ? value : null;
    return {
      item: {
        ...summary(row),
        body: row.body,
        truncated: row.truncated,
        tags: row.tags,
        organization: context(row.organizationName, row.organizationSlug, "organizations"),
        server: context(row.serverName, row.serverSlug, "servers"),
      },
      history: result.history.map((event) => ({
        id: event.id,
        action: event.action,
        createdAt: event.createdAt.toISOString(),
        from: state(event.from),
        to: state(event.to),
        notes: event.notes,
      })),
      hasMore: result.hasMore,
      nextCursor: encode(result),
    };
  }
  async command(
    actor: User,
    id: string,
    input: z.infer<typeof moderationCommandSchema>,
    currentToken: string,
  ) {
    authority(actor, id);
    if (input.action === "publish") {
      const review = await repository.detail(actor.id, id);
      if (review.item.truncated)
        throw new AppError("Full review unavailable", 422, "CONTENT_REVIEW_TOO_LARGE");
    }
    const result = await contentService.moderateContent(
      id,
      input.action,
      actor,
      currentToken,
      input.notes,
      new Date(input.expectedUpdatedAt),
      true,
    );
    return {
      id: result.id,
      action: input.action,
      status: result.status,
      updatedAt: result.updatedAt.toISOString(),
    };
  }
}
export const communityModerationService = new CommunityModerationService();
