import crypto from "node:crypto";
import { eq } from "drizzle-orm";
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
    return {
      session,
      user: rows[0].user as unknown as User,
    };
  }

  async delete(token: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.token, digestSessionToken(token)));
  }
}

export const sessionRepository = new SessionRepository();
