import { randomUUID } from "node:crypto";
import { and, count, eq, gt, isNull, or, sql } from "drizzle-orm";
import { db } from "../client";
import {
  sessions,
  webPushOutbox,
  webPushQueueGate,
  webPushSubscriptions,
} from "../schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const WEB_PUSH_OUTBOX_TTL_HOURS = 24;
export const WEB_PUSH_OUTBOX_MAX_ACTIVE_SUBSCRIPTIONS = 64;

export type WebPushOutboxEnqueueResult = Readonly<{
  queued: number;
  reason: "queued" | "no_subscriptions" | "saturated";
}>;

export type WebPushOutboxQueueStats = Readonly<{
  pending: number;
  due: number;
  leased: number;
  capacity: number;
  oldestAgeSeconds: number;
}>;

export async function enqueueWebPushOutboxForNotification(
  tx: Tx,
  notificationId: string,
  recipientId: string,
): Promise<WebPushOutboxEnqueueResult> {
  const subscriptions = await tx
    .select({ id: webPushSubscriptions.id })
    .from(webPushSubscriptions)
    .innerJoin(sessions, eq(sessions.id, webPushSubscriptions.sessionId))
    .where(
      and(
        eq(webPushSubscriptions.userId, recipientId),
        gt(sessions.expiresAt, sql`clock_timestamp()`),
        or(
          isNull(webPushSubscriptions.expirationAt),
          gt(webPushSubscriptions.expirationAt, sql`clock_timestamp()`),
        ),
      ),
    )
    .orderBy(webPushSubscriptions.createdAt, webPushSubscriptions.id)
    .limit(WEB_PUSH_OUTBOX_MAX_ACTIVE_SUBSCRIPTIONS);

  if (subscriptions.length === 0) {
    return Object.freeze({
      queued: 0,
      reason: "no_subscriptions" as const,
    });
  }

  const [gate] = await tx
    .select()
    .from(webPushQueueGate)
    .where(eq(webPushQueueGate.singleton, true))
    .for("update");
  if (!gate) throw new Error("Web Push queue gate is unavailable");

  const [current] = await tx
    .select({ total: count() })
    .from(webPushOutbox)
    .where(gt(webPushOutbox.expiresAt, sql`clock_timestamp()`));

  if (current.total + subscriptions.length > gate.capacity) {
    return Object.freeze({
      queued: 0,
      reason: "saturated" as const,
    });
  }

  const rows = subscriptions.map((subscription) => ({
    id: `wpo_${randomUUID()}`,
    notificationId,
    subscriptionId: subscription.id,
    attempts: 0,
    availableAt: sql`clock_timestamp()`,
    createdAt: sql`clock_timestamp()`,
    expiresAt: sql`clock_timestamp() + interval '24 hours'`,
  }));

  const inserted = await tx
    .insert(webPushOutbox)
    .values(rows)
    .onConflictDoNothing({
      target: [
        webPushOutbox.notificationId,
        webPushOutbox.subscriptionId,
      ],
    })
    .returning({ id: webPushOutbox.id });

  return Object.freeze({
    queued: inserted.length,
    reason: "queued" as const,
  });
}

export class WebPushOutboxRepository {
  async stats(): Promise<WebPushOutboxQueueStats> {
    const rows = await db.execute(sql`
      select
        g."capacity"::integer as "capacity",
        count(o."id")::integer as "pending",
        count(o."id") filter (
          where o."expires_at" > clock_timestamp()
            and o."attempts" < 5
            and o."available_at" <= clock_timestamp()
            and (
              o."lease_expires_at" is null
              or o."lease_expires_at" <= clock_timestamp()
            )
        )::integer as "due",
        count(o."id") filter (
          where o."lease_expires_at" > clock_timestamp()
        )::integer as "leased",
        coalesce(
          greatest(
            0,
            floor(
              extract(
                epoch from (
                  clock_timestamp() - min(o."created_at")
                )
              )
            )
          ),
          0
        )::integer as "oldest_age_seconds"
      from "web_push_queue_gate" g
      left join "web_push_outbox" o
        on o."expires_at" > clock_timestamp()
      where g."singleton" = true
      group by g."capacity"
    `);
    if (rows.length !== 1) {
      throw new Error("Web Push queue gate is unavailable");
    }
    const row = rows[0];
    const result = {
      pending: Number(row.pending),
      due: Number(row.due),
      leased: Number(row.leased),
      capacity: Number(row.capacity),
      oldestAgeSeconds: Number(row.oldest_age_seconds),
    };
    if (
      !Object.values(result).every(
        (value) => Number.isInteger(value) && value >= 0,
      ) ||
      result.capacity < 1 ||
      result.due > result.pending ||
      result.leased > result.pending
    ) {
      throw new Error("Web Push queue statistics are invalid");
    }
    return Object.freeze(result);
  }
}

export const webPushOutboxRepository = new WebPushOutboxRepository();
