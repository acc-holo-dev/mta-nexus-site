import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "../client";
import { comments, content, users } from "../schema";
type DiscussionCursor = { createdAt: string; id: string };
class ContentDiscussionRepository {
  async page(contentId: string, cursor?: DiscussionCursor) {
    const parent = alias(comments, "parent_comment");
    const parentAuthor = alias(users, "parent_author");
    const rows = await db
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
      .innerJoin(content, and(eq(content.id, comments.contentId), eq(content.status, "published")))
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
  }
}
export const contentDiscussionRepository = new ContentDiscussionRepository();
