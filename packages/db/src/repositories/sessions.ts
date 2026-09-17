import crypto from "node:crypto";
import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "../client";
import { sessions, users } from "../schema";
import type { User } from "@nexus/domain";

export interface SessionRecord {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export function digestSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
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

  async findValidSession(token: string): Promise<{ session: SessionRecord; user: User } | null> {
    const rows = await db
      .select({
        session: sessions,
        user: users,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(eq(sessions.token, digestSessionToken(token)))
      .limit(1);

    if (!rows.length) return null;
    const session = rows[0].session as SessionRecord;
    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      return null;
    }
    const { passwordHash: _, ...publicUser } = rows[0].user;
    return {
      session,
      user: publicUser as unknown as User,
    };
  }

  async listByUser(userId: string): Promise<Array<Omit<SessionRecord, "token">>> {
    const rows = await db
      .select({
        id: sessions.id,
        userId: sessions.userId,
        expiresAt: sessions.expiresAt,
        ipAddress: sessions.ipAddress,
        userAgent: sessions.userAgent,
        createdAt: sessions.createdAt,
      })
      .from(sessions)
      .where(eq(sessions.userId, userId))
      .orderBy(desc(sessions.createdAt));
    return rows as Array<Omit<SessionRecord, "token">>;
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
      .where(
        and(
          eq(sessions.userId, userId),
          ne(sessions.token, digestSessionToken(currentToken))
        )
      )
      .returning({ id: sessions.id });
    return rows.length;
  }

  async delete(token: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.token, digestSessionToken(token)));
  }
}

export const sessionRepository = new SessionRepository();
