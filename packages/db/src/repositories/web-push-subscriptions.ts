import { and, count, eq } from "drizzle-orm";
import { db } from "../client";
import { webPushSubscriptions } from "../schema";

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
    const [row] = await db.select({ total: count() }).from(webPushSubscriptions).where(
      and(
        eq(webPushSubscriptions.userId, userId),
        eq(webPushSubscriptions.sessionId, sessionId),
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
    return await db.select().from(webPushSubscriptions).where(
      eq(webPushSubscriptions.userId, userId),
    ) as WebPushSubscriptionRecord[];
  }
}

export const webPushSubscriptionRepository = new WebPushSubscriptionRepository();
