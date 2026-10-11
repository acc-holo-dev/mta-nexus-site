import { createHash } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { AppError, NotFoundError, ForbiddenError } from "@nexus/domain";
import { db } from "../client";
import { auditEvents, comments, content, users } from "../schema";
import { discussionModerationNotice } from "./discussion-moderation-notice";
export const discussionRevision = (id: string, text: string) =>
  createHash("sha256")
    .update(JSON.stringify([id, text]))
    .digest("hex");
class DiscussionManagementRepository {
  async mutate(input: {
    slug?: string;
    contentId?: string;
    ownWorkspace?: boolean;
    commentId: string;
    actorId: string;
    expectedRevision: string;
    text?: string;
    reason?: string;
    auditId: string;
  }) {
    if (input.ownWorkspace ? !input.contentId || !!input.slug : !input.slug || !!input.contentId)
      throw new AppError("Invalid discussion scope", 400, "COMMENT_COMMAND_INVALID");
    return db.transaction(async (tx) => {
      // Same lock order as creation: publication, then comment. Archiving cannot race a write.
      const [publication] = await tx
        .select({ id: content.id, status: content.status, slug: content.slug, type: content.type })
        .from(content)
        .where(
          input.ownWorkspace
            ? eq(content.id, input.contentId as string)
            : eq(content.slug, input.slug as string),
        )
        .for("update")
        .limit(1);
      if (!publication || (!input.ownWorkspace && publication.status !== "published"))
        throw new NotFoundError("Content");
      const [current] = await tx
        .select({ id: comments.id, text: comments.text, authorId: comments.authorId })
        .from(comments)
        .where(
          and(
            eq(comments.id, input.commentId),
            eq(comments.contentId, publication.id),
            isNull(comments.productId),
            input.ownWorkspace ? eq(comments.authorId, input.actorId) : undefined,
          ),
        )
        .for("update")
        .limit(1);
      if (!current) throw new NotFoundError("Comment");
      const [actor] = await tx
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, input.actorId))
        .for("share")
        .limit(1);
      const own = current.authorId === input.actorId;
      const moderator = !!actor && ["admin", "moderator"].includes(actor.role);
      if (input.ownWorkspace && !own) throw new ForbiddenError();
      if (!actor || (!own && (input.text !== undefined || !moderator))) throw new ForbiddenError();
      if (input.text !== undefined && publication.status !== "published")
        throw new AppError("Publication unavailable for editing", 409, "DISCUSSION_UNAVAILABLE");
      if (
        input.ownWorkspace &&
        input.text !== undefined &&
        ![
          "article",
          "news",
          "devlog",
          "update",
          "announcement",
          "post",
          "question",
          "review",
        ].includes(publication.type)
      )
        throw new AppError("Publication unavailable for editing", 409, "DISCUSSION_UNAVAILABLE");
      if (!own && !input.reason?.trim())
        throw new AppError("A moderation reason is required", 400, "COMMENT_REASON_REQUIRED");
      if (discussionRevision(current.id, current.text) !== input.expectedRevision)
        throw new AppError("Comment changed", 409, "COMMENT_CHANGED");
      if (input.text !== undefined) {
        await tx.update(comments).set({ text: input.text }).where(eq(comments.id, current.id));
      } else {
        // Replies remain intact and render an unavailable-parent label.
        await tx.delete(comments).where(eq(comments.id, current.id));
        await tx
          .update(content)
          .set({ commentCount: sql`greatest(0, ${content.commentCount} - 1)` })
          .where(eq(content.id, publication.id));
      }
      await tx.insert(auditEvents).values({
        id: input.auditId,
        actorId: input.actorId,
        actorType: own ? "user" : "admin",
        action: input.text !== undefined ? "content.comment_edited" : "content.comment_removed",
        targetType: "comment",
        targetId: current.id,
        details: {
          contentId: publication.id,
          moderator: !own,
          ...(input.reason ? { reason: input.reason } : {}),
        },
      });
      if (!own && input.text === undefined)
        await discussionModerationNotice(tx, {
          auditId: input.auditId,
          authorId: current.authorId,
          commentId: current.id,
          slug: publication.slug ?? (input.slug as string),
        });
      return {
        contentId: publication.id,
        commentId: current.id,
        ...(input.text !== undefined
          ? { text: input.text, revision: discussionRevision(current.id, input.text) }
          : { removed: true }),
      };
    });
  }
}
export const discussionManagementRepository = new DiscussionManagementRepository();
