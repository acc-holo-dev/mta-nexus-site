import { createHash } from "node:crypto";
import type { Follow } from "@nexus/domain";
import { AppError, NotFoundError } from "@nexus/domain";
import { and, asc, desc, eq, exists, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "../client";
import {
  builds,
  comments,
  content,
  follows,
  organizations,
  products,
  servers,
  users,
} from "../schema";
import { trustedCleanScanCondition } from "./build-safety";
import { containsPattern } from "./search-pattern";
import { userFollowNotice } from "./user-follow-notice";

type TargetType = Follow["targetType"];
type Cursor = { createdAt: string; id: string };
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
const validDiscussionId = (value: string) => /^[A-Za-z0-9_-]{1,128}$/u.test(value);
const validAudienceTime = (value: string) =>
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/u.test(value);
const availableDiscussion = and(
  eq(content.status, "published"),
  isNull(content.productId),
  inArray(content.type, [
    "article",
    "news",
    "devlog",
    "update",
    "announcement",
    "post",
    "question",
    "review",
  ]),
);
function availableResourceBuild() {
  return exists(
    db
      .select({ id: builds.id })
      .from(builds)
      .where(
        and(
          eq(builds.productId, products.id),
          eq(builds.status, "published"),
          trustedCleanScanCondition(),
        ),
      ),
  );
}
class FollowWorkspaceRepository {
  async states(actorId: string, targetType: TargetType, targetIds: readonly string[]) {
    const ids = [...new Set(targetIds)].slice(0, 50);
    if (!ids.length) return [];
    const rows = await db
      .select({ targetId: follows.targetId })
      .from(follows)
      .where(
        and(
          eq(follows.followerId, actorId),
          eq(follows.targetType, targetType),
          inArray(follows.targetId, ids),
        ),
      )
      .limit(50);
    return rows.map((row) => row.targetId);
  }
  async page(
    actorId: string,
    filters: { type?: TargetType; query?: string; cursor?: Cursor } = {},
  ) {
    const pattern = filters.query?.trim()
      ? containsPattern(filters.query.trim().slice(0, 100))
      : undefined;
    // Access conditions live in JOINs: inaccessible targets retain a removable
    // follow key but expose no title, image, URL, status or other target metadata.
    const rows = await db
      .select({
        id: follows.id,
        targetType: follows.targetType,
        targetId: follows.targetId,
        createdAt: follows.createdAt,
        cursorTime: sql<string>`to_char(${follows.createdAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
        title: sql<
          string | null
        >`coalesce(${users.displayName}, ${organizations.name}, ${servers.name}, ${products.title}, left(${content.title},200))`,
        handle: sql<
          string | null
        >`coalesce(${users.username}, ${organizations.slug}, ${servers.slug}, ${products.slug},${content.slug})`,
        description: sql<
          string | null
        >`left(coalesce(${users.bio}, ${organizations.description}, ${servers.description}, ${products.shortDescription},${content.excerpt}), 350)`,
        image: sql<
          string | null
        >`coalesce(${users.avatarUrl}, ${organizations.logoUrl}, ${servers.logoUrl},${content.coverImageUrl})`,
        verified: sql<boolean>`coalesce(${users.isVerified}, ${organizations.isVerified}, ${servers.isVerified}, false)`,
        discussion: sql<{
          replyCount: number;
          latestId: string | null;
          latestAt: string | null;
        } | null>`case when ${content.id} is not null then jsonb_build_object('replyCount',${content.commentCount},'latestId',(select id from comments where content_id=${content.id} and product_id is null order by created_at desc,id desc limit 1),'latestAt',(select to_char(created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') from comments where content_id=${content.id} and product_id is null order by created_at desc,id desc limit 1)) else null end`,
      })
      .from(follows)
      .leftJoin(users, and(eq(follows.targetType, "user"), eq(users.id, follows.targetId)))
      .leftJoin(
        organizations,
        and(eq(follows.targetType, "organization"), eq(organizations.id, follows.targetId)),
      )
      .leftJoin(
        servers,
        and(
          eq(follows.targetType, "server"),
          eq(servers.id, follows.targetId),
          inArray(servers.visibility, ["public", "unlisted"]),
          inArray(servers.status, ["active", "inactive", "maintenance"]),
        ),
      )
      .leftJoin(
        products,
        and(
          eq(follows.targetType, "product"),
          eq(products.id, follows.targetId),
          eq(products.status, "published"),
          eq(products.price, 0),
          availableResourceBuild(),
        ),
      )
      .leftJoin(
        content,
        and(
          eq(follows.targetType, "content"),
          eq(content.id, follows.targetId),
          availableDiscussion,
        ),
      )
      .where(
        and(
          eq(follows.followerId, actorId),
          inArray(follows.targetType, ["user", "organization", "server", "product", "content"]),
          filters.type ? eq(follows.targetType, filters.type) : undefined,
          pattern
            ? or(
                ilike(users.displayName, pattern),
                ilike(users.username, pattern),
                ilike(organizations.name, pattern),
                ilike(organizations.slug, pattern),
                ilike(servers.name, pattern),
                ilike(products.title, pattern),
                ilike(content.title, pattern),
                ilike(content.slug, pattern),
              )
            : undefined,
          filters.cursor
            ? sql`(${follows.createdAt}, ${follows.id}) < (${filters.cursor.createdAt}::timestamptz, ${filters.cursor.id})`
            : undefined,
        ),
      )
      .orderBy(desc(follows.createdAt), desc(follows.id))
      .limit(21);
    const items = rows.slice(0, 20);
    const last = items.at(-1);
    return {
      items,
      hasMore: rows.length > 20,
      nextCursor: rows.length > 20 && last ? { createdAt: last.cursorTime, id: last.id } : null,
    };
  }

  async discussionAudienceWithin(tx: Transaction, contentId: string, commentId: string) {
    if (![contentId, commentId].every(validDiscussionId))
      throw new AppError("Invalid discussion target", 400, "VALIDATION_ERROR");
    const [row] = await tx
      .select({
        authorId: comments.authorId,
        createdAt: sql<string>`to_char(${comments.createdAt} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
        ownerId: content.authorId,
        parentId: comments.parentId,
      })
      .from(comments)
      .innerJoin(content, and(eq(content.id, comments.contentId), availableDiscussion))
      .where(
        and(
          eq(comments.id, commentId),
          eq(comments.contentId, contentId),
          isNull(comments.productId),
        ),
      )
      .limit(1);
    if (!row) return null;
    const [parent] = row.parentId
      ? await tx
          .select({ authorId: comments.authorId })
          .from(comments)
          .where(
            and(
              eq(comments.id, row.parentId),
              eq(comments.contentId, contentId),
              isNull(comments.productId),
            ),
          )
          .limit(1)
      : [];
    return {
      authorId: row.authorId,
      createdAt: row.createdAt,
      directRecipients: [
        ...new Set(
          [row.ownerId, parent?.authorId].filter((id): id is string => !!id && id !== row.authorId),
        ),
      ],
    };
  }

  async discussionAudience(contentId: string, commentId: string) {
    if (![contentId, commentId].every(validDiscussionId))
      throw new AppError("Invalid discussion target", 400, "VALIDATION_ERROR");
    const [row] = await db
      .select({
        authorId: comments.authorId,
        createdAt: sql<string>`to_char(${comments.createdAt} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
        ownerId: content.authorId,
        parentId: comments.parentId,
      })
      .from(comments)
      .innerJoin(content, and(eq(content.id, comments.contentId), availableDiscussion))
      .where(
        and(
          eq(comments.id, commentId),
          eq(comments.contentId, contentId),
          isNull(comments.productId),
        ),
      )
      .limit(1);
    if (!row) return null;
    const [parent] = row.parentId
      ? await db
          .select({ authorId: comments.authorId })
          .from(comments)
          .where(
            and(
              eq(comments.id, row.parentId),
              eq(comments.contentId, contentId),
              isNull(comments.productId),
            ),
          )
          .limit(1)
      : [];
    return {
      authorId: row.authorId,
      createdAt: row.createdAt,
      directRecipients: [
        ...new Set(
          [row.ownerId, parent?.authorId].filter((id): id is string => !!id && id !== row.authorId),
        ),
      ],
    };
  }

  async discussionFollowersWithin(
    tx: Transaction,
    contentId: string,
    until: string,
    excluded: string[],
    cursor: Cursor | undefined,
    limit: number,
  ) {
    if (
      !validDiscussionId(contentId) ||
      !validAudienceTime(until) ||
      excluded.length > 3 ||
      excluded.some((value) => !validDiscussionId(value)) ||
      (cursor && (!validDiscussionId(cursor.id) || !validAudienceTime(cursor.createdAt))) ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 100
    )
      throw new AppError("Invalid discussion audience", 400, "VALIDATION_ERROR");
    const rows = await tx
      .select({
        id: follows.id,
        recipientId: follows.followerId,
        createdAt: sql<string>`to_char(${follows.createdAt} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
      })
      .from(follows)
      .where(
        and(
          eq(follows.targetType, "content"),
          eq(follows.targetId, contentId),
          sql`${follows.createdAt}<=${until}::timestamptz`,
          ...excluded.map((id) => ne(follows.followerId, id)),
          cursor
            ? sql`(${follows.createdAt},${follows.id})>(${cursor.createdAt}::timestamptz,${cursor.id})`
            : undefined,
        ),
      )
      .orderBy(asc(follows.createdAt), asc(follows.id))
      .limit(limit + 1);
    const items = rows.slice(0, limit);
    const last = items.at(-1);
    return {
      items,
      nextCursor: rows.length > limit && last ? { createdAt: last.createdAt, id: last.id } : null,
    };
  }

  async discussionFollowers(contentId: string, until: string, excluded: string[], cursor?: Cursor) {
    if (
      !validDiscussionId(contentId) ||
      !validAudienceTime(until) ||
      excluded.length > 3 ||
      excluded.some((value) => !validDiscussionId(value)) ||
      (cursor && (!validDiscussionId(cursor.id) || !validAudienceTime(cursor.createdAt)))
    )
      throw new AppError("Invalid discussion audience", 400, "VALIDATION_ERROR");
    const rows = await db
      .select({
        id: follows.id,
        recipientId: follows.followerId,
        createdAt: sql<string>`to_char(${follows.createdAt} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
      })
      .from(follows)
      .where(
        and(
          eq(follows.targetType, "content"),
          eq(follows.targetId, contentId),
          sql`${follows.createdAt}<=${until}::timestamptz`,
          ...excluded.map((id) => ne(follows.followerId, id)),
          cursor
            ? sql`(${follows.createdAt},${follows.id})>(${cursor.createdAt}::timestamptz,${cursor.id})`
            : undefined,
        ),
      )
      .orderBy(asc(follows.createdAt), asc(follows.id))
      .limit(51);
    const items = rows.slice(0, 50);
    const last = items.at(-1);
    return {
      items,
      nextCursor: rows.length > 50 && last ? { createdAt: last.createdAt, id: last.id } : null,
    };
  }
  async discussionNoticeWithin(
    tx: Transaction,
    recipientId: string,
    contentId: string,
    commentId: string,
  ) {
    if (![recipientId, contentId, commentId].every(validDiscussionId))
      throw new AppError("Invalid discussion recipient", 400, "VALIDATION_ERROR");
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${JSON.stringify([recipientId, "content", contentId])},0))`,
    );
    const [publication] = await tx
      .select({ id: content.id, slug: content.slug, ownerId: content.authorId })
      .from(content)
      .where(and(eq(content.id, contentId), availableDiscussion))
      .for("share")
      .limit(1);
    if (!publication) return null;
    const [comment] = await tx
      .select({
        authorId: comments.authorId,
        parentId: comments.parentId,
        createdAt: sql<string>`to_char(${comments.createdAt} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
      })
      .from(comments)
      .where(
        and(
          eq(comments.id, commentId),
          eq(comments.contentId, contentId),
          isNull(comments.productId),
        ),
      )
      .for("share")
      .limit(1);
    if (!comment || comment.authorId === recipientId) return null;
    const [parent] = comment.parentId
      ? await tx
          .select({ authorId: comments.authorId })
          .from(comments)
          .where(
            and(
              eq(comments.id, comment.parentId),
              eq(comments.contentId, contentId),
              isNull(comments.productId),
            ),
          )
          .limit(1)
      : [];
    const [follow] = await tx
      .select({ id: follows.id })
      .from(follows)
      .where(
        and(
          eq(follows.followerId, recipientId),
          eq(follows.targetType, "content"),
          eq(follows.targetId, contentId),
          sql`${follows.createdAt}<=${comment.createdAt}::timestamptz`,
        ),
      )
      .for("share")
      .limit(1);
    const direct = publication.ownerId === recipientId || parent?.authorId === recipientId;
    if (!direct && !follow) return null;
    return {
      direct,
      following: !!follow,
      id: `ntf_reply_${createHash("sha256")
        .update(JSON.stringify([1, contentId, commentId, recipientId]))
        .digest("hex")}`,
      link: `/articles/${encodeURIComponent(publication.slug)}?comment=${encodeURIComponent(commentId)}#comment-${encodeURIComponent(commentId)}`,
    };
  }

  async setFollowing(
    actorId: string,
    targetType: TargetType,
    targetId: string,
    following: boolean,
    id: string,
  ) {
    if (following && targetType === "user" && targetId === actorId)
      throw new AppError("Cannot follow yourself", 400, "SELF_FOLLOW");
    return db.transaction(async (tx) => {
      // Serialize desired-state commands for one actor/target, including
      // deletion when a polymorphic target has already disappeared.
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${JSON.stringify([actorId, targetType, targetId])}, 0))`,
      );
      const key = and(
        eq(follows.followerId, actorId),
        eq(follows.targetType, targetType),
        eq(follows.targetId, targetId),
      );
      if (!following) {
        await tx.delete(follows).where(key);
        return { following: false, created: false };
      }
      // Share-lock the target through commit so a simultaneous archive,
      // suspension or privacy update cannot bypass the availability policy.
      let target: { id: string }[];
      switch (targetType) {
        case "user":
          target = await tx
            .select({ id: users.id })
            .from(users)
            .where(eq(users.id, targetId))
            .for("share")
            .limit(1);
          break;
        case "organization":
          target = await tx
            .select({ id: organizations.id })
            .from(organizations)
            .where(eq(organizations.id, targetId))
            .for("share")
            .limit(1);
          break;
        case "server":
          target = await tx
            .select({ id: servers.id })
            .from(servers)
            .where(
              and(
                eq(servers.id, targetId),
                inArray(servers.visibility, ["public", "unlisted"]),
                inArray(servers.status, ["active", "inactive", "maintenance"]),
              ),
            )
            .for("share")
            .limit(1);
          break;
        case "content":
          target = await tx
            .select({ id: content.id })
            .from(content)
            .where(and(eq(content.id, targetId), availableDiscussion))
            .for("share")
            .limit(1);
          break;
        case "product":
          target = await tx
            .select({ id: products.id })
            .from(products)
            .where(
              and(
                eq(products.id, targetId),
                eq(products.status, "published"),
                eq(products.price, 0),
                availableResourceBuild(),
              ),
            )
            .for("share")
            .limit(1);
          break;
      }
      if (!target.length) throw new NotFoundError("Follow target");
      const [created] = await tx
        .insert(follows)
        .values({
          id,
          followerId: actorId,
          targetType,
          targetId,
          createdAt: targetType === "content" ? sql`clock_timestamp()` : new Date(),
        })
        .onConflictDoNothing()
        .returning({ id: follows.id });
      if (!created) {
        const [existing] = await tx.select({ id: follows.id }).from(follows).where(key).limit(1);
        if (!existing) throw new AppError("Follow could not be confirmed", 503, "UNCONFIRMED");
      } else if (targetType === "user") {
        const [follower] = await tx
          .select({ username: users.username })
          .from(users)
          .where(eq(users.id, actorId))
          .limit(1);
        if (follower) await userFollowNotice(tx, created.id, targetId, follower.username);
      }
      return { following: true, created: !!created };
    });
  }
}
export const followWorkspaceRepository = new FollowWorkspaceRepository();
