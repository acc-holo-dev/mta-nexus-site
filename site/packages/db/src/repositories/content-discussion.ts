import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { AppError } from "@nexus/domain";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../client";
import { comments, content, users } from "../schema";
import { containsPattern } from "./search-pattern";
type DiscussionCursor = { createdAt: string; id: string };
class ContentDiscussionRepository {
  async page(
    contentId: string,
    cursor?: DiscussionCursor,
    options: { query?: string; focusId?: string } = {},
  ) {
    const query = options.query?.trim().slice(0, 120) ?? "";
    if (options.focusId && (query || cursor))
      throw new AppError("Invalid comment focus", 400, "INVALID_CURSOR");
    return db.transaction(
      async (tx) => {
        let focused: { createdAt: string; id: string } | undefined;
        if (options.focusId) {
          const [anchor] = await tx
            .select({
              id: comments.id,
              createdAt: sql<string>`to_char(${comments.createdAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
            })
            .from(comments)
            .innerJoin(
              content,
              and(eq(content.id, comments.contentId), eq(content.status, "published")),
            )
            .where(
              and(
                eq(comments.id, options.focusId),
                eq(comments.contentId, contentId),
                isNull(comments.productId),
              ),
            )
            .limit(1);
          if (!anchor) throw new AppError("Comment unavailable", 404, "COMMENT_FOCUS_NOT_FOUND");
          focused = anchor;
        }
        const pattern = query ? containsPattern(query) : undefined;
        const parent = alias(comments, "parent_comment");
        const parentAuthor = alias(users, "parent_author");
        const rows = await tx
          .select({
            id: comments.id,
            contentId: comments.contentId,
            text: comments.text,
            parentId: comments.parentId,
            createdAt: comments.createdAt,
            // Preserve PostgreSQL's microseconds in the keyset cursor; Date loses them.
            cursorTime: sql<string>`to_char(${comments.createdAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
            authorId: users.id,
            username: users.username,
            displayName: users.displayName,
            avatarUrl: users.avatarUrl,
            parentText: sql<string | null>`left(${parent.text}, 160)`,
            parentUsername: parentAuthor.username,
          })
          .from(comments)
          .innerJoin(
            content,
            and(eq(content.id, comments.contentId), eq(content.status, "published")),
          )
          .leftJoin(users, eq(users.id, comments.authorId))
          .leftJoin(
            parent,
            and(
              eq(parent.id, comments.parentId),
              eq(parent.contentId, comments.contentId),
              isNull(parent.productId),
            ),
          )
          .leftJoin(parentAuthor, eq(parentAuthor.id, parent.authorId))
          .where(
            and(
              eq(comments.contentId, contentId),
              isNull(comments.productId),
              pattern
                ? or(
                    ilike(comments.text, pattern),
                    ilike(users.username, pattern),
                    ilike(users.displayName, pattern),
                  )
                : undefined,
              focused
                ? sql`(${comments.createdAt}, ${comments.id}) <= (${focused.createdAt}::timestamptz, ${focused.id})`
                : undefined,
              cursor
                ? sql`(${comments.createdAt}, ${comments.id}) < (${cursor.createdAt}::timestamptz, ${cursor.id})`
                : undefined,
            ),
          )
          .orderBy(desc(comments.createdAt), desc(comments.id))
          .limit(21);
        const items = rows.slice(0, 20);
        const last = items.at(-1);
        return {
          items,
          hasMore: rows.length > 20,
          nextCursor: rows.length > 20 && last ? { createdAt: last.cursorTime, id: last.id } : null,
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
}
export const contentDiscussionRepository = new ContentDiscussionRepository();
