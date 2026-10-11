import { createHash } from "node:crypto";
import { discussionWorkspaceRepository } from "@nexus/db";
import { AppError, NotFoundError, type User } from "@nexus/domain";
import { generateId } from "@nexus/security";
import type {
  OwnDiscussion,
  OwnDiscussionPage,
  OwnDiscussionQuery,
} from "../discussion-workspace-contract";
const checkId = (id: string) => {
  if (!/^[a-zA-Z0-9_-]{1,128}$/u.test(id)) throw new NotFoundError("Comment");
};
class DiscussionWorkspaceService {
  async page(actor: User, filters: OwnDiscussionQuery): Promise<OwnDiscussionPage> {
    const context = createHash("sha256")
      .update(JSON.stringify([1, actor.id, filters.query, filters.availability ?? ""]))
      .digest("hex");
    if (filters.cursor && filters.cursor.context !== context)
      throw new AppError("Comment page context changed", 400, "INVALID_CURSOR");
    const result = await discussionWorkspaceRepository.page(actor.id, filters);
    return {
      items: result.items.map((row) => ({
        id: row.id,
        text: row.text,
        createdAt: row.createdAt.toISOString(),
        slug: row.slug,
        title: row.title,
        type: row.type,
        available: row.available,
      })),
      hasMore: result.hasMore,
      nextCursor: result.nextCursor
        ? JSON.stringify({ ...result.nextCursor, context, version: 1 })
        : null,
    };
  }
  async own(actor: User, id: string): Promise<OwnDiscussion> {
    checkId(id);
    const row = await discussionWorkspaceRepository.find(actor.id, id);
    return {
      id: row.id,
      text: row.text,
      contentId: row.contentId,
      createdAt: row.createdAt.toISOString(),
      slug: row.slug,
      title: row.title,
      type: row.type,
      available: row.available,
      revision: row.revision,
      editable: row.editable,
    };
  }
  async mutate(actor: User, id: string, input: { expectedRevision: string; text?: string }) {
    checkId(id);
    return discussionWorkspaceRepository.mutate({
      ...input,
      actorId: actor.id,
      commentId: id,
      auditId: generateId("aud"),
    });
  }
}
export const discussionWorkspaceService = new DiscussionWorkspaceService();
