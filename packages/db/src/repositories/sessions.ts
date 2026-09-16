import { eq, and, gt } from "drizzle-orm";
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
      token: data.token,
      expiresAt: data.expiresAt,
      ipAddress: data.ipAddress || null,
      userAgent: data.userAgent || null,
      createdAt: new Date(),
    };

    try {
      const rows = await db.insert(sessions).values(values).returning();
      return rows[0] as SessionRecord;
    } catch {
      return values as SessionRecord;
    }
  }

  async findValidSession(token: string): Promise<{ session: SessionRecord; user: User } | null> {
    try {
      const rows = await db
        .select({
          session: sessions,
          user: users,
        })
        .from(sessions)
        .innerJoin(users, eq(sessions.userId, users.id))
        .where(eq(sessions.token, token))
        .limit(1);

      if (!rows.length) return null;
      const session = rows[0].session as SessionRecord;
      if (new Date(session.expiresAt).getTime() <= Date.now()) {
        return null;
      }
      return {
        session,
        user: rows[0].user as unknown as User,
      };
    } catch {
      return null;
    }
  }

  async delete(token: string): Promise<void> {
    try {
      await db.delete(sessions).where(eq(sessions.token, token));
    } catch {
      // ignore
    }
  }
}

export const sessionRepository = new SessionRepository();
