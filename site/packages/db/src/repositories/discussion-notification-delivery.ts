import { and, asc, eq, isNull, lte, sql } from "drizzle-orm";
import { db } from "../client";
import { discussionNotificationDeliveries } from "../schema";
import { followWorkspaceRepository } from "./follow-workspace";
import { notificationRepository } from "./notifications";

export type DiscussionNotificationDeliveryResult = Readonly<{
  state: "idle" | "progress" | "completed" | "retry" | "failed";
  recipients: number;
  stored: number;
  pushDeferred: number;
}>;

export type DiscussionNotificationDeliveryStats = Readonly<{
  pending: number;
  failed: number;
  oldestAgeSeconds: number;
}>;

export class DiscussionNotificationDeliveryRepository {
  async processNext(limit = 20): Promise<DiscussionNotificationDeliveryResult> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
      throw new RangeError("Invalid discussion notification batch size");
    return db.transaction(async (tx) => {
      await tx.execute(sql`set local lock_timeout = '5s'`);
      await tx.execute(sql`set local statement_timeout = '10s'`);
      const [job] = await tx
        .select({
          commentId: discussionNotificationDeliveries.commentId,
          contentId: discussionNotificationDeliveries.contentId,
          createdAt: sql<string>`${discussionNotificationDeliveries.createdAt}::text`,
          directCompleted: discussionNotificationDeliveries.directCompleted,
          lastFollowerCreatedAt: sql<
            string | null
          >`case when ${discussionNotificationDeliveries.lastFollowerCreatedAt} is null then null else to_char(${discussionNotificationDeliveries.lastFollowerCreatedAt} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end`,
          lastFollowerId: discussionNotificationDeliveries.lastFollowerId,
          attempts: discussionNotificationDeliveries.attempts,
        })
        .from(discussionNotificationDeliveries)
        .where(
          and(
            isNull(discussionNotificationDeliveries.completedAt),
            sql`${discussionNotificationDeliveries.attempts} < 5`,
            lte(discussionNotificationDeliveries.availableAt, sql`statement_timestamp()`),
          ),
        )
        .orderBy(
          asc(discussionNotificationDeliveries.availableAt),
          asc(discussionNotificationDeliveries.commentId),
        )
        .limit(1)
        .for("update", { skipLocked: true });
      if (!job) return { state: "idle", recipients: 0, stored: 0, pushDeferred: 0 };

      try {
        // Keep the source lock outside this savepoint. A failed page must undo
        // every inbox write and its cursor before persisting a bounded retry.
        return await tx.transaction(async (pageTx) => {
          const audience = await followWorkspaceRepository.discussionAudienceWithin(
            pageTx,
            job.contentId,
            job.commentId,
          );
          if (!audience) {
            await pageTx
              .update(discussionNotificationDeliveries)
              .set({
                attempts: 0,
                availableAt: sql`clock_timestamp()`,
                completedAt: sql`clock_timestamp()`,
              })
              .where(eq(discussionNotificationDeliveries.commentId, job.commentId));
            return { state: "completed" as const, recipients: 0, stored: 0, pushDeferred: 0 };
          }

          if (!job.directCompleted) {
            let stored = 0;
            let pushDeferred = 0;
            for (const recipientId of audience.directRecipients) {
              const result = await notificationRepository.createDiscussionReplyWithPushWithin(
                pageTx,
                {
                  recipientId,
                  contentId: job.contentId,
                  commentId: job.commentId,
                },
              );
              if (result.state === "stored") {
                stored++;
                if (result.pushQueueState === "saturated" || result.pushQueueState === "error")
                  pushDeferred++;
              }
            }
            await pageTx
              .update(discussionNotificationDeliveries)
              .set({
                directCompleted: true,
                attempts: 0,
                availableAt: sql`clock_timestamp()`,
              })
              .where(eq(discussionNotificationDeliveries.commentId, job.commentId));
            return {
              state: "progress" as const,
              recipients: audience.directRecipients.length,
              stored,
              pushDeferred,
            };
          }

          const cursor =
            job.lastFollowerId && job.lastFollowerCreatedAt
              ? { id: job.lastFollowerId, createdAt: job.lastFollowerCreatedAt }
              : undefined;
          const page = await followWorkspaceRepository.discussionFollowersWithin(
            pageTx,
            job.contentId,
            audience.createdAt,
            [audience.authorId, ...audience.directRecipients],
            cursor,
            limit,
          );
          let stored = 0;
          let pushDeferred = 0;
          for (const recipient of page.items) {
            const result = await notificationRepository.createDiscussionReplyWithPushWithin(
              pageTx,
              {
                recipientId: recipient.recipientId,
                contentId: job.contentId,
                commentId: job.commentId,
              },
            );
            if (result.state === "stored") {
              stored++;
              if (result.pushQueueState === "saturated" || result.pushQueueState === "error")
                pushDeferred++;
            }
          }
          const last = page.items.at(-1);
          const completed = !page.nextCursor;
          await pageTx
            .update(discussionNotificationDeliveries)
            .set({
              lastFollowerCreatedAt: last
                ? sql`${last.createdAt}::timestamptz`
                : job.lastFollowerCreatedAt
                  ? sql`${job.lastFollowerCreatedAt}::timestamptz`
                  : null,
              lastFollowerId: last?.id ?? job.lastFollowerId,
              attempts: 0,
              availableAt: sql`clock_timestamp()`,
              completedAt: completed ? sql`clock_timestamp()` : null,
            })
            .where(eq(discussionNotificationDeliveries.commentId, job.commentId));
          return {
            state: completed ? ("completed" as const) : ("progress" as const),
            recipients: page.items.length,
            stored,
            pushDeferred,
          };
        });
      } catch {
        const attempts = job.attempts + 1;
        const delaySeconds = Math.min(300, 5 * 2 ** (attempts - 1));
        await tx
          .update(discussionNotificationDeliveries)
          .set({
            attempts,
            availableAt: sql`clock_timestamp() + ${delaySeconds} * interval '1 second'`,
          })
          .where(eq(discussionNotificationDeliveries.commentId, job.commentId));
        return {
          state: attempts === 5 ? "failed" : "retry",
          recipients: 0,
          stored: 0,
          pushDeferred: 0,
        };
      }
    });
  }

  async stats(): Promise<DiscussionNotificationDeliveryStats> {
    const [row] = await db.execute(sql`
      select
        count(*) filter (where attempts < 5)::integer as pending,
        count(*) filter (where attempts = 5)::integer as failed,
        coalesce(greatest(0, floor(extract(epoch from
          clock_timestamp() - min(created_at)))), 0)::integer as oldest_age_seconds
      from discussion_notification_deliveries
      where completed_at is null
    `);
    return {
      pending: Number(row.pending),
      failed: Number(row.failed),
      oldestAgeSeconds: Number(row.oldest_age_seconds),
    };
  }
}

export const discussionNotificationDeliveryRepository =
  new DiscussionNotificationDeliveryRepository();
