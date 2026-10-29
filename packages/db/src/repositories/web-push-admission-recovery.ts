import { and, asc, eq, or, sql } from "drizzle-orm";
import { db } from "../client";
import { notificationPreferences, notifications, users, webPushAdmissionRecovery } from "../schema";
import { lockNotificationPreferencesForUsers } from "./notification-preference-lock";
import { enqueueWebPushOutboxForNotification, WEB_PUSH_OUTBOX_TTL_HOURS } from "./web-push-outbox";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type WebPushAdmissionRecoveryResult = Readonly<{
  state: "idle" | "completed" | "retry" | "failed" | "skipped";
  pushJobs: number;
}>;

export type WebPushAdmissionRecoveryStats = Readonly<{
  pending: number;
  failed: number;
  oldestAgeSeconds: number;
}>;

async function retireIntent(tx: Tx, notificationId: string): Promise<void> {
  const rows = await tx
    .delete(webPushAdmissionRecovery)
    .where(eq(webPushAdmissionRecovery.notificationId, notificationId))
    .returning({ id: webPushAdmissionRecovery.notificationId });
  if (rows.length !== 1) throw new Error("Web Push admission intent was not retired");
}

async function attemptAdmissionWithin(
  tx: Tx,
  notificationId: string,
  recipientId: string,
  recovery: boolean,
) {
  return tx.transaction(async (pushTx) => {
    const [settings] = await pushTx.execute(sql`
      select current_setting('lock_timeout') as lock_timeout,
        current_setting('statement_timeout') as statement_timeout
    `);
    await pushTx.execute(sql`set local lock_timeout = '3s'`);
    await pushTx.execute(sql`set local statement_timeout = '5s'`);
    const admission = await enqueueWebPushOutboxForNotification(
      pushTx,
      notificationId,
      recipientId,
      recovery,
    );
    // Queue writes and proof consumption must commit or roll back together.
    if (recovery && admission.reason !== "saturated") await retireIntent(pushTx, notificationId);
    await pushTx.execute(sql`
      select set_config('lock_timeout', ${String(settings.lock_timeout)}, true),
        set_config('statement_timeout', ${String(settings.statement_timeout)}, true)
    `);
    return admission;
  });
}

/** Call only after inserting a new notification, with its preference lock held. */
export async function enqueueWebPushWithRecoveryWithin(
  tx: Tx,
  notificationId: string,
  recipientId: string,
): Promise<{
  queued: number;
  reason: "queued" | "no_subscriptions" | "saturated" | "error";
}> {
  let admission: Awaited<ReturnType<typeof enqueueWebPushWithRecoveryWithin>>;
  try {
    admission = await attemptAdmissionWithin(tx, notificationId, recipientId, false);
  } catch {
    admission = { queued: 0, reason: "error" };
  }
  if (admission.reason === "saturated" || admission.reason === "error") {
    // Outside the optional savepoint, but still atomic with the source/inbox.
    // A crash before this write rolls back the source transaction. The normal
    // accepted/no-device path needs no recovery row or subsequent deletion.
    await tx.insert(webPushAdmissionRecovery).values({
      notificationId,
      createdAt: sql`(select n.created_at from notifications n
        where n.id = ${notificationId} and n.recipient_id = ${recipientId})`,
      availableAt: sql`clock_timestamp()`,
    });
  }
  return admission;
}

function isLockContention(error: unknown): boolean {
  let current = error;
  for (let depth = 0; depth < 4 && current && typeof current === "object"; depth++) {
    if ("code" in current && (current.code === "55P03" || current.code === "57014")) return true;
    current = "cause" in current ? current.cause : null;
  }
  return false;
}

function dueIntent() {
  return and(
    sql`${webPushAdmissionRecovery.availableAt} <= clock_timestamp()`,
    or(
      sql`${webPushAdmissionRecovery.attempts} < 5`,
      sql`${webPushAdmissionRecovery.createdAt} <= clock_timestamp() - ${WEB_PUSH_OUTBOX_TTL_HOURS} * interval '1 hour'`,
    ),
  );
}

export class WebPushAdmissionRecoveryRepository {
  async processNext(): Promise<WebPushAdmissionRecoveryResult> {
    // A locked account must not hold up every other recipient. Discover only a
    // bounded page, then claim each candidate using the producer's lock order.
    const candidates = await db
      .select({
        notificationId: webPushAdmissionRecovery.notificationId,
        recipientId: notifications.recipientId,
      })
      .from(webPushAdmissionRecovery)
      .innerJoin(notifications, eq(notifications.id, webPushAdmissionRecovery.notificationId))
      .where(dueIntent())
      .orderBy(
        asc(webPushAdmissionRecovery.availableAt),
        asc(webPushAdmissionRecovery.notificationId),
      )
      .limit(20);
    for (const candidate of candidates) {
      const result = await this.processCandidate(candidate);
      if (result.state !== "skipped") return result;
    }
    return { state: candidates.length ? "skipped" : "idle", pushJobs: 0 };
  }

  private async processCandidate(candidate: {
    notificationId: string;
    recipientId: string;
  }): Promise<WebPushAdmissionRecoveryResult> {
    try {
      return await db.transaction(async (tx) => {
        await tx.execute(sql`set local lock_timeout = '3s'`);
        await tx.execute(sql`set local statement_timeout = '5s'`);
        const eligible = dueIntent();
        // Do not claim intent first: producers acquire preferences -> notification
        // -> intent -> queue gate. Reversing that order can deadlock fanout.
        // Account deletion takes the user lock before cascading into notifications.
        const [user] = await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, candidate.recipientId))
          .for("share", { noWait: true });
        if (!user) return { state: "skipped", pushJobs: 0 };
        await lockNotificationPreferencesForUsers(tx, [candidate.recipientId]);
        const [preferences] = await tx
          .select()
          .from(notificationPreferences)
          .where(eq(notificationPreferences.userId, candidate.recipientId));
        const [notification] = await tx
          .select({
            isRead: notifications.isRead,
            category: notifications.category,
            expired: sql<boolean>`${notifications.createdAt} + ${WEB_PUSH_OUTBOX_TTL_HOURS} * interval '1 hour' <= clock_timestamp()`,
          })
          .from(notifications)
          .where(
            and(
              eq(notifications.id, candidate.notificationId),
              eq(notifications.recipientId, candidate.recipientId),
            ),
          )
          .for("update", { noWait: true });
        if (!notification) return { state: "skipped", pushJobs: 0 };
        const [intent] = await tx
          .select({
            attempts: webPushAdmissionRecovery.attempts,
            expired: sql<boolean>`${webPushAdmissionRecovery.createdAt} <= clock_timestamp() - ${WEB_PUSH_OUTBOX_TTL_HOURS} * interval '1 hour'`,
          })
          .from(webPushAdmissionRecovery)
          .where(
            and(eq(webPushAdmissionRecovery.notificationId, candidate.notificationId), eligible),
          )
          .for("update", { skipLocked: true });
        // A concurrent pass may already have admitted and consumed this candidate.
        if (!intent) return { state: "skipped", pushJobs: 0 };

        const enabled =
          notification.category === "follow"
            ? preferences?.followsEnabled
            : notification.category === "content"
              ? preferences?.contentEnabled
              : notification.category === "server"
                ? preferences?.serverEnabled
                : notification.category === "commerce"
                  ? preferences?.commerceEnabled
                  : notification.category === "system"
                    ? preferences?.systemEnabled
                    : true;
        if (notification.isRead || notification.expired || intent.expired || enabled === false) {
          await retireIntent(tx, candidate.notificationId);
          return { state: "skipped", pushJobs: 0 };
        }

        try {
          const admission = await attemptAdmissionWithin(
            tx,
            candidate.notificationId,
            candidate.recipientId,
            true,
          );
          if (admission.reason !== "saturated")
            return { state: "completed", pushJobs: admission.queued };
        } catch {
          // Optional writes and intent consumption rolled back at the savepoint.
        }
        const attempts = intent.attempts + 1;
        const delaySeconds = 5 * 2 ** (attempts - 1);
        await tx
          .update(webPushAdmissionRecovery)
          .set({
            attempts,
            availableAt: sql`clock_timestamp() + ${delaySeconds} * interval '1 second'`,
          })
          .where(eq(webPushAdmissionRecovery.notificationId, candidate.notificationId));
        return { state: attempts === 5 ? "failed" : "retry", pushJobs: 0 };
      });
    } catch (error) {
      // No intent was claimed: retrying a candidate after lock contention loses no work.
      if (isLockContention(error)) {
        // The failed transaction has released every preference/parent lock.
        // Defer just this intent, without waiting on another worker or consuming
        // a failure attempt. Otherwise a full page owned by a locked account
        // would be rediscovered forever and starve unrelated recipients.
        await db.execute(sql`
          with unlocked as (
            select notification_id from web_push_admission_recovery
            where notification_id = ${candidate.notificationId}
            for update skip locked
          )
          update web_push_admission_recovery
          set available_at = greatest(available_at, clock_timestamp() + interval '5 seconds')
          where notification_id in (select notification_id from unlocked)
        `);
        return { state: "skipped", pushJobs: 0 };
      }
      throw error;
    }
  }

  async stats(): Promise<WebPushAdmissionRecoveryStats> {
    const [row] = await db.execute(sql`
      select count(*) filter (where attempts < 5)::integer as pending,
        count(*) filter (where attempts = 5)::integer as failed,
        coalesce(greatest(0, floor(extract(epoch from
          clock_timestamp() - min(created_at)))), 0)::integer as oldest_age_seconds
      from web_push_admission_recovery
    `);
    return {
      pending: Number(row.pending),
      failed: Number(row.failed),
      oldestAgeSeconds: Number(row.oldest_age_seconds),
    };
  }
}

export const webPushAdmissionRecoveryRepository = new WebPushAdmissionRecoveryRepository();
