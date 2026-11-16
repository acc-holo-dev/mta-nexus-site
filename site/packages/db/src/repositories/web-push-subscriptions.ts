import { UnauthorizedError } from "@nexus/domain";
import { and, count, eq, gt, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "../client";
import { sessions, users, webPushSubscriptions } from "../schema";
import type { ResourceTransaction } from "../transaction";
import { digestSessionToken } from "./sessions";

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

type SubscriptionWrite = {
  id: string;
  userId: string;
  sessionId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  expirationAt: Date | null;
  userAgent?: string | null;
};

async function lockWebPushSession(
  tx: ResourceTransaction,
  userId: string,
  sessionId: string,
  token: string,
) {
  if (!token) throw new UnauthorizedError("Authentication required");
  const [current] = await tx
    .select({ id: sessions.id, expiresAt: sessions.expiresAt })
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        eq(sessions.id, sessionId),
        eq(sessions.token, digestSessionToken(token)),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .for("update");
  const expiresAt = current ? new Date(current.expiresAt).getTime() : Number.NaN;
  if (!current || !Number.isFinite(expiresAt) || expiresAt <= Date.now())
    throw new UnauthorizedError("Authentication required");
}

async function lockWebPushActor(tx: ResourceTransaction, userId: string) {
  const [actor] = await tx
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .for("share");
  if (!actor) throw new UnauthorizedError("Authentication required");
}

function checkSubscriptionLimit(maxPerSession: number) {
  if (!Number.isSafeInteger(maxPerSession) || maxPerSession < 1 || maxPerSession > 32) {
    throw new RangeError("Invalid Web Push subscription limit");
  }
}

export type WebPushSubscriptionUpsertResult =
  | {
      status: "stored";
      subscription: WebPushSubscriptionRecord;
    }
  | { status: "endpoint_conflict" }
  | { status: "session_limit" };

export class WebPushSubscriptionRepository {
  /** Trusted internal fixture/soak path; HTTP callers must use upsertAuthenticated. */
  async upsertWithResult(
    input: SubscriptionWrite,
    maxPerSession = MAX_WEB_PUSH_SUBSCRIPTIONS_PER_SESSION,
  ): Promise<WebPushSubscriptionUpsertResult> {
    checkSubscriptionLimit(maxPerSession);
    return db.transaction((tx) => this.upsertWithin(tx, input, maxPerSession));
  }

  /** HTTP writes must use the initiating bearer token, never just session identifiers. */
  async upsertAuthenticated(
    input: SubscriptionWrite,
    token: string,
  ): Promise<WebPushSubscriptionUpsertResult> {
    return db.transaction(async (tx) => {
      await lockWebPushActor(tx, input.userId);
      await lockWebPushSession(tx, input.userId, input.sessionId, token);
      const result = await this.upsertWithin(tx, input, MAX_WEB_PUSH_SUBSCRIPTIONS_PER_SESSION);
      await lockWebPushSession(tx, input.userId, input.sessionId, token);
      return result;
    });
  }

  private async upsertWithin(
    tx: ResourceTransaction,
    input: SubscriptionWrite,
    maxPerSession: number,
  ): Promise<WebPushSubscriptionUpsertResult> {
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
  }

  /** Trusted internal fixture/soak path; HTTP callers must use upsertAuthenticated. */
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

  /** Trusted internal path; HTTP callers must use removeAuthenticated. */
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

  async removeAuthenticated(
    userId: string,
    sessionId: string,
    token: string,
    endpoint: string,
  ): Promise<boolean> {
    return db.transaction(async (tx) => {
      await lockWebPushActor(tx, userId);
      await lockWebPushSession(tx, userId, sessionId, token);
      const rows = await tx
        .delete(webPushSubscriptions)
        .where(
          and(
            eq(webPushSubscriptions.userId, userId),
            eq(webPushSubscriptions.sessionId, sessionId),
            eq(webPushSubscriptions.endpoint, endpoint),
          ),
        )
        .returning({ id: webPushSubscriptions.id });
      await lockWebPushSession(tx, userId, sessionId, token);
      return rows.length > 0;
    });
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
