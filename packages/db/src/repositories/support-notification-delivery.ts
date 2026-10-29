import { createHash } from "node:crypto";
import { and, asc, eq, gt, isNull, lte, sql } from "drizzle-orm";
import { db } from "../client";
import { supportNotificationDeliveries, users } from "../schema";
import { lockNotificationPreferencesForUsers } from "./notification-preference-lock";
import { notificationRepository } from "./notifications";

export type SupportNotificationDeliveryResult = Readonly<{
  state: "idle" | "progress" | "completed" | "retry" | "failed";
  recipients: number;
  stored: number;
  pushDeferred: number;
}>;

export type SupportNotificationDeliveryStats = Readonly<{
  pending: number;
  failed: number;
  oldestAgeSeconds: number;
}>;

export class SupportNotificationDeliveryRepository {
  async processNext(limit = 20): Promise<SupportNotificationDeliveryResult> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
      throw new RangeError("Invalid support notification batch size");
    return db.transaction(async (tx) => {
      await tx.execute(sql`set local lock_timeout = '5s'`);
      await tx.execute(sql`set local statement_timeout = '10s'`);
      const [job] = await tx
        .select({
          messageId: supportNotificationDeliveries.messageId,
          // Preserve the database's microseconds in the account horizon.
          createdAt: sql<string>`${supportNotificationDeliveries.createdAt}::text`,
          event: supportNotificationDeliveries.event,
          excludedRecipientId: supportNotificationDeliveries.excludedRecipientId,
          lastRecipientId: supportNotificationDeliveries.lastRecipientId,
          attempts: supportNotificationDeliveries.attempts,
        })
        .from(supportNotificationDeliveries)
        .where(
          and(
            isNull(supportNotificationDeliveries.completedAt),
            sql`${supportNotificationDeliveries.attempts} < 5`,
            lte(supportNotificationDeliveries.availableAt, sql`statement_timestamp()`),
          ),
        )
        .orderBy(
          asc(supportNotificationDeliveries.availableAt),
          asc(supportNotificationDeliveries.messageId),
        )
        .limit(1)
        .for("update", { skipLocked: true });
      if (!job) return { state: "idle", recipients: 0, stored: 0, pushDeferred: 0 };

      try {
        // Keep the source lock outside this savepoint. A failed page must undo
        // every inbox write and its cursor before persisting a bounded retry.
        return await tx.transaction(async (pageTx) => {
          const recipients = await pageTx
            .select({ id: users.id })
            .from(users)
            .where(
              and(
                sql`${users.role} IN ('moderator', 'admin')`,
                lte(users.createdAt, sql`${job.createdAt}::timestamptz`),
                job.lastRecipientId ? gt(users.id, job.lastRecipientId) : undefined,
                job.excludedRecipientId
                  ? sql`${users.id} <> ${job.excludedRecipientId}`
                  : undefined,
              ),
            )
            .orderBy(asc(users.id))
            .limit(limit)
            // A recipient can also own the case. Waiting here would invert
            // account deletion's user -> case -> source lock order. NOWAIT
            // retries the whole page; SKIP LOCKED would lose that recipient.
            .for("share", { noWait: true });
          await lockNotificationPreferencesForUsers(
            pageTx,
            recipients.map((row) => row.id),
          );
          let stored = 0;
          let pushDeferred = 0;
          for (const recipient of recipients) {
            const result = await notificationRepository.createWithPushOutboxWithin(
              pageTx,
              {
                id: `ntf_support_moderator_${createHash("sha256")
                  .update(JSON.stringify([job.messageId, recipient.id]))
                  .digest("hex")}`,
                recipientId: recipient.id,
                title: job.event === "case_created" ? "New support case" : "Support case updated",
                message:
                  job.event === "case_created"
                    ? "A support case is awaiting review."
                    : "A support case has a new requester message.",
                link: "/admin/support",
                type: "system",
                category: "system",
              },
              true,
            );
            if (result.notification) {
              stored++;
              if (result.pushQueueState === "saturated" || result.pushQueueState === "error")
                pushDeferred++;
            }
          }
          const completed = recipients.length < limit;
          await pageTx
            .update(supportNotificationDeliveries)
            .set({
              lastRecipientId: recipients.at(-1)?.id ?? job.lastRecipientId,
              attempts: 0,
              availableAt: sql`clock_timestamp()`,
              completedAt: completed ? sql`clock_timestamp()` : null,
            })
            .where(eq(supportNotificationDeliveries.messageId, job.messageId));
          return {
            state: completed ? ("completed" as const) : ("progress" as const),
            recipients: recipients.length,
            stored,
            pushDeferred,
          };
        });
      } catch {
        const attempts = job.attempts + 1;
        const delaySeconds = Math.min(300, 5 * 2 ** (attempts - 1));
        await tx
          .update(supportNotificationDeliveries)
          .set({
            attempts,
            availableAt: sql`clock_timestamp() + ${delaySeconds} * interval '1 second'`,
          })
          .where(eq(supportNotificationDeliveries.messageId, job.messageId));
        return {
          state: attempts === 5 ? "failed" : "retry",
          recipients: 0,
          stored: 0,
          pushDeferred: 0,
        };
      }
    });
  }

  async stats(): Promise<SupportNotificationDeliveryStats> {
    const [row] = await db.execute(sql`
      select
        count(*) filter (where attempts < 5)::integer as pending,
        count(*) filter (where attempts = 5)::integer as failed,
        coalesce(greatest(0, floor(extract(epoch from
          clock_timestamp() - min(created_at)))), 0)::integer as oldest_age_seconds
      from support_notification_deliveries
      where completed_at is null
    `);
    return {
      pending: Number(row.pending),
      failed: Number(row.failed),
      oldestAgeSeconds: Number(row.oldest_age_seconds),
    };
  }
}

export const supportNotificationDeliveryRepository = new SupportNotificationDeliveryRepository();
