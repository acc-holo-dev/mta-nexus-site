import { createHash } from "node:crypto";
import { and, asc, desc, eq, isNull, lte, ne, sql } from "drizzle-orm";
import { db } from "../client";
import { content, follows, publicationNotificationDeliveries, servers } from "../schema";
import { lockNotificationPreferencesForUsers } from "./notification-preference-lock";
import { notificationRepository } from "./notifications";

type PublicationNotificationDeliveryResult = Readonly<{
  state: "idle" | "progress" | "completed" | "retry" | "failed";
  recipients: number;
  stored: number;
  pushDeferred: number;
}>;

type PublicationNotificationDeliveryStats = Readonly<{
  pending: number;
  failed: number;
  oldestAgeSeconds: number;
}>;

const MAX_SERVER_FOLLOWERS_PER_PUBLICATION = 100;

class PublicationNotificationDeliveryRepository {
  async processNext(limit = 20): Promise<PublicationNotificationDeliveryResult> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
      throw new RangeError("Invalid publication notification batch size");
    return db.transaction(async (tx) => {
      await tx.execute(sql`set local lock_timeout = '5s'`);
      await tx.execute(sql`set local statement_timeout = '10s'`);
      const [job] = await tx
        .select({
          contentId: publicationNotificationDeliveries.contentId,
          serverId: publicationNotificationDeliveries.serverId,
          authorId: publicationNotificationDeliveries.authorId,
          createdAt: sql<string>`${publicationNotificationDeliveries.createdAt}::text`,
          lastFollowerCreatedAt: sql<
            string | null
          >`case when ${publicationNotificationDeliveries.lastFollowerCreatedAt} is null then null else to_char(${publicationNotificationDeliveries.lastFollowerCreatedAt} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end`,
          lastFollowerId: publicationNotificationDeliveries.lastFollowerId,
          notifiedCount: publicationNotificationDeliveries.notifiedCount,
          attempts: publicationNotificationDeliveries.attempts,
        })
        .from(publicationNotificationDeliveries)
        .where(
          and(
            isNull(publicationNotificationDeliveries.completedAt),
            sql`${publicationNotificationDeliveries.attempts} < 5`,
            lte(publicationNotificationDeliveries.availableAt, sql`statement_timestamp()`),
          ),
        )
        .orderBy(
          asc(publicationNotificationDeliveries.availableAt),
          asc(publicationNotificationDeliveries.contentId),
        )
        .limit(1)
        .for("update", { skipLocked: true });
      if (!job) return { state: "idle", recipients: 0, stored: 0, pushDeferred: 0 };

      try {
        return await tx.transaction(async (pageTx) => {
          const [publication] = await pageTx
            .select({
              title: content.title,
              slug: content.slug,
              status: content.status,
              serverId: content.serverId,
              authorId: content.authorId,
            })
            .from(content)
            .where(eq(content.id, job.contentId))
            .for("share")
            .limit(1);
          if (
            publication?.status !== "published" ||
            publication.serverId !== job.serverId ||
            publication.authorId !== job.authorId
          ) {
            await pageTx
              .update(publicationNotificationDeliveries)
              .set({
                attempts: 0,
                availableAt: sql`clock_timestamp()`,
                completedAt: sql`clock_timestamp()`,
              })
              .where(eq(publicationNotificationDeliveries.contentId, job.contentId));
            return { state: "completed" as const, recipients: 0, stored: 0, pushDeferred: 0 };
          }

          const [server] = await pageTx
            .select({
              name: servers.name,
              visibility: servers.visibility,
              status: servers.status,
            })
            .from(servers)
            .where(eq(servers.id, job.serverId))
            .for("share")
            .limit(1);
          if (!server || server.visibility === "private" || server.status === "suspended") {
            await pageTx
              .update(publicationNotificationDeliveries)
              .set({
                attempts: 0,
                availableAt: sql`clock_timestamp()`,
                completedAt: sql`clock_timestamp()`,
              })
              .where(eq(publicationNotificationDeliveries.contentId, job.contentId));
            return { state: "completed" as const, recipients: 0, stored: 0, pushDeferred: 0 };
          }

          const remaining = MAX_SERVER_FOLLOWERS_PER_PUBLICATION - job.notifiedCount;
          if (remaining <= 0) {
            await pageTx
              .update(publicationNotificationDeliveries)
              .set({
                attempts: 0,
                availableAt: sql`clock_timestamp()`,
                completedAt: sql`clock_timestamp()`,
              })
              .where(eq(publicationNotificationDeliveries.contentId, job.contentId));
            return { state: "completed" as const, recipients: 0, stored: 0, pushDeferred: 0 };
          }

          const pageLimit = Math.min(limit, remaining);
          const rows = await pageTx
            .select({
              id: follows.id,
              recipientId: follows.followerId,
              createdAt: sql<string>`to_char(${follows.createdAt} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
            })
            .from(follows)
            .where(
              and(
                eq(follows.targetType, "server"),
                eq(follows.targetId, job.serverId),
                ne(follows.followerId, job.authorId),
                sql`${follows.createdAt} <= ${job.createdAt}::timestamptz`,
                job.lastFollowerId && job.lastFollowerCreatedAt
                  ? sql`(
                      ${follows.createdAt} < ${job.lastFollowerCreatedAt}::timestamptz
                      OR (
                        ${follows.createdAt} = ${job.lastFollowerCreatedAt}::timestamptz
                        AND ${follows.id} < ${job.lastFollowerId}
                      )
                    )`
                  : undefined,
              ),
            )
            .orderBy(desc(follows.createdAt), desc(follows.id))
            .limit(pageLimit + 1)
            .for("share", { noWait: true });

          const items = rows.slice(0, pageLimit);
          await lockNotificationPreferencesForUsers(
            pageTx,
            items.map((row) => row.recipientId),
          );

          let stored = 0;
          let pushDeferred = 0;
          for (const recipient of items) {
            const result = await notificationRepository.createWithPushOutboxWithin(
              pageTx,
              {
                id: `ntf_server_publication_${createHash("sha256")
                  .update(JSON.stringify([job.contentId, recipient.recipientId]))
                  .digest("hex")}`,
                recipientId: recipient.recipientId,
                title: "New server update",
                message: `${server.name}: ${publication.title}`,
                link: `/articles/${publication.slug}`,
                type: "server",
                category: "server",
              },
              true,
            );
            if (result.notification) {
              stored++;
              if (result.pushQueueState === "saturated" || result.pushQueueState === "error")
                pushDeferred++;
            }
          }

          const last = items.at(-1);
          const notifiedCount = job.notifiedCount + items.length;
          const completed =
            items.length < pageLimit ||
            rows.length <= pageLimit ||
            notifiedCount >= MAX_SERVER_FOLLOWERS_PER_PUBLICATION;
          await pageTx
            .update(publicationNotificationDeliveries)
            .set({
              lastFollowerCreatedAt: last
                ? sql`${last.createdAt}::timestamptz`
                : job.lastFollowerCreatedAt
                  ? sql`${job.lastFollowerCreatedAt}::timestamptz`
                  : null,
              lastFollowerId: last?.id ?? job.lastFollowerId,
              notifiedCount,
              attempts: 0,
              availableAt: sql`clock_timestamp()`,
              completedAt: completed ? sql`clock_timestamp()` : null,
            })
            .where(eq(publicationNotificationDeliveries.contentId, job.contentId));
          return {
            state: completed ? ("completed" as const) : ("progress" as const),
            recipients: items.length,
            stored,
            pushDeferred,
          };
        });
      } catch {
        const attempts = job.attempts + 1;
        const delaySeconds = Math.min(300, 5 * 2 ** (attempts - 1));
        await tx
          .update(publicationNotificationDeliveries)
          .set({
            attempts,
            availableAt: sql`clock_timestamp() + ${delaySeconds} * interval '1 second'`,
          })
          .where(eq(publicationNotificationDeliveries.contentId, job.contentId));
        return {
          state: attempts === 5 ? "failed" : "retry",
          recipients: 0,
          stored: 0,
          pushDeferred: 0,
        };
      }
    });
  }

  async stats(): Promise<PublicationNotificationDeliveryStats> {
    const [row] = await db.execute(sql`
      select
        count(*) filter (where attempts < 5)::integer as pending,
        count(*) filter (where attempts = 5)::integer as failed,
        coalesce(greatest(0, floor(extract(epoch from
          clock_timestamp() - min(created_at)))), 0)::integer as oldest_age_seconds
      from publication_notification_deliveries
      where completed_at is null
    `);
    return {
      pending: Number(row.pending),
      failed: Number(row.failed),
      oldestAgeSeconds: Number(row.oldest_age_seconds),
    };
  }
}

export const publicationNotificationDeliveryRepository =
  new PublicationNotificationDeliveryRepository();
