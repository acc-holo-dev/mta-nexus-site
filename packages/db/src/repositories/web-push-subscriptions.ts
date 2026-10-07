import { and, count, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "../client";
import { sessions, webPushSubscriptions } from "../schema";

export type WebPushSubscriptionRecord = {
  id: string;
  userId: string;
  sessionId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  expirationAt: Date | null;
  userAgent: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export class WebPushSubscriptionRepository {
  async upsert(input: {
    id: string;
    userId: string;
    sessionId: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    expirationAt: Date | null;
    userAgent?: string | null;
  }): Promise<WebPushSubscriptionRecord> {
    const now = new Date();
    const [row] = await db.insert(webPushSubscriptions).values({
      ...input,
      userAgent: input.userAgent ?? null,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: webPushSubscriptions.endpoint,
      set: {
        userId: input.userId,
        sessionId: input.sessionId,
        p256dh: input.p256dh,
        auth: input.auth,
        expirationAt: input.expirationAt,
        userAgent: input.userAgent ?? null,
        updatedAt: now,
      },
    }).returning();
    return row as WebPushSubscriptionRecord;
  }

  async countForSession(userId: string, sessionId: string): Promise<number> {
    const now = new Date();
    const [row] = await db
      .select({ total: count() })
      .from(webPushSubscriptions)
      .innerJoin(sessions, eq(sessions.id, webPushSubscriptions.sessionId))
      .where(
        and(
          eq(webPushSubscriptions.userId, userId),
          eq(webPushSubscriptions.sessionId, sessionId),
          gt(sessions.expiresAt, now),
          or(
            isNull(webPushSubscriptions.expirationAt),
            gt(webPushSubscriptions.expirationAt, now),
          ),
        ),
      );
    return row.total;
  }

  async removeForSession(userId: string, sessionId: string, endpoint: string): Promise<boolean> {
    const rows = await db.delete(webPushSubscriptions).where(
      and(
        eq(webPushSubscriptions.userId, userId),
        eq(webPushSubscriptions.sessionId, sessionId),
        eq(webPushSubscriptions.endpoint, endpoint),
      ),
    ).returning({ id: webPushSubscriptions.id });
    return rows.length > 0;
  }

  async listByUser(userId: string): Promise<WebPushSubscriptionRecord[]> {
    const now = new Date();
    const rows = await db
      .select({
        id: webPushSubscriptions.id,
        userId: webPushSubscriptions.userId,
        sessionId: webPushSubscriptions.sessionId,
        endpoint: webPushSubscriptions.endpoint,
        p256dh: webPushSubscriptions.p256dh,
        auth: webPushSubscriptions.auth,
        expirationAt: webPushSubscriptions.expirationAt,
        userAgent: webPushSubscriptions.userAgent,
        createdAt: webPushSubscriptions.createdAt,
        updatedAt: webPushSubscriptions.updatedAt,
      })
      .from(webPushSubscriptions)
      .innerJoin(sessions, eq(sessions.id, webPushSubscriptions.sessionId))
      .where(
        and(
          eq(webPushSubscriptions.userId, userId),
          gt(sessions.expiresAt, now),
          or(
            isNull(webPushSubscriptions.expirationAt),
            gt(webPushSubscriptions.expirationAt, now),
          ),
        ),
      );
    return rows as WebPushSubscriptionRecord[];
  }
}

export const webPushSubscriptionRepository = new WebPushSubscriptionRepository();
