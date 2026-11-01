import { and, eq, isNull, sql } from "drizzle-orm";
import { AppError, NotFoundError, type AuditEvent, type Comment } from "@nexus/domain";
import { db } from "../client";
import {
  auditEvents,
  comments,
  content,
  discussionNotificationDeliveries,
} from "../schema";

const uuidV4 = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;

export type ArticleCommentMutationResult =
  | { kind: "created" | "replayed"; comment: Comment }
  | { kind: "key_conflict" };

/** Durable receipt: UUIDv4 intent key becomes the comments.id primary key. */
export function parseCommentIntentKey(value: string | null | undefined): string | null {
  return typeof value === "string" && uuidV4.test(value) ? value : null;
}

export function commentIdFromIntentKey(intentKey: string): string {
  if (!uuidV4.test(intentKey)) {
    throw new AppError("Invalid comment intent key", 400, "COMMENT_IDEMPOTENCY_KEY_INVALID");
  }
  return `cmt_${intentKey.replaceAll("-", "")}`;
}

function sameParent(left: string | null | undefined, right: string | null | undefined) {
  return (left ?? null) === (right ?? null);
}

function matchesIntent(
  existing: {
    authorId: string;
    contentId: string | null;
    parentId: string | null;
    text: string;
    productId: string | null;
  },
  expected: {
    authorId: string;
    contentId: string;
    parentId?: string;
    text: string;
  },
) {
  return (
    existing.productId === null &&
    existing.authorId === expected.authorId &&
    existing.contentId === expected.contentId &&
    sameParent(existing.parentId, expected.parentId) &&
    existing.text === expected.text
  );
}

/**
 * Actor-scoped article comment create with lost-response replay.
 * Intent key is stored as comments.id — no separate idempotency table.
 */
export class ContentCommentsRepository {
  async addArticleComment(input: {
    intentKey: string;
    contentId: string;
    authorId: string;
    text: string;
    parentId?: string;
    audit: Omit<AuditEvent, "createdAt">;
  }): Promise<ArticleCommentMutationResult> {
    const intentKey = parseCommentIntentKey(input.intentKey);
    if (!intentKey) {
      throw new AppError("Invalid comment intent key", 400, "COMMENT_IDEMPOTENCY_KEY_INVALID");
    }
    const id = commentIdFromIntentKey(intentKey);
    const text = input.text.trim();
    const expected = {
      authorId: input.authorId,
      contentId: input.contentId,
      parentId: input.parentId,
      text,
    };

    const created = await db.transaction(async (tx) => {
      const [target] = await tx
        .select({ status: content.status })
        .from(content)
        .where(eq(content.id, input.contentId))
        .limit(1)
        .for("update");
      if (target?.status !== "published") throw new NotFoundError("Content");

      if (input.parentId) {
        const [parent] = await tx
          .select({ id: comments.id })
          .from(comments)
          .where(
            and(
              eq(comments.id, input.parentId),
              eq(comments.contentId, input.contentId),
              isNull(comments.productId),
            ),
          )
          .limit(1)
          .for("share");
        if (!parent) throw new AppError("Parent not found", 400, "COMMENT_PARENT_NOT_FOUND");
      }

      const createdAt = sql<Date>`clock_timestamp()`;
      const [inserted] = await tx
        .insert(comments)
        .values({
          id,
          contentId: input.contentId,
          authorId: input.authorId,
          parentId: input.parentId,
          text,
          isVerifiedPurchase: false,
          createdAt,
        })
        .onConflictDoNothing()
        .returning();

      if (!inserted) return null;

      await tx
        .update(content)
        .set({
          commentCount: sql`${content.commentCount} + 1`,
        })
        .where(eq(content.id, input.contentId));

      const deliveryCreatedAt = sql`(select ${comments.createdAt} from ${comments} where ${comments.id} = ${inserted.id})`;
      await tx.insert(discussionNotificationDeliveries).values({
        commentId: inserted.id,
        contentId: input.contentId,
        createdAt: deliveryCreatedAt,
      });
      await tx.insert(auditEvents).values({
        ...input.audit,
        createdAt,
      });

      return inserted as unknown as Comment;
    });

    if (created) return { kind: "created", comment: created };

    const [existing] = await db
      .select()
      .from(comments)
      .where(eq(comments.id, id))
      .limit(1);
    if (!existing) {
      throw new Error("Missing comment after idempotent conflict");
    }
    if (!matchesIntent(existing, expected)) {
      return { kind: "key_conflict" };
    }
    return { kind: "replayed", comment: existing as unknown as Comment };
  }
}

export const contentCommentsRepository = new ContentCommentsRepository();
