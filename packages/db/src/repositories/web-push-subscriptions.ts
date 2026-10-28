import { and, count, eq, gt, isNull, lte, or, sql } from "drizzle-orm";
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

export const MAX_WEB_PUSH_SUBSCRIPTIONS_PER_SESSION = 8;

export type WebPushSubscriptionUpsertResult =
  | {
      status: "stored";
      subscription: WebPushSubscriptionRecord;
    }
  | { status: "endpoint_conflict" }
  | { status: "session_limit" };

export class WebPushSubscriptionRepository {
  async upsertWithResult(
    input: {
      id: string;
      userId: string;
      sessionId: string;
      endpoint: string;
      p256dh: string;
      auth: string;
      expirationAt: Date | null;
      userAgent?: string | null;
    },
    maxPerSession = MAX_WEB_PUSH_SUBSCRIPTIONS_PER_SESSION,
  ): Promise<WebPushSubscriptionUpsertResult> {
    if (!Number.isSafeInteger(maxPerSession) || maxPerSession < 1 || maxPerSession > 32) {
      throw new RangeError("Invalid Web Push subscription limit");
    }

    return await db.transaction(async (tx) => {
      const now = new Date();

      // Serialize subscription mutations for this authenticated session so
      // concurrent unique endpoints cannot race past the per-session cap.
      await tx.execute(sql`
        select ${sessions.id}
        from ${sessions}
        where ${sessions.id} = ${input.sessionId}
          and ${sessions.userId} = ${input.userId}
        for update
      `);

      await tx
        .delete(webPushSubscriptions)
        .where(
          and(
            eq(webPushSubscriptions.userId, input.userId),
            eq(webPushSubscriptions.sessionId, input.sessionId),
            lte(webPushSubscriptions.expirationAt, now),
          ),
        );

      const [existing] = await tx
        .select()
        .from(webPushSubscriptions)
        .where(eq(webPushSubscriptions.endpoint, input.endpoint))
        .limit(1);

      if (existing) {
        if (existing.userId !== input.userId || existing.sessionId !== input.sessionId) {
          return { status: "endpoint_conflict" } as const;
        }

        const [updated] = await tx
          .update(webPushSubscriptions)
          .set({
            p256dh: input.p256dh,
            auth: input.auth,
            expirationAt: input.expirationAt,
            userAgent: input.userAgent ?? null,
            updatedAt: now,
          })
          .where(eq(webPushSubscriptions.id, existing.id))
          .returning();
        if (!updated) {
          throw new Error("Web Push subscription disappeared during refresh");
        }
        return {
          status: "stored",
          subscription: updated as WebPushSubscriptionRecord,
        } as const;
      }

      const [countRow] = await tx
        .select({ total: count() })
        .from(webPushSubscriptions)
        .where(
          and(
            eq(webPushSubscriptions.userId, input.userId),
            eq(webPushSubscriptions.sessionId, input.sessionId),
          ),
        );
      if (countRow.total >= maxPerSession) {
        return { status: "session_limit" } as const;
      }

      const [inserted] = await tx
        .insert(webPushSubscriptions)
        .values({
          ...input,
          userAgent: input.userAgent ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing({ target: webPushSubscriptions.endpoint })
        .returning();

      if (!inserted) {
        return { status: "endpoint_conflict" } as const;
      }
      return {
        status: "stored",
        subscription: inserted as WebPushSubscriptionRecord,
      } as const;
    });
  }

  async upsert(input: {
    id: string;
    userId: string;
    sessionId: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    expirationAt: Date | null;
    userAgent?: string | null;
  }): Promise<WebPushSubscriptionRecord | null> {
    const result = await this.upsertWithResult(input);
    return result.status === "stored" ? result.subscription : null;
  }

  async listForSession(userId: string, sessionId: string): Promise<WebPushSubscriptionRecord[]> {
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
          eq(webPushSubscriptions.sessionId, sessionId),
          gt(sessions.expiresAt, now),
          or(isNull(webPushSubscriptions.expirationAt), gt(webPushSubscriptions.expirationAt, now)),
        ),
      )
      .limit(32);
    return rows as WebPushSubscriptionRecord[];
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
          or(isNull(webPushSubscriptions.expirationAt), gt(webPushSubscriptions.expirationAt, now)),
        ),
      );
    return row.total;
  }

  async removeForSession(userId: string, sessionId: string, endpoint: string): Promise<boolean> {
    const rows = await db
      .delete(webPushSubscriptions)
      .where(
        and(
          eq(webPushSubscriptions.userId, userId),
          eq(webPushSubscriptions.sessionId, sessionId),
          eq(webPushSubscriptions.endpoint, endpoint),
        ),
      )
      .returning({ id: webPushSubscriptions.id });
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
          or(isNull(webPushSubscriptions.expirationAt), gt(webPushSubscriptions.expirationAt, now)),
        ),
      );
    return rows as WebPushSubscriptionRecord[];
  }
}

export const webPushSubscriptionRepository = new WebPushSubscriptionRepository();
