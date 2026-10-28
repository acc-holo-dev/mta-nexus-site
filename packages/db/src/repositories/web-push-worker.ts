import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { db } from "../client";
import { notifications, sessions, webPushOutbox, webPushSubscriptions } from "../schema";
import { normalizeWebPushPayload } from "../web-push-runtime";
import type { WebPushNotificationPayload } from "../web-push-runtime";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const WEB_PUSH_MAX_ATTEMPTS = 5;
const LEASE_MS = 60_000;
const BACKOFF_MS = [5_000, 30_000, 120_000, 300_000] as const;

export type WebPushLease = Readonly<{
  id: string;
  token: string;
  attempt: number;
  expiresAt: Date;
}>;

export type PreparedWebPushJob = Readonly<{
  id: string;
  notificationId: string;
  subscriptionId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  payload: WebPushNotificationPayload;
  sendBefore: Date;
  sendWithinMs: number;
}>;

const availableLease = () =>
  or(
    isNull(webPushOutbox.leaseExpiresAt),
    lte(webPushOutbox.leaseExpiresAt, sql`clock_timestamp()`),
  );

function checkId(id: string) {
  if (typeof id !== "string" || !/^wpo_[0-9a-f-]{36}$/u.test(id)) {
    throw new Error("Invalid Web Push outbox identifier");
  }
}

function checkLimit(limit: number) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new RangeError("Invalid Web Push batch limit");
  }
}

function leaseDigest(lease: WebPushLease): string {
  checkId(lease.id);
  if (
    !Number.isSafeInteger(lease.attempt) ||
    lease.attempt < 1 ||
    lease.attempt > WEB_PUSH_MAX_ATTEMPTS ||
    typeof lease.token !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/u.test(lease.token) ||
    Buffer.from(lease.token, "base64url").toString("base64url") !== lease.token
  ) {
    throw new Error("Invalid Web Push lease");
  }
  return createHash("sha256").update(`nexus:web-push-lease:v1\0${lease.token}`).digest("hex");
}

function retryDelayMs(id: string, attempt: number): number {
  const base = BACKOFF_MS[Math.min(Math.max(attempt - 1, 0), BACKOFF_MS.length - 1)];
  const digest = createHash("sha256")
    .update(`nexus:web-push-backoff:v1\0${id}\0${attempt}`)
    .digest();
  const fraction = digest.readUInt32BE(0) / 0xffffffff;
  return Math.max(1_000, Math.round(base * (0.8 + fraction * 0.4)));
}

async function clock(tx: Tx): Promise<Date> {
  const [row] = await tx.execute(sql`select clock_timestamp()::text as now`);
  return new Date(String(row.now));
}

async function transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(
    async (tx) => {
      await tx.execute(sql`set local lock_timeout = '5s'`);
      await tx.execute(sql`set local statement_timeout = '10s'`);
      return work(tx);
    },
    { isolationLevel: "read committed" },
  );
}

export class WebPushWorkerRepository {
  async candidates(limit = 20): Promise<string[]> {
    checkLimit(limit);
    const rows = await db
      .select({ id: webPushOutbox.id })
      .from(webPushOutbox)
      .where(
        and(
          lte(webPushOutbox.availableAt, sql`clock_timestamp()`),
          availableLease(),
          gt(webPushOutbox.expiresAt, sql`clock_timestamp()`),
          lt(webPushOutbox.attempts, WEB_PUSH_MAX_ATTEMPTS),
        ),
      )
      .orderBy(webPushOutbox.availableAt, webPushOutbox.id)
      .limit(limit);
    return rows.map((row) => row.id);
  }

  async claim(id: string): Promise<WebPushLease | null> {
    checkId(id);
    return transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(webPushOutbox)
        .where(eq(webPushOutbox.id, id))
        .for("update");
      if (!row) return null;

      const now = await clock(tx);
      if (
        row.expiresAt <= now ||
        row.attempts >= WEB_PUSH_MAX_ATTEMPTS ||
        row.availableAt > now ||
        (row.leaseExpiresAt && row.leaseExpiresAt > now)
      ) {
        return null;
      }

      const token = randomBytes(32).toString("base64url");
      const lease: WebPushLease = {
        id,
        token,
        attempt: row.attempts + 1,
        expiresAt: new Date(Math.min(now.getTime() + LEASE_MS, row.expiresAt.getTime())),
      };
      const [changed] = await tx
        .update(webPushOutbox)
        .set({
          attempts: lease.attempt,
          leaseTokenDigest: leaseDigest(lease),
          leaseExpiresAt: lease.expiresAt,
        })
        .where(
          and(
            eq(webPushOutbox.id, id),
            availableLease(),
            lte(webPushOutbox.availableAt, sql`clock_timestamp()`),
            gt(webPushOutbox.expiresAt, sql`clock_timestamp()`),
          ),
        )
        .returning({ id: webPushOutbox.id });

      return changed ? Object.freeze(lease) : null;
    });
  }

  async prepare(lease: WebPushLease): Promise<PreparedWebPushJob | null> {
    const digest = leaseDigest(lease);

    return transaction(async (tx) => {
      const [row] = await tx
        .select({
          outbox: webPushOutbox,
          notification: notifications,
          subscription: webPushSubscriptions,
          sessionExpiresAt: sessions.expiresAt,
        })
        .from(webPushOutbox)
        .innerJoin(notifications, eq(notifications.id, webPushOutbox.notificationId))
        .innerJoin(webPushSubscriptions, eq(webPushSubscriptions.id, webPushOutbox.subscriptionId))
        .innerJoin(sessions, eq(sessions.id, webPushSubscriptions.sessionId))
        .where(eq(webPushOutbox.id, lease.id))
        .for("update", {
          of: webPushOutbox,
        });

      if (!row) return null;
      const now = await clock(tx);
      const subscriptionExpiresAt = row.subscription.expirationAt;

      const owns =
        row.outbox.attempts === lease.attempt &&
        row.outbox.leaseTokenDigest === digest &&
        row.outbox.leaseExpiresAt !== null &&
        row.outbox.leaseExpiresAt.getTime() === lease.expiresAt.getTime();
      const valid =
        row.outbox.expiresAt > now &&
        row.sessionExpiresAt > now &&
        row.subscription.userId === row.notification.recipientId &&
        (subscriptionExpiresAt === null || subscriptionExpiresAt > now);

      if (!owns) return null;
      if (!valid) {
        await tx.delete(webPushOutbox).where(eq(webPushOutbox.id, lease.id));
        return null;
      }

      const validUntil = new Date(
        Math.min(
          row.outbox.expiresAt.getTime(),
          row.sessionExpiresAt.getTime(),
          subscriptionExpiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER,
          row.outbox.leaseExpiresAt!.getTime(),
        ),
      );
      if (validUntil <= now) return null;

      return Object.freeze({
        id: row.outbox.id,
        notificationId: row.notification.id,
        subscriptionId: row.subscription.id,
        endpoint: row.subscription.endpoint,
        p256dh: row.subscription.p256dh,
        auth: row.subscription.auth,
        payload: normalizeWebPushPayload({
          title: row.notification.title,
          body: row.notification.message,
          ...(row.notification.link ? { url: row.notification.link } : {}),
          tag: row.notification.id,
        }),
        sendBefore: validUntil,
        sendWithinMs: Math.max(0, validUntil.getTime() - now.getTime()),
      });
    });
  }

  async settle(
    lease: WebPushLease,
    outcome: "accepted" | "retry" | "discard",
    statusCode?: number,
    retryAfterMs?: number,
  ): Promise<boolean> {
    const digest = leaseDigest(lease);
    if (
      statusCode !== undefined &&
      (!Number.isSafeInteger(statusCode) || statusCode < 100 || statusCode > 599)
    ) {
      throw new RangeError("Invalid Web Push status code");
    }
    if (
      retryAfterMs !== undefined &&
      (!Number.isSafeInteger(retryAfterMs) ||
        retryAfterMs < 0 ||
        retryAfterMs > 24 * 60 * 60 * 1_000)
    ) {
      throw new RangeError("Invalid Web Push Retry-After");
    }

    return transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(webPushOutbox)
        .where(eq(webPushOutbox.id, lease.id))
        .for("update");
      const now = await clock(tx);
      if (
        !row ||
        row.attempts !== lease.attempt ||
        row.leaseTokenDigest !== digest ||
        row.leaseExpiresAt === null ||
        row.leaseExpiresAt.getTime() !== lease.expiresAt.getTime() ||
        row.leaseExpiresAt <= now ||
        row.expiresAt <= now
      ) {
        return false;
      }

      if (
        outcome === "accepted" ||
        outcome === "discard" ||
        lease.attempt >= WEB_PUSH_MAX_ATTEMPTS
      ) {
        const deleted = await tx
          .delete(webPushOutbox)
          .where(
            and(
              eq(webPushOutbox.id, lease.id),
              eq(webPushOutbox.leaseTokenDigest, digest),
              eq(webPushOutbox.attempts, lease.attempt),
            ),
          )
          .returning({ id: webPushOutbox.id });
        return deleted.length === 1;
      }

      const retryDelay = Math.max(retryDelayMs(lease.id, lease.attempt), retryAfterMs ?? 0);
      const retryAt = new Date(Math.min(now.getTime() + retryDelay, row.expiresAt.getTime()));
      if (retryAt <= now) {
        await tx.delete(webPushOutbox).where(eq(webPushOutbox.id, lease.id));
        return true;
      }

      const [changed] = await tx
        .update(webPushOutbox)
        .set({
          availableAt: retryAt,
          leaseTokenDigest: null,
          leaseExpiresAt: null,
          lastStatusCode: statusCode ?? null,
        })
        .where(
          and(
            eq(webPushOutbox.id, lease.id),
            eq(webPushOutbox.leaseTokenDigest, digest),
            eq(webPushOutbox.attempts, lease.attempt),
          ),
        )
        .returning({ id: webPushOutbox.id });
      return Boolean(changed);
    });
  }

  async discardStaleSubscription(lease: WebPushLease, subscriptionId: string): Promise<boolean> {
    const digest = leaseDigest(lease);
    return transaction(async (tx) => {
      const [row] = await tx
        .select({
          id: webPushOutbox.id,
          subscriptionId: webPushOutbox.subscriptionId,
          attempts: webPushOutbox.attempts,
          leaseTokenDigest: webPushOutbox.leaseTokenDigest,
          leaseExpiresAt: webPushOutbox.leaseExpiresAt,
        })
        .from(webPushOutbox)
        .where(eq(webPushOutbox.id, lease.id))
        .for("update");
      const now = await clock(tx);
      if (
        !row ||
        row.subscriptionId !== subscriptionId ||
        row.attempts !== lease.attempt ||
        row.leaseTokenDigest !== digest ||
        row.leaseExpiresAt === null ||
        row.leaseExpiresAt.getTime() !== lease.expiresAt.getTime() ||
        row.leaseExpiresAt <= now
      ) {
        return false;
      }

      const removed = await tx
        .delete(webPushSubscriptions)
        .where(eq(webPushSubscriptions.id, subscriptionId))
        .returning({ id: webPushSubscriptions.id });
      return removed.length === 1;
    });
  }

  async discardUnavailable(limit = 100): Promise<number> {
    checkLimit(limit);
    return transaction(async (tx) => {
      const rows = await tx
        .select({ id: webPushOutbox.id })
        .from(webPushOutbox)
        .where(
          or(
            lte(webPushOutbox.expiresAt, sql`clock_timestamp()`),
            and(sql`${webPushOutbox.attempts} >= ${WEB_PUSH_MAX_ATTEMPTS}`, availableLease()),
          ),
        )
        .orderBy(webPushOutbox.expiresAt, webPushOutbox.id)
        .limit(limit)
        .for("update", { skipLocked: true });
      if (!rows.length) return 0;

      const removed = await tx
        .delete(webPushOutbox)
        .where(
          inArray(
            webPushOutbox.id,
            rows.map((row) => row.id),
          ),
        )
        .returning({ id: webPushOutbox.id });
      return removed.length;
    });
  }
}

export const webPushWorkerRepository = new WebPushWorkerRepository();
