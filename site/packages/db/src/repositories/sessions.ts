import crypto from "node:crypto";
import { and, desc, eq, gt, ne } from "drizzle-orm";
import { db } from "../client";
import { sessions, users } from "../schema";
import type { User } from "@nexus/domain";
import { publicUserColumns, toUserWithoutPassword } from "./public-user-projection";

export interface SessionRecord {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export type SessionSummary = Pick<
  SessionRecord,
  "id" | "expiresAt" | "ipAddress" | "userAgent" | "createdAt"
>;

export function digestSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

function hasLiveExpiry(expiresAt: Date): boolean {
  const time = new Date(expiresAt).getTime();
  return Number.isFinite(time) && time > Date.now();
}

export class SessionRepository {
  async create(data: {
    id: string;
    userId: string;
    token: string;
    expiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<SessionRecord> {
    const values = {
      id: data.id,
      userId: data.userId,
      token: digestSessionToken(data.token),
      expiresAt: data.expiresAt,
      ipAddress: data.ipAddress || null,
      userAgent: data.userAgent || null,
      createdAt: new Date(),
    };

    const rows = await db.insert(sessions).values(values).returning();
    return rows[0] as SessionRecord;
  }

  async findValidIdentity(token: string): Promise<{ sessionId: string; user: User } | null> {
    const rows = await db
      .select({
        sessionId: sessions.id,
        expiresAt: sessions.expiresAt,
        user: publicUserColumns,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(eq(sessions.token, digestSessionToken(token)))
      .limit(1);

    const row = rows[0];
    if (!row || !hasLiveExpiry(row.expiresAt)) return null;
    return { sessionId: row.sessionId, user: toUserWithoutPassword(row.user) };
  }

  async findValidSession(token: string): Promise<{ session: SessionRecord; user: User } | null> {
    const rows = await db
      .select({
        session: sessions,
        user: publicUserColumns,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(eq(sessions.token, digestSessionToken(token)))
      .limit(1);

    if (!rows.length) return null;
    const session = rows[0].session as SessionRecord;
    if (!hasLiveExpiry(session.expiresAt)) {
      return null;
    }
    return {
      session,
      user: toUserWithoutPassword(rows[0].user),
    };
  }

  async listByUser(userId: string): Promise<SessionSummary[]> {
    const rows = await db
      .select({
        id: sessions.id,
        expiresAt: sessions.expiresAt,
        ipAddress: sessions.ipAddress,
        userAgent: sessions.userAgent,
        createdAt: sessions.createdAt,
      })
      .from(sessions)
      .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, new Date())))
      .orderBy(desc(sessions.createdAt));
    return rows.map((row) => ({
      ...row,
      ipAddress: row.ipAddress ?? undefined,
      userAgent: row.userAgent ?? undefined,
    })) as SessionSummary[];
  }

  async deleteById(id: string, userId: string): Promise<boolean> {
    const rows = await db
      .delete(sessions)
      .where(and(eq(sessions.id, id), eq(sessions.userId, userId)))
      .returning({ id: sessions.id });
    return rows.length > 0;
  }

  async deleteOtherSessions(userId: string, currentToken: string): Promise<number> {
    const rows = await db
      .delete(sessions)
      .where(and(eq(sessions.userId, userId), ne(sessions.token, digestSessionToken(currentToken))))
      .returning({ id: sessions.id });
    return rows.length;
  }

  async delete(token: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.token, digestSessionToken(token)));
  }
}

export const sessionRepository = new SessionRepository();
