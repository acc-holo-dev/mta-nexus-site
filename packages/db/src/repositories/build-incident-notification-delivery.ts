import { createHash } from "node:crypto";
import { and, asc, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "../client";
import { buildIncidentNotificationDeliveries, resourceDeliveryReceipts } from "../schema";
import { lockNotificationPreferencesForUsers } from "./notification-preference-lock";
import { notificationRepository } from "./notifications";

export type BuildIncidentNotificationDeliveryResult = Readonly<{
  state: "idle" | "progress" | "completed" | "retry" | "failed";
  recipients: number;
  stored: number;
  pushDeferred: number;
}>;

export type BuildIncidentNotificationDeliveryStats = Readonly<{
  pending: number;
  failed: number;
  oldestAgeSeconds: number;
}>;

export class BuildIncidentNotificationDeliveryRepository {
  async processNext(limit = 20): Promise<BuildIncidentNotificationDeliveryResult> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
      throw new RangeError("Invalid build incident notification batch size");
    return db.transaction(async (tx) => {
      await tx.execute(sql`set local lock_timeout = '5s'`);
      await tx.execute(sql`set local statement_timeout = '10s'`);
      const [job] = await tx
        .select({
          buildId: buildIncidentNotificationDeliveries.buildId,
          productId: buildIncidentNotificationDeliveries.productId,
          version: buildIncidentNotificationDeliveries.version,
          lastRecipientId: buildIncidentNotificationDeliveries.lastRecipientId,
          attempts: buildIncidentNotificationDeliveries.attempts,
        })
        .from(buildIncidentNotificationDeliveries)
        .where(
          and(
            isNull(buildIncidentNotificationDeliveries.completedAt),
            sql`${buildIncidentNotificationDeliveries.attempts} < 5`,
            lteAvailable(buildIncidentNotificationDeliveries.availableAt),
          ),
        )
        .orderBy(
          asc(buildIncidentNotificationDeliveries.availableAt),
          asc(buildIncidentNotificationDeliveries.buildId),
        )
        .limit(1)
        .for("update", { skipLocked: true });
      if (!job) return { state: "idle", recipients: 0, stored: 0, pushDeferred: 0 };

      try {
        return await tx.transaction(async (pageTx) => {
          const recipients = await pageTx
            .select({ id: resourceDeliveryReceipts.userId })
            .from(resourceDeliveryReceipts)
            .where(
              and(
                eq(resourceDeliveryReceipts.buildId, job.buildId),
                eq(resourceDeliveryReceipts.status, "served"),
                job.lastRecipientId
                  ? gt(resourceDeliveryReceipts.userId, job.lastRecipientId)
                  : undefined,
              ),
            )
            .groupBy(resourceDeliveryReceipts.userId)
            .orderBy(asc(resourceDeliveryReceipts.userId))
            .limit(limit);
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
                id: `ntf_build_incident_${createHash("sha256")
                  .update(JSON.stringify([job.buildId, recipient.id]))
                  .digest("hex")}`,
                recipientId: recipient.id,
                title: "Security notice for a downloaded build",
                message:
                  "A build you downloaded was quarantined after a security review. Stop using that version and check for an updated release in your library.",
                link: "/security",
                type: "security",
                category: "security",
                data: {
                  kind: "build_incident",
                  buildId: job.buildId,
                  productId: job.productId,
                  version: job.version,
                },
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
            .update(buildIncidentNotificationDeliveries)
            .set({
              lastRecipientId: recipients.at(-1)?.id ?? job.lastRecipientId,
              attempts: 0,
              availableAt: sql`clock_timestamp()`,
              completedAt: completed ? sql`clock_timestamp()` : null,
            })
            .where(eq(buildIncidentNotificationDeliveries.buildId, job.buildId));
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
          .update(buildIncidentNotificationDeliveries)
          .set({
            attempts,
            availableAt: sql`clock_timestamp() + ${delaySeconds} * interval '1 second'`,
          })
          .where(eq(buildIncidentNotificationDeliveries.buildId, job.buildId));
        return {
          state: attempts === 5 ? "failed" : "retry",
          recipients: 0,
          stored: 0,
          pushDeferred: 0,
        };
      }
    });
  }

  async stats(): Promise<BuildIncidentNotificationDeliveryStats> {
    const [row] = await db.execute(sql`
      select
        count(*) filter (where attempts < 5)::integer as pending,
        count(*) filter (where attempts = 5)::integer as failed,
        coalesce(greatest(0, floor(extract(epoch from
          clock_timestamp() - min(created_at)))), 0)::integer as oldest_age_seconds
      from build_incident_notification_deliveries
      where completed_at is null
    `);
    return {
      pending: Number(row.pending),
      failed: Number(row.failed),
      oldestAgeSeconds: Number(row.oldest_age_seconds),
    };
  }
}

function lteAvailable(column: typeof buildIncidentNotificationDeliveries.availableAt) {
  return sql`${column} <= statement_timestamp()`;
}

export const buildIncidentNotificationDeliveryRepository =
  new BuildIncidentNotificationDeliveryRepository();
