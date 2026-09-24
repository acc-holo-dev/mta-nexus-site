import { and, eq, sql } from "drizzle-orm";
import { UnauthorizedError } from "@nexus/domain";
import { db } from "../client";
import { auditEvents, notifications, sessions, users } from "../schema";
import { authChallenges } from "../account-recovery-schema";
import { accountChallengeRepository, digestAccountChallenge } from "./account-challenges";
import { accountMailOutboxRepository } from "./account-mail-outbox";
import type { AccountMailCipher } from "./account-mail-crypto";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const invalid = () => new UnauthorizedError("Invalid or expired password reset");

export class AccountPasswordResetRepository {
  async request(input: {
    userId: string;
    auditId: string;
    cipher: AccountMailCipher;
  }): Promise<{ challengeId: string; expiresAt: Date }> {
    const queued = await accountMailOutboxRepository.enqueue({
      purpose: "password_reset",
      userId: input.userId,
      auditId: input.auditId,
    }, input.cipher);
    return { challengeId: queued.challengeId, expiresAt: queued.expiresAt };
  }

  async assertLiveProof(input: {
    challengeId: string;
    token: string;
  }): Promise<void> {
    const tokenDigest = digestAccountChallenge("password_reset", input.token);
    const [candidate] = await db.select({ id: authChallenges.id })
      .from(authChallenges)
      .where(and(
        eq(authChallenges.id, input.challengeId),
        eq(authChallenges.purpose, "password_reset"),
        eq(authChallenges.tokenDigest, tokenDigest),
        sql`${authChallenges.consumedAt} is null`,
        sql`${authChallenges.revokedAt} is null`,
        sql`${authChallenges.expiresAt} > clock_timestamp()`,
      ))
      .limit(1);
    if (!candidate) throw invalid();
  }

  async confirm(input: {
    challengeId: string;
    token: string;
    passwordHash: string;
    consumeAuditId: string;
    resetAuditId: string;
    notificationId: string;
  }): Promise<{ revokedSessionCount: number }> {
    const tokenDigest = digestAccountChallenge("password_reset", input.token);
    const [candidate] = await db.select({ userId: authChallenges.userId })
      .from(authChallenges).where(and(
        eq(authChallenges.id, input.challengeId),
        eq(authChallenges.purpose, "password_reset"),
        eq(authChallenges.tokenDigest, tokenDigest),
      )).limit(1);
    if (!candidate) throw invalid();

    return accountChallengeRepository.consume({
      purpose: "password_reset",
      userId: candidate.userId,
      auditId: input.consumeAuditId,
      id: input.challengeId,
      token: input.token,
    }, async (tx: Tx, proof) => {
      if (proof.purpose !== "password_reset") throw invalid();

      const updated = await tx.update(users)
        .set({ passwordHash: input.passwordHash, updatedAt: sql`clock_timestamp()` })
        .where(eq(users.id, proof.userId))
        .returning({ id: users.id });
      if (updated.length !== 1) throw invalid();

      const revoked = await tx.delete(sessions)
        .where(eq(sessions.userId, proof.userId))
        .returning({ id: sessions.id });

      await tx.insert(auditEvents).values({
        id: input.resetAuditId,
        actorId: proof.userId,
        actorType: "user",
        action: "user.password_reset",
        targetId: proof.userId,
        targetType: "user",
        details: { revokedSessionCount: revoked.length, proofChallengeId: proof.id },
        createdAt: sql`clock_timestamp()`,
      });

      await tx.insert(notifications).values({
        id: input.notificationId,
        recipientId: proof.userId,
        title: "Password reset completed",
        message: "Your password was reset and all existing sessions were signed out.",
        link: "/auth/login",
        type: "security",
        category: "security",
        isRead: false,
        createdAt: sql`clock_timestamp()`,
      });

      return { revokedSessionCount: revoked.length };
    });
  }
}

export const accountPasswordResetRepository = new AccountPasswordResetRepository();
