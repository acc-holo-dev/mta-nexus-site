import { createHash } from "node:crypto";
import type { Follow, ObjectMuteDuration } from "@nexus/domain";
import { AppError, NotFoundError, UnauthorizedError } from "@nexus/domain";
import { and, asc, desc, eq, exists, gt, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "../client";
import {
  builds,
  comments,
  content,
  follows,
  objectNotificationMutes,
  organizations,
  products,
  servers,
  users,
} from "../schema";
import { trustedCleanScanCondition } from "./build-safety";
import { containsPattern } from "./search-pattern";
import { userFollowNotice } from "./user-follow-notice";
import { lockInitiatingSession } from "./initiating-session";

type TargetType = Follow["targetType"];
type Cursor = { createdAt: string; id: string };
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
const MUTE_DURATIONS = {
  "24h": sql`clock_timestamp() + interval '24 hours'`,
  "7d": sql`clock_timestamp() + interval '7 days'`,
  "30d": sql`clock_timestamp() + interval '30 days'`,
} as const;
const validDiscussionId = (value: string) => /^[A-Za-z0-9_-]{1,128}$/u.test(value);
const validAudienceTime = (value: string) =>
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/u.test(value);
const notActivelyMuted = (
  userIdColumn: typeof follows.followerId,
  targetType: TargetType,
  targetId: string,
) =>
  sql`not exists (
    select 1 from ${objectNotificationMutes}
    where ${objectNotificationMutes.userId} = ${userIdColumn}
      and ${objectNotificationMutes.targetType} = ${targetType}
      and ${objectNotificationMutes.targetId} = ${targetId}
      and ${objectNotificationMutes.mutedUntil} > clock_timestamp()
  )`;
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

  async contentStates(actorId: string, targetIds: readonly string[]) {
    const ids = [...new Set(targetIds)].slice(0, 50);
    if (!ids.length) return [];
    const rows = await db
      .select({
        targetId: follows.targetId,
        notifyComments: follows.notifyComments,
        mutedUntil: sql<
          string | null
        >`case when ${objectNotificationMutes.mutedUntil} > clock_timestamp() then to_char(${objectNotificationMutes.mutedUntil} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') else null end`,
      })
      .from(follows)
      .leftJoin(
        objectNotificationMutes,
        and(
          eq(objectNotificationMutes.userId, actorId),
          eq(objectNotificationMutes.targetType, "content"),
          eq(objectNotificationMutes.targetId, follows.targetId),
        ),
      )
      .where(
        and(
          eq(follows.followerId, actorId),
          eq(follows.targetType, "content"),
          inArray(follows.targetId, ids),
        ),
      )
      .limit(50);
    return rows;
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
    // Removal uses the follow row id/type only — never requires leaked target fields.
    const rows = await db
      .select({
        id: follows.id,
        targetType: follows.targetType,
        targetId: follows.targetId,
        notifyComments: follows.notifyComments,
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
          eq(follows.notifyComments, true),
          notActivelyMuted(follows.followerId, "content", contentId),
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
          eq(follows.notifyComments, true),
          notActivelyMuted(follows.followerId, "content", contentId),
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
    // FLOW-05: active object mute suppresses follow + direct for this target.
    // Security/account notices never consult this table.
    const [muted] = await tx
      .select({ id: objectNotificationMutes.id })
      .from(objectNotificationMutes)
      .where(
        and(
          eq(objectNotificationMutes.userId, recipientId),
          eq(objectNotificationMutes.targetType, "content"),
          eq(objectNotificationMutes.targetId, contentId),
          gt(objectNotificationMutes.mutedUntil, sql`clock_timestamp()`),
        ),
      )
      .limit(1);
    if (muted) return null;
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
      .select({ id: follows.id, notifyComments: follows.notifyComments })
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
    const following = !!follow?.notifyComments;
    const direct = publication.ownerId === recipientId || parent?.authorId === recipientId;
    if (!direct && !following) return null;
    return {
      direct,
      following,
      id: `ntf_reply_${createHash("sha256")
        .update(JSON.stringify([1, contentId, commentId, recipientId]))
        .digest("hex")}`,
      link: `/articles/${encodeURIComponent(publication.slug)}?comment=${encodeURIComponent(commentId)}#comment-${encodeURIComponent(commentId)}`,
    };
  }

  /** Trusted internal callers only. HTTP mutations must use setFollowingAuthenticated. */
  async setFollowing(
    actorId: string,
    targetType: TargetType,
    targetId: string,
    following: boolean,
    id: string,
    options: { notifyComments?: boolean } = {},
  ) {
    return this.setFollowingWithin(actorId, targetType, targetId, following, id, options);
  }

  async setFollowingAuthenticated(
    actorId: string,
    targetType: TargetType,
    targetId: string,
    following: boolean,
    id: string,
    options: { notifyComments?: boolean },
    token: string,
  ) {
    if (!token) throw new UnauthorizedError();
    return this.setFollowingWithin(actorId, targetType, targetId, following, id, options, token);
  }

  private async setFollowingWithin(
    actorId: string,
    targetType: TargetType,
    targetId: string,
    following: boolean,
    id: string,
    options: { notifyComments?: boolean },
    token?: string,
  ) {
    if (following && targetType === "user" && targetId === actorId)
      throw new AppError("Cannot follow yourself", 400, "SELF_FOLLOW");
    if (targetType !== "content" && options.notifyComments !== undefined)
      throw new AppError("notifyComments applies only to content follows", 400, "VALIDATION_ERROR");
    // Quiet Save → false; discussion follow → true; non-content stays true.
    const notifyComments = targetType === "content" ? (options.notifyComments ?? true) : true;
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
      const checkSession = async () => {
        if (token === undefined) return;
        const [actor] = await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, actorId))
          .for("share");
        if (!actor) throw new UnauthorizedError();
        await lockInitiatingSession(tx, actorId, token);
      };
      if (!following) {
        await checkSession();
        await tx.delete(follows).where(key);
        await checkSession();
        return { following: false, created: false, notifyComments: false };
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
      await checkSession();
      const [created] = await tx
        .insert(follows)
        .values({
          id,
          followerId: actorId,
          targetType,
          targetId,
          notifyComments,
          createdAt: targetType === "content" ? sql`clock_timestamp()` : new Date(),
        })
        .onConflictDoNothing()
        .returning({ id: follows.id, notifyComments: follows.notifyComments });
      if (!created) {
        // Content: resolved notifyComments (omit → true) updates delivery without
        // recreating the row. Quiet Save sends false; Watch sends true/omit.
        if (targetType === "content") {
          await tx.update(follows).set({ notifyComments }).where(key);
        }
        const [existing] = await tx
          .select({ id: follows.id, notifyComments: follows.notifyComments })
          .from(follows)
          .where(key)
          .limit(1);
        if (!existing) throw new AppError("Follow could not be confirmed", 503, "UNCONFIRMED");
        await checkSession();
        return {
          following: true,
          created: false,
          notifyComments: existing.notifyComments,
        };
      }
      if (targetType === "user") {
        const [follower] = await tx
          .select({ username: users.username })
          .from(users)
          .where(eq(users.id, actorId))
          .limit(1);
        if (follower) await userFollowNotice(tx, created.id, targetId, follower.username);
      }
      await checkSession();
      return { following: true, created: true, notifyComments: created.notifyComments };
    });
  }

  async muteState(actorId: string, targetType: TargetType, targetId: string) {
    if (!validDiscussionId(targetId))
      throw new AppError("Invalid mute target", 400, "VALIDATION_ERROR");
    const [row] = await db
      .select({
        mutedUntil: sql<
          string | null
        >`case when ${objectNotificationMutes.mutedUntil} > clock_timestamp() then to_char(${objectNotificationMutes.mutedUntil} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') else null end`,
      })
      .from(objectNotificationMutes)
      .where(
        and(
          eq(objectNotificationMutes.userId, actorId),
          eq(objectNotificationMutes.targetType, targetType),
          eq(objectNotificationMutes.targetId, targetId),
        ),
      )
      .limit(1);
    return { muted: !!row?.mutedUntil, mutedUntil: row?.mutedUntil ?? null };
  }

  async setObjectMute(
    actorId: string,
    targetType: TargetType,
    targetId: string,
    duration: ObjectMuteDuration | null,
    id: string,
    token: string,
  ) {
    if (!validDiscussionId(targetId))
      throw new AppError("Invalid mute target", 400, "VALIDATION_ERROR");
    if (duration !== null && !(duration in MUTE_DURATIONS))
      throw new AppError("Invalid mute duration", 400, "VALIDATION_ERROR");
    return db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${JSON.stringify(["mute", actorId, targetType, targetId])}, 0))`,
      );
      const [actor] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, actorId))
        .for("share");
      if (!actor) throw new UnauthorizedError("Authentication required");
      await lockInitiatingSession(tx, actorId, token);
      const key = and(
        eq(objectNotificationMutes.userId, actorId),
        eq(objectNotificationMutes.targetType, targetType),
        eq(objectNotificationMutes.targetId, targetId),
      );
      if (duration === null) {
        await tx.delete(objectNotificationMutes).where(key);
        await lockInitiatingSession(tx, actorId, token);
        return { muted: false, mutedUntil: null as string | null };
      }
      // Mute does not require an existing follow — independent of unfollow/watch.
      const untilExpr = MUTE_DURATIONS[duration];
      const [upserted] = await tx
        .insert(objectNotificationMutes)
        .values({
          id,
          userId: actorId,
          targetType,
          targetId,
          mutedUntil: untilExpr,
          createdAt: sql`clock_timestamp()`,
          updatedAt: sql`clock_timestamp()`,
        })
        .onConflictDoUpdate({
          target: [
            objectNotificationMutes.userId,
            objectNotificationMutes.targetType,
            objectNotificationMutes.targetId,
          ],
          set: {
            mutedUntil: untilExpr,
            updatedAt: sql`clock_timestamp()`,
          },
        })
        .returning({
          mutedUntil: sql<string>`to_char(${objectNotificationMutes.mutedUntil} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
        });
      if (!upserted) throw new AppError("Mute could not be confirmed", 503, "UNCONFIRMED");
      await lockInitiatingSession(tx, actorId, token);
      return { muted: true, mutedUntil: upserted.mutedUntil };
    });
  }
}
export const followWorkspaceRepository = new FollowWorkspaceRepository();
