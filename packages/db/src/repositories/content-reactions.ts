import { and, countDistinct, desc, eq, inArray, ne, sql } from "drizzle-orm";
import {
  AppError,
  NotFoundError,
  CONTENT_REACTIONS,
  CONTENT_REACTION_EMOJI,
  contentReactionFromEmoji,
  type ContentReaction,
} from "@nexus/domain";
import { db } from "../client";
import { auditEvents, content, reactions, users } from "../schema";
import { containsPattern } from "./search-pattern";
import { contentReactionNotice } from "./content-reaction-notice";
import { currentContentReactionRow } from "./content-reaction-count";
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
const emojis = CONTENT_REACTIONS.map((value) => CONTENT_REACTION_EMOJI[value]);
const publicationTypes = [
  "article",
  "news",
  "devlog",
  "update",
  "announcement",
  "post",
  "question",
  "review",
];
const key = (actorId: string, contentId: string) =>
  and(
    eq(reactions.userId, actorId),
    eq(reactions.targetType, "content"),
    eq(reactions.targetId, contentId),
  );
async function counts(tx: Transaction, contentId: string, authorId: string) {
  const rows = await tx
    .select({ emoji: reactions.emoji, total: countDistinct(reactions.userId) })
    .from(reactions)
    .where(
      and(
        eq(reactions.targetType, "content"),
        eq(reactions.targetId, contentId),
        ne(reactions.userId, authorId),
        inArray(reactions.emoji, emojis),
        currentContentReactionRow(),
      ),
    )
    .groupBy(reactions.emoji);
  return Object.fromEntries(
    CONTENT_REACTIONS.map((value) => [
      value,
      rows.find((row) => row.emoji === CONTENT_REACTION_EMOJI[value])?.total ?? 0,
    ]),
  ) as Record<ContentReaction, number>;
}
class ContentReactionsRepository {
  async state(slug: string, actorId?: string) {
    const [row] = await db
      .select({
        contentId: content.id,
        slug: content.slug,
        self: actorId ? sql<boolean>`${content.authorId} = ${actorId}` : sql<boolean>`false`,
        helpful:
          sql<number>`count(distinct ${reactions.userId}) filter (where ${reactions.emoji} = ${CONTENT_REACTION_EMOJI.helpful})`.mapWith(
            Number,
          ),
        thanks:
          sql<number>`count(distinct ${reactions.userId}) filter (where ${reactions.emoji} = ${CONTENT_REACTION_EMOJI.thanks})`.mapWith(
            Number,
          ),
        insight:
          sql<number>`count(distinct ${reactions.userId}) filter (where ${reactions.emoji} = ${CONTENT_REACTION_EMOJI.insight})`.mapWith(
            Number,
          ),
        selected: actorId
          ? sql<
              string | null
            >`(select r.emoji from ${reactions} r where r.target_type = 'content' and r.target_id = ${content.id} and r.user_id = ${actorId} and r.emoji in (${sql.join(
              emojis.map((emoji) => sql`${emoji}`),
              sql`, `,
            )}) order by r.created_at desc, r.id desc limit 1)`
          : sql<null>`null`,
      })
      .from(content)
      .leftJoin(
        reactions,
        and(
          eq(reactions.targetType, "content"),
          eq(reactions.targetId, content.id),
          ne(reactions.userId, content.authorId),
          inArray(reactions.emoji, emojis),
          currentContentReactionRow(),
        ),
      )
      .where(
        and(
          eq(content.slug, slug),
          eq(content.status, "published"),
          inArray(content.type, publicationTypes),
        ),
      )
      .groupBy(content.id, content.slug, content.authorId)
      .limit(1);
    if (!row) throw new NotFoundError("Content");
    return {
      contentId: row.contentId,
      slug: row.slug,
      authenticated: !!actorId,
      self: row.self,
      reaction: contentReactionFromEmoji(row.selected),
      counts: { helpful: row.helpful, thanks: row.thanks, insight: row.insight },
    };
  }
  async set(input: {
    actorId: string;
    slug?: string;
    contentId?: string;
    reaction: ContentReaction | null;
    reactionId: string;
    auditId: string;
  }) {
    if (
      !!input.slug === !!input.contentId ||
      (input.contentId && input.reaction !== null) ||
      (input.reaction !== null && !CONTENT_REACTIONS.includes(input.reaction))
    )
      throw new AppError("Invalid reaction scope", 400, "VALIDATION_ERROR");
    return db.transaction(async (tx) => {
      // Publication first, as in moderation and discussion. Pair lock covers orphan cleanup.
      const [item] = await tx
        .select({
          id: content.id,
          slug: content.slug,
          status: content.status,
          type: content.type,
          authorId: content.authorId,
        })
        .from(content)
        .where(input.slug ? eq(content.slug, input.slug) : eq(content.id, input.contentId ?? ""))
        .for("update")
        .limit(1);
      const contentId = item?.id ?? input.contentId;
      if (
        !contentId ||
        (input.slug && (item?.status !== "published" || !publicationTypes.includes(item.type)))
      )
        throw new NotFoundError("Content");
      if (
        input.reaction !== null &&
        (item?.status !== "published" || !publicationTypes.includes(item.type))
      )
        throw new NotFoundError("Content");
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`nexus:content-reaction:v1:${JSON.stringify([input.actorId, contentId])}`}, 0))`,
      );
      const [actor] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, input.actorId))
        .for("share")
        .limit(1);
      if (!actor) throw new AppError("Account unavailable", 401, "UNAUTHORIZED");
      if (item?.authorId === input.actorId && input.reaction !== null)
        throw new AppError("Self reaction forbidden", 403, "REACTION_SELF");
      const existing = await tx
        .select({ id: reactions.id, emoji: reactions.emoji })
        .from(reactions)
        .where(key(input.actorId, contentId))
        .orderBy(desc(reactions.createdAt), desc(reactions.id))
        .for("update")
        .limit(2);
      if (input.contentId && !existing.length)
        return {
          contentId,
          slug: null,
          reaction: null,
          counts: { helpful: 0, thanks: 0, insight: 0 },
          changed: false,
        };
      const desired = input.reaction ? CONTENT_REACTION_EMOJI[input.reaction] : null;
      const changed = desired
        ? existing.length !== 1 || existing[0]?.emoji !== desired
        : existing.length > 0;
      if (changed) {
        await tx.delete(reactions).where(key(input.actorId, contentId));
        if (desired)
          await tx.insert(reactions).values({
            id: input.reactionId,
            userId: input.actorId,
            targetType: "content",
            targetId: contentId,
            emoji: desired,
          });
        await tx.insert(auditEvents).values({
          id: input.auditId,
          actorId: input.actorId,
          actorType: "user",
          targetType: "content",
          targetId: contentId,
          action: "content.reaction_changed",
          details: { reaction: input.reaction },
        });
        if (input.reaction && item && !existing.length)
          await contentReactionNotice(tx, item, input.actorId);
      }
      const summary = item
        ? await counts(tx, contentId, item.authorId)
        : { helpful: 0, thanks: 0, insight: 0 };
      if (item)
        await tx
          .update(content)
          .set({ likeCount: summary.helpful })
          .where(eq(content.id, contentId));
      return {
        contentId,
        slug: item?.status === "published" ? item.slug : null,
        reaction: input.reaction,
        counts: summary,
        changed,
      };
    });
  }
  async page(
    actorId: string,
    filters: {
      query?: string;
      reaction?: ContentReaction;
      cursor?: { createdAt: string; id: string };
    } = {},
  ) {
    // Canonical latest supported row per target, including legacy duplicates; no private body leaves SQL.
    const latest = db
      .selectDistinctOn([reactions.targetId], {
        targetId: reactions.targetId,
        emoji: reactions.emoji,
        createdAt: reactions.createdAt,
      })
      .from(reactions)
      .where(
        and(
          eq(reactions.userId, actorId),
          eq(reactions.targetType, "content"),
          inArray(reactions.emoji, emojis),
        ),
      )
      .orderBy(reactions.targetId, desc(reactions.createdAt), desc(reactions.id))
      .as("latest_reactions");
    const pattern = filters.query ? containsPattern(filters.query) : undefined;
    const rows = await db
      .select({
        contentId: latest.targetId,
        emoji: latest.emoji,
        reactedAt: latest.createdAt,
        cursorTime: sql<string>`to_char(${latest.createdAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
        title: content.title,
        slug: content.slug,
        type: content.type,
      })
      .from(latest)
      .leftJoin(
        content,
        and(
          eq(content.id, latest.targetId),
          eq(content.status, "published"),
          inArray(content.type, publicationTypes),
        ),
      )
      .where(
        and(
          filters.reaction ? eq(latest.emoji, CONTENT_REACTION_EMOJI[filters.reaction]) : undefined,
          pattern ? sql`${content.title} ilike ${pattern}` : undefined,
          filters.cursor
            ? sql`(${latest.createdAt}, ${latest.targetId}) < (${filters.cursor.createdAt}::timestamptz, ${filters.cursor.id})`
            : undefined,
        ),
      )
      .orderBy(desc(latest.createdAt), desc(latest.targetId))
      .limit(21);
    const items = rows.slice(0, 20),
      last = items.at(-1);
    return {
      items,
      hasMore: rows.length > 20,
      nextCursor:
        rows.length > 20 && last ? { createdAt: last.cursorTime, id: last.contentId } : null,
    };
  }
}
export const contentReactionsRepository = new ContentReactionsRepository();
