import { createHash } from "node:crypto";
import { and, asc, eq, gt, isNull, lte, sql } from "drizzle-orm";
import { db } from "../client";
import { users, verificationNotificationDeliveries } from "../schema";
import { lockNotificationPreferencesForUsers } from "./notification-preference-lock";
import { notificationRepository } from "./notifications";

export type VerificationNotificationDeliveryResult = Readonly<{
  state: "idle" | "progress" | "completed" | "retry" | "failed";
  recipients: number;
  stored: number;
  pushDeferred: number;
}>;

export type VerificationNotificationDeliveryStats = Readonly<{
  pending: number;
  failed: number;
  oldestAgeSeconds: number;
}>;

const VERIFICATION_PENDING_LINK = "/admin?verificationView=pending&verificationPage=1";

function noticeCopy(event: "application" | "server_claim") {
  if (event === "server_claim") {
    return {
      title: "Server ownership proof requires review",
      message: "A verified server control proof is awaiting review.",
    };
  }
  return {
    title: "New verification request",
    message: "A verification request is awaiting review.",
  };
}

export class VerificationNotificationDeliveryRepository {
  async processNext(limit = 20): Promise<VerificationNotificationDeliveryResult> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
      throw new RangeError("Invalid verification notification batch size");
    return db.transaction(async (tx) => {
      await tx.execute(sql`set local lock_timeout = '5s'`);
      await tx.execute(sql`set local statement_timeout = '10s'`);
      const [job] = await tx
        .select({
          verificationRequestId: verificationNotificationDeliveries.verificationRequestId,
          // Preserve the database's microseconds in the account horizon.
          createdAt: sql<string>`${verificationNotificationDeliveries.createdAt}::text`,
          event: verificationNotificationDeliveries.event,
          lastRecipientId: verificationNotificationDeliveries.lastRecipientId,
          attempts: verificationNotificationDeliveries.attempts,
        })
        .from(verificationNotificationDeliveries)
        .where(
          and(
            isNull(verificationNotificationDeliveries.completedAt),
            sql`${verificationNotificationDeliveries.attempts} < 5`,
            lte(verificationNotificationDeliveries.availableAt, sql`statement_timestamp()`),
          ),
        )
        .orderBy(
          asc(verificationNotificationDeliveries.availableAt),
          asc(verificationNotificationDeliveries.verificationRequestId),
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
              ),
            )
            .orderBy(asc(users.id))
            .limit(limit)
            // A recipient can also own the verification target. Waiting here would
            // invert account deletion's user -> verification -> source lock order.
            // NOWAIT retries the whole page; SKIP LOCKED would lose that recipient.
            .for("share", { noWait: true });
          await lockNotificationPreferencesForUsers(
            pageTx,
            recipients.map((row) => row.id),
          );
          const copy = noticeCopy(job.event);
          let stored = 0;
          let pushDeferred = 0;
          for (const recipient of recipients) {
            const result = await notificationRepository.createWithPushOutboxWithin(
              pageTx,
              {
                id: `ntf_verification_moderator_${createHash("sha256")
                  .update(JSON.stringify([job.verificationRequestId, recipient.id]))
                  .digest("hex")}`,
                recipientId: recipient.id,
                title: copy.title,
                message: copy.message,
                link: VERIFICATION_PENDING_LINK,
                type: "security",
                category: "security",
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
            .update(verificationNotificationDeliveries)
            .set({
              lastRecipientId: recipients.at(-1)?.id ?? job.lastRecipientId,
              attempts: 0,
              availableAt: sql`clock_timestamp()`,
              completedAt: completed ? sql`clock_timestamp()` : null,
            })
            .where(
              eq(
                verificationNotificationDeliveries.verificationRequestId,
                job.verificationRequestId,
              ),
            );
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
          .update(verificationNotificationDeliveries)
          .set({
            attempts,
            availableAt: sql`clock_timestamp() + ${delaySeconds} * interval '1 second'`,
          })
          .where(
            eq(verificationNotificationDeliveries.verificationRequestId, job.verificationRequestId),
          );
        return {
          state: attempts === 5 ? "failed" : "retry",
          recipients: 0,
          stored: 0,
          pushDeferred: 0,
        };
      }
    });
  }

  async stats(): Promise<VerificationNotificationDeliveryStats> {
    const [row] = await db.execute(sql`
      select
        count(*) filter (where attempts < 5)::integer as pending,
        count(*) filter (where attempts = 5)::integer as failed,
        coalesce(greatest(0, floor(extract(epoch from
          clock_timestamp() - min(created_at)))), 0)::integer as oldest_age_seconds
      from verification_notification_deliveries
      where completed_at is null
    `);
    return {
      pending: Number(row.pending),
      failed: Number(row.failed),
      oldestAgeSeconds: Number(row.oldest_age_seconds),
    };
  }
}

export const verificationNotificationDeliveryRepository =
  new VerificationNotificationDeliveryRepository();
