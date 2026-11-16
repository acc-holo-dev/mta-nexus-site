import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { AppError, NotFoundError } from "@nexus/domain";
import { db } from "../client";
import { comments, content } from "../schema";
import { containsPattern } from "./search-pattern";
import { discussionManagementRepository, discussionRevision } from "./discussion-management";
const own = (actorId: string) =>
  and(eq(comments.authorId, actorId), isNull(comments.productId), isNotNull(comments.contentId));
const published = () =>
  sql`${content.status} = 'published' and ${content.type} in ('article','news','devlog','update','announcement','post','question','review')`;
const publicColumns = {
  slug: sql<string | null>`case when ${published()} then ${content.slug} else null end`,
  title: sql<string | null>`case when ${published()} then ${content.title} else null end`,
  type: sql<string | null>`case when ${published()} then ${content.type} else null end`,
  available: sql<boolean>`coalesce(${published()}, false)`,
};
class DiscussionWorkspaceRepository {
  async page(
    actorId: string,
    filters: {
      query: string;
      availability?: "available" | "unavailable";
      cursor?: { createdAt: string; id: string };
    },
  ) {
    const pattern = filters.query ? containsPattern(filters.query) : undefined;
    const rows = await db
      .select({
        id: comments.id,
        text: sql<string>`left(${comments.text}, 350)`,
        createdAt: comments.createdAt,
        cursorTime: sql<string>`to_char(${comments.createdAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
        ...publicColumns,
      })
      .from(comments)
      .leftJoin(content, eq(content.id, comments.contentId))
      .where(
        and(
          own(actorId),
          pattern
            ? sql`(${comments.text} ilike ${pattern} or ((${published()}) and ${content.title} ilike ${pattern}))`
            : undefined,
          filters.availability === "available"
            ? published()
            : filters.availability === "unavailable"
              ? sql`not coalesce(${published()}, false)`
              : undefined,
          filters.cursor
            ? sql`(${comments.createdAt}, ${comments.id}) < (${filters.cursor.createdAt}::timestamptz, ${filters.cursor.id})`
            : undefined,
        ),
      )
      .orderBy(desc(comments.createdAt), desc(comments.id))
      .limit(21);
    const items = rows.slice(0, 20),
      last = items.at(-1);
    return {
      items,
      hasMore: rows.length > 20,
      nextCursor: rows.length > 20 && last ? { createdAt: last.cursorTime, id: last.id } : null,
    };
  }
  async find(actorId: string, id: string) {
    const [row] = await db
      .select({
        id: comments.id,
        contentId: comments.contentId,
        text: comments.text,
        createdAt: comments.createdAt,
        ...publicColumns,
      })
      .from(comments)
      .leftJoin(content, eq(content.id, comments.contentId))
      .where(and(own(actorId), eq(comments.id, id)))
      .limit(1);
    if (!row?.contentId) throw new NotFoundError("Comment");
    return {
      ...row,
      contentId: row.contentId,
      revision: discussionRevision(row.id, row.text),
      editable: row.available && row.text.length <= 5000,
      text: row.text.slice(0, 5000),
    };
  }
  async mutate(input: {
    actorId: string;
    commentId: string;
    expectedRevision: string;
    text?: string;
    auditId: string;
  }) {
    const [scope] = await db
      .select({ contentId: comments.contentId })
      .from(comments)
      .where(and(own(input.actorId), eq(comments.id, input.commentId)))
      .limit(1);
    if (!scope?.contentId) throw new NotFoundError("Comment");
    if (!/^[a-f0-9]{64}$/u.test(input.expectedRevision))
      throw new AppError("Invalid revision", 400, "COMMENT_COMMAND_INVALID");
    // Reuse the existing content-first mutation and recheck ownership under its locks.
    return discussionManagementRepository.mutate({
      ...input,
      contentId: scope.contentId,
      ownWorkspace: true,
    });
  }
}
export const discussionWorkspaceRepository = new DiscussionWorkspaceRepository();
