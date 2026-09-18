import { eq } from "drizzle-orm";
import { db } from "../client";
import { auditEvents, sessions, users } from "../schema";
import type { AuditEvent, User } from "@nexus/domain";
import { digestSessionToken } from "./sessions";

interface SessionWrite {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

type AuditWrite = Omit<AuditEvent, "createdAt">;

export class AuthRepository {
  async registerAccount(data: {
    user: {
      id: string;
      email: string;
      username: string;
      displayName: string;
      passwordHash: string;
    };
    session: SessionWrite;
    audit: AuditWrite;
  }): Promise<User> {
    return db.transaction(async (tx) => {
      const rows = await tx
        .insert(users)
        .values({
          ...data.user,
          email: data.user.email.toLowerCase(),
          role: "user",
          isVerified: false,
          emailVerified: false,
          twoFactorEnabled: false,
          activeContextId: "personal",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      await tx.insert(sessions).values(this.sessionValues(data.session));
      await tx.insert(auditEvents).values({ ...data.audit, createdAt: new Date() });
      return rows[0] as unknown as User;
    });
  }

  async createLoginSession(session: SessionWrite, audit: AuditWrite): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.insert(sessions).values(this.sessionValues(session));
      await tx.insert(auditEvents).values({ ...audit, createdAt: new Date() });
    });
  }

  async revokeSession(token: string, audit: AuditWrite): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.insert(auditEvents).values({ ...audit, createdAt: new Date() });
      await tx.delete(sessions).where(eq(sessions.token, digestSessionToken(token)));
    });
  }

  private sessionValues(session: SessionWrite) {
    return {
      id: session.id,
      userId: session.userId,
      token: digestSessionToken(session.token),
      expiresAt: session.expiresAt,
      ipAddress: session.ipAddress || null,
      userAgent: session.userAgent || null,
      createdAt: new Date(),
    };
  }
}

export const authRepository = new AuthRepository();
