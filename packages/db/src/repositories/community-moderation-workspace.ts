import { createHash } from "node:crypto";
import { AppError, ForbiddenError, NotFoundError } from "@nexus/domain";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "../client";
import { auditEvents, comments, content, organizations, servers, users } from "../schema";
import { moderationDiscussionRevision } from "./discussion-management";
import { containsPattern } from "./search-pattern";

type Cursor = { createdAt: string; id: string; context: string };
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
const types = ["article", "news", "devlog", "update", "announcement", "post", "question", "review"];
const hash = (parts: unknown[]) => createHash("sha256").update(JSON.stringify(parts)).digest("hex");
async function staff(tx: Transaction, actorId: string) {
  const [actor] = await tx
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, actorId))
    .limit(1);
  if (!actor || !["admin", "moderator"].includes(actor.role)) throw new ForbiddenError();
}
const identity = { username: users.username, name: users.displayName, avatar: users.avatarUrl };
const summary = {
  id: content.id,
  slug: content.slug,
  title: content.title,
  type: content.type,
  status: content.status,
  excerpt: sql<string>`left(coalesce(nullif(${content.excerpt}, ''), ${content.body}),350)`,
  updatedAt: content.updatedAt,
  createdAt: content.createdAt,
  ...identity,
};
const exactTime = (column: typeof content.updatedAt | typeof auditEvents.createdAt) =>
  sql<string>`to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
class CommunityModerationWorkspaceRepository {
  async discussion(
    actorId: string,
    id: string,
    filters: { query: string; author?: string; cursor?: Cursor },
  ) {
    return db.transaction(
      async (tx) => {
        await staff(tx, actorId);
        const publication = await this.discussionPublication(tx, id);
        const context = hash([
          1,
          "moderation-discussion-page",
          actorId,
          id,
          filters.query,
          filters.author?.toLowerCase() ?? "",
        ]);
        if (filters.cursor && filters.cursor.context !== context)
          throw new AppError("Discussion filters changed", 400, "INVALID_CURSOR");
        const pattern = filters.query ? containsPattern(filters.query) : undefined;
        const rows = await tx
          .select({
            id: comments.id,
            text: sql<string>`left(${comments.text},350)`,
            createdAt: comments.createdAt,
            cursorTime: sql<string>`to_char(${comments.createdAt} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
            username: users.username,
            name: users.displayName,
          })
          .from(comments)
          .leftJoin(users, eq(users.id, comments.authorId))
          .where(
            and(
              eq(comments.contentId, id),
              sql`${comments.productId} is null`,
              pattern
                ? or(
                    ilike(comments.text, pattern),
                    ilike(users.username, pattern),
                    ilike(users.displayName, pattern),
                  )
                : undefined,
              filters.author
                ? sql`lower(${users.username}) = ${filters.author.toLowerCase()}`
                : undefined,
              filters.cursor
                ? sql`(${comments.createdAt},${comments.id}) < (${filters.cursor.createdAt}::timestamptz,${filters.cursor.id})`
                : undefined,
            ),
          )
          .orderBy(desc(comments.createdAt), desc(comments.id))
          .limit(21);
        const items = rows.slice(0, 20),
          last = items.at(-1);
        return {
          publication,
          items,
          context,
          hasMore: rows.length > 20,
          nextCursor: rows.length > 20 && last ? { createdAt: last.cursorTime, id: last.id } : null,
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
  private async discussionPublication(tx: Transaction, id: string) {
    const [publication] = await tx
      .select({
        id: content.id,
        title: content.title,
        slug: content.slug,
        type: content.type,
        status: content.status,
      })
      .from(content)
      .where(
        and(
          eq(content.id, id),
          inArray(content.type, types),
          inArray(content.status, ["draft", "published", "archived"]),
        ),
      )
      .limit(1);
    if (!publication) throw new NotFoundError("Publication");
    return publication;
  }
  async discussionDetail(actorId: string, id: string, commentId: string, cursor?: Cursor) {
    return db.transaction(
      async (tx) => {
        await staff(tx, actorId);
        const publication = await this.discussionPublication(tx, id),
          context = hash([1, "moderation-discussion-history", actorId, id, commentId]);
        if (cursor && cursor.context !== context)
          throw new AppError("Discussion history changed", 400, "INVALID_CURSOR");
        const [comment] = await tx
          .select({
            id: comments.id,
            text: sql<string>`left(${comments.text},5000)`,
            truncated: sql<boolean>`length(${comments.text}) > 5000`,
            digest: sql<string>`encode(sha256(convert_to(${comments.text},'UTF8')),'hex')`,
            createdAt: comments.createdAt,
            username: users.username,
            name: users.displayName,
            parent: sql<
              string | null
            >`(select left(parent.text,350) from comments parent where parent.id = ${comments.parentId} and parent.content_id = ${comments.contentId} and parent.product_id is null limit 1)`,
          })
          .from(comments)
          .leftJoin(users, eq(users.id, comments.authorId))
          .where(
            and(
              eq(comments.contentId, id),
              eq(comments.id, commentId),
              sql`${comments.productId} is null`,
            ),
          )
          .limit(1);
        if (!comment) {
          const [removed] = await tx
            .select({ id: auditEvents.id })
            .from(auditEvents)
            .where(
              and(
                eq(auditEvents.targetType, "comment"),
                eq(auditEvents.targetId, commentId),
                eq(auditEvents.action, "content.comment_removed"),
                sql`${auditEvents.details}->>'contentId' = ${id}`,
              ),
            )
            .limit(1);
          if (!removed) throw new NotFoundError("Comment");
        }
        const rows = await tx
          .select({
            id: auditEvents.id,
            action: auditEvents.action,
            createdAt: auditEvents.createdAt,
            cursorTime: exactTime(auditEvents.createdAt),
            moderator: sql<boolean>`coalesce(${auditEvents.details}->'moderator' = 'true'::jsonb,false)`,
            reason: sql<
              string | null
            >`case when jsonb_typeof(${auditEvents.details}->'reason') = 'string' then left(${auditEvents.details}->>'reason',1000) else null end`,
          })
          .from(auditEvents)
          .where(
            and(
              eq(auditEvents.targetType, "comment"),
              eq(auditEvents.targetId, commentId),
              inArray(auditEvents.action, ["content.comment_edited", "content.comment_removed"]),
              sql`${auditEvents.details}->>'contentId' = ${id}`,
              cursor
                ? sql`(${auditEvents.createdAt},${auditEvents.id}) < (${cursor.createdAt}::timestamptz,${cursor.id})`
                : undefined,
            ),
          )
          .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
          .limit(21);
        const history = rows.slice(0, 20),
          last = history.at(-1);
        return {
          publication,
          comment: comment
            ? { ...comment, revision: moderationDiscussionRevision(id, comment.id, comment.digest) }
            : null,
          history,
          context,
          hasMore: rows.length > 20,
          nextCursor: rows.length > 20 && last ? { createdAt: last.cursorTime, id: last.id } : null,
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
  async page(
    actorId: string,
    filters: {
      query: string;
      status?: "draft" | "published" | "archived";
      type?: string;
      author?: string;
      cursor?: Cursor;
    },
  ) {
    return db.transaction(
      async (tx) => {
        await staff(tx, actorId);
        const context = hash([
          1,
          "community-moderation",
          actorId,
          filters.query,
          filters.status ?? "",
          filters.type ?? "",
          filters.author?.toLowerCase() ?? "",
        ]);
        if (filters.cursor && filters.cursor.context !== context)
          throw new AppError("Moderation filters changed", 400, "INVALID_CURSOR");
        const pattern = filters.query ? containsPattern(filters.query) : undefined;
        const rows = await tx
          .select({ ...summary, cursorTime: exactTime(content.updatedAt) })
          .from(content)
          .innerJoin(users, eq(users.id, content.authorId))
          .where(
            and(
              inArray(content.type, types),
              inArray(content.status, ["draft", "published", "archived"]),
              filters.status ? eq(content.status, filters.status) : undefined,
              filters.type ? eq(content.type, filters.type) : undefined,
              filters.author
                ? sql`lower(${users.username}) = ${filters.author.toLowerCase()}`
                : undefined,
              pattern
                ? or(
                    ilike(content.title, pattern),
                    ilike(content.body, pattern),
                    ilike(users.username, pattern),
                    ilike(users.displayName, pattern),
                  )
                : undefined,
              filters.cursor
                ? sql`(${content.updatedAt},${content.id}) < (${filters.cursor.createdAt}::timestamptz,${filters.cursor.id})`
                : undefined,
            ),
          )
          .orderBy(desc(content.updatedAt), desc(content.id))
          .limit(21);
        const items = rows.slice(0, 20),
          last = items.at(-1);
        return {
          items,
          context,
          hasMore: rows.length > 20,
          nextCursor: rows.length > 20 && last ? { createdAt: last.cursorTime, id: last.id } : null,
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
  async detail(actorId: string, id: string, cursor?: Cursor) {
    return db.transaction(
      async (tx) => {
        await staff(tx, actorId);
        const context = hash([1, "community-review-history", actorId, id]);
        if (cursor && cursor.context !== context)
          throw new AppError("Review history context changed", 400, "INVALID_CURSOR");
        const [item] = await tx
          .select({
            ...summary,
            body: sql<string>`left(${content.body},100000)`,
            truncated: sql<boolean>`length(${content.body}) > 100000`,
            tags: sql<
              string[]
            >`(select coalesce(jsonb_agg(left(tag.value,30)), '[]'::jsonb) from (select value from jsonb_array_elements_text(${content.tags}) limit 10) tag)`,
            organizationName: organizations.name,
            organizationSlug: organizations.slug,
            serverName: servers.name,
            serverSlug: servers.slug,
          })
          .from(content)
          .innerJoin(users, eq(users.id, content.authorId))
          .leftJoin(organizations, eq(organizations.id, content.organizationId))
          .leftJoin(
            servers,
            and(
              eq(servers.id, content.serverId),
              eq(servers.visibility, "public"),
              eq(servers.status, "active"),
            ),
          )
          .where(
            and(
              eq(content.id, id),
              inArray(content.type, types),
              inArray(content.status, ["draft", "published", "archived"]),
            ),
          )
          .limit(1);
        if (!item) throw new NotFoundError("Publication");
        const rows = await tx
          .select({
            id: auditEvents.id,
            action: auditEvents.action,
            createdAt: auditEvents.createdAt,
            cursorTime: exactTime(auditEvents.createdAt),
            from: sql<string | null>`${auditEvents.details}->>'from'`,
            to: sql<string | null>`${auditEvents.details}->>'to'`,
            notes: sql<string | null>`left(${auditEvents.details}->>'notes',2000)`,
          })
          .from(auditEvents)
          .where(
            and(
              eq(auditEvents.targetType, "content"),
              eq(auditEvents.targetId, id),
              inArray(auditEvents.action, ["content.published", "content.archived"]),
              cursor
                ? sql`(${auditEvents.createdAt},${auditEvents.id}) < (${cursor.createdAt}::timestamptz,${cursor.id})`
                : undefined,
            ),
          )
          .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
          .limit(21);
        const history = rows.slice(0, 20),
          last = history.at(-1);
        return {
          item,
          history,
          context,
          hasMore: rows.length > 20,
          nextCursor: rows.length > 20 && last ? { createdAt: last.cursorTime, id: last.id } : null,
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
}
export const communityModerationWorkspaceRepository = new CommunityModerationWorkspaceRepository();
