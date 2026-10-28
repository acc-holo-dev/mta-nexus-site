import { createHash } from "node:crypto";
import { and, asc, eq, gt, isNull, lte, sql } from "drizzle-orm";
import { db } from "../client";
import { reportNotificationDeliveries, users } from "../schema";
import { lockNotificationPreferencesForUsers } from "./notification-preference-lock";
import { notificationRepository } from "./notifications";

export type ReportNotificationDeliveryResult = Readonly<{
  state: "idle" | "progress" | "completed" | "retry" | "failed";
  recipients: number;
  stored: number;
  pushDeferred: number;
}>;

export type ReportNotificationDeliveryStats = Readonly<{
  pending: number;
  failed: number;
  oldestAgeSeconds: number;
}>;

export class ReportNotificationDeliveryRepository {
  async processNext(limit = 20): Promise<ReportNotificationDeliveryResult> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
      throw new RangeError("Invalid report notification batch size");
    return db.transaction(async (tx) => {
      await tx.execute(sql`set local lock_timeout = '5s'`);
      await tx.execute(sql`set local statement_timeout = '10s'`);
      const [job] = await tx
        .select({
          reportId: reportNotificationDeliveries.reportId,
          // Preserve the database's microseconds in the account horizon.
          createdAt: sql<string>`${reportNotificationDeliveries.createdAt}::text`,
          community: reportNotificationDeliveries.community,
          lastRecipientId: reportNotificationDeliveries.lastRecipientId,
          attempts: reportNotificationDeliveries.attempts,
        })
        .from(reportNotificationDeliveries)
        .where(
          and(
            isNull(reportNotificationDeliveries.completedAt),
            sql`${reportNotificationDeliveries.attempts} < 5`,
            lte(reportNotificationDeliveries.availableAt, sql`statement_timestamp()`),
          ),
        )
        .orderBy(
          asc(reportNotificationDeliveries.availableAt),
          asc(reportNotificationDeliveries.reportId),
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
            // A recipient can also own the report. Waiting here would invert
            // account deletion's user -> report -> source lock order. NOWAIT
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
                id: `ntf_report_created_${createHash("sha256")
                  .update(JSON.stringify([job.reportId, recipient.id]))
                  .digest("hex")}`,
                recipientId: recipient.id,
                title: "New report",
                message: "A report is awaiting review.",
                link: job.community
                  ? `/admin/reports/${encodeURIComponent(job.reportId)}`
                  : "/admin",
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
            .update(reportNotificationDeliveries)
            .set({
              lastRecipientId: recipients.at(-1)?.id ?? job.lastRecipientId,
              attempts: 0,
              availableAt: sql`clock_timestamp()`,
              completedAt: completed ? sql`clock_timestamp()` : null,
            })
            .where(eq(reportNotificationDeliveries.reportId, job.reportId));
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
          .update(reportNotificationDeliveries)
          .set({
            attempts,
            availableAt: sql`clock_timestamp() + ${delaySeconds} * interval '1 second'`,
          })
          .where(eq(reportNotificationDeliveries.reportId, job.reportId));
        return {
          state: attempts === 5 ? "failed" : "retry",
          recipients: 0,
          stored: 0,
          pushDeferred: 0,
        };
      }
    });
  }

  async stats(): Promise<ReportNotificationDeliveryStats> {
    const [row] = await db.execute(sql`
      select
        count(*) filter (where attempts < 5)::integer as pending,
        count(*) filter (where attempts = 5)::integer as failed,
        coalesce(greatest(0, floor(extract(epoch from
          clock_timestamp() - min(created_at)))), 0)::integer as oldest_age_seconds
      from report_notification_deliveries
      where completed_at is null
    `);
    return {
      pending: Number(row.pending),
      failed: Number(row.failed),
      oldestAgeSeconds: Number(row.oldest_age_seconds),
    };
  }
}

export const reportNotificationDeliveryRepository = new ReportNotificationDeliveryRepository();
