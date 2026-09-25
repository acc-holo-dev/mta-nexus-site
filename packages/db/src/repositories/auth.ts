import { and, eq, gt, ne } from "drizzle-orm";
import { db } from "../client";
import { auditEvents, sessions, users } from "../schema";
import { ConflictError, UnauthorizedError } from "@nexus/domain";
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
type AuthTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

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

  async createLoginSession(
    session: SessionWrite,
    audit: AuditWrite,
    expectedPasswordHash: string
  ): Promise<void> {
    await db.transaction(async (tx) => {
      // Serialize with password changes. Password verification runs before this
      // short transaction; a previously verified, now-obsolete hash cannot log in.
      const [user] = await tx.select({ passwordHash: users.passwordHash })
        .from(users).where(eq(users.id, session.userId)).for("update");
      if (!user || user.passwordHash !== expectedPasswordHash) {
        throw new UnauthorizedError("Invalid email or password");
      }
      await tx.insert(sessions).values(this.sessionValues(session));
      await tx.insert(auditEvents).values({ ...audit, createdAt: new Date() });
    });
  }

  async changePassword(data: {
    userId: string;
    expectedPasswordHash: string;
    passwordHash: string;
    currentToken: string;
    nextToken: string;
    audit: AuditWrite;
  }): Promise<{ revokedSessionCount: number; expiresAt: Date }> {
    return db.transaction(async (tx) => {
      // All password changes and login commits acquire the same user lock first.
      const [user] = await tx.select({ passwordHash: users.passwordHash })
        .from(users).where(eq(users.id, data.userId)).for("update");
      if (!user || user.passwordHash !== data.expectedPasswordHash) {
        throw new ConflictError("Your account changed during this request. Please sign in again.");
      }
      const [current] = await tx.select().from(sessions).where(and(
        eq(sessions.userId, data.userId),
        eq(sessions.token, digestSessionToken(data.currentToken)),
        gt(sessions.expiresAt, new Date())
      )).for("update");
      if (!current || current.expiresAt.getTime() <= Date.now()) {
        throw new UnauthorizedError("Authentication required");
      }

      await tx.update(users).set({ passwordHash: data.passwordHash, updatedAt: new Date() })
        .where(eq(users.id, data.userId));
      const revoked = await tx.delete(sessions).where(and(
        eq(sessions.userId, data.userId), ne(sessions.id, current.id)
      )).returning({ expiresAt: sessions.expiresAt });
      // Keep this browser signed in, but invalidate its previous bearer token.
      // Preserve the original expiry instead of extending the session lifetime.
      await tx.update(sessions).set({ token: digestSessionToken(data.nextToken) })
        .where(eq(sessions.id, current.id));
      const revokedSessionCount = revoked.filter((row) => row.expiresAt.getTime() > Date.now()).length;
      await tx.insert(auditEvents).values({
        ...data.audit,
        details: { revokedSessionCount, currentSessionRotated: true },
        createdAt: new Date(),
      });
      return { revokedSessionCount, expiresAt: current.expiresAt };
    });
  }

  async revokeOwnedSession(data: {
    userId: string;
    currentToken: string;
    sessionId: string;
    auditId: string;
  }): Promise<boolean> {
    return db.transaction(async (tx) => {
      const current = await this.lockSessionActor(tx, data.userId, data.currentToken);
      if (data.sessionId === current.id) {
        throw new ConflictError("The current session cannot be revoked here; use logout instead");
      }
      const revoked = await tx.delete(sessions).where(and(
        eq(sessions.id, data.sessionId), eq(sessions.userId, data.userId)
      )).returning({ id: sessions.id });
      if (revoked.length === 0) return false;
      await tx.insert(auditEvents).values({
        id: data.auditId, actorId: data.userId, actorType: "user",
        action: "user.session_revoked", targetId: data.userId, targetType: "user",
        details: { sessionId: data.sessionId }, createdAt: new Date(),
      });
      return true;
    });
  }

  async revokeOtherSessions(data: {
    userId: string;
    currentToken: string;
    auditId: string;
  }): Promise<number> {
    return db.transaction(async (tx) => {
      const current = await this.lockSessionActor(tx, data.userId, data.currentToken);
      const cutoff = Date.now();
      const revoked = await tx.delete(sessions).where(and(
        eq(sessions.userId, data.userId), ne(sessions.id, current.id)
      )).returning({ expiresAt: sessions.expiresAt });
      if (revoked.length === 0) return 0;
      // Expired rows are removed too, but are not presented as active logins.
      const revokedCount = revoked.filter((row) => row.expiresAt.getTime() > cutoff).length;
      await tx.insert(auditEvents).values({
        id: data.auditId, actorId: data.userId, actorType: "user",
        action: "user.other_sessions_revoked", targetId: data.userId, targetType: "user",
        details: { revokedCount, removedSessionCount: revoked.length }, createdAt: new Date(),
      });
      return revokedCount;
    });
  }

  private async lockSessionActor(tx: AuthTransaction, userId: string, token: string) {
    // Match login/password-change lock order: user first, then current session.
    // Recheck AFTER any lock wait; the route's earlier authorization may be stale.
    const [user] = await tx.select({ id: users.id }).from(users)
      .where(eq(users.id, userId)).for("update");
    if (!user) throw new UnauthorizedError("Authentication required");
    const [current] = await tx.select({ id: sessions.id, expiresAt: sessions.expiresAt })
      .from(sessions).where(and(
        eq(sessions.userId, userId), eq(sessions.token, digestSessionToken(token)),
        gt(sessions.expiresAt, new Date())
      )).for("update");
    if (!current || current.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedError("Authentication required");
    }
    return current;
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
