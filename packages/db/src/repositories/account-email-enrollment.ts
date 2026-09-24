import { randomUUID } from "node:crypto";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "../client";
import { auditEvents, users } from "../schema";
import { accountRecoveryBindings, authChallenges } from "../account-recovery-schema";
import { accountChallengeRepository } from "./account-challenges";
import { accountMailOutboxRepository } from "./account-mail-outbox";
import type { AccountMailCipher } from "./account-mail-crypto";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class AccountEmailEnrollmentRepository {
  async status(userId: string): Promise<{
    email: string; verified: boolean; verifiedAt: Date | null; eligible: boolean;
  } | null> {
    const [user] = await db.select({
      id: users.id, email: users.email, passwordHash: users.passwordHash,
      role: users.role, twoFactorEnabled: users.twoFactorEnabled,
    }).from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return null;

    const [binding] = await db.select().from(accountRecoveryBindings)
      .where(eq(accountRecoveryBindings.userId, userId)).limit(1);
    let verified = false;
    if (binding && binding.verifiedEmail === user.email && binding.proofVersion === 1) {
      const [proof] = await db.select({ id: authChallenges.id }).from(authChallenges).where(and(
        eq(authChallenges.id, binding.proofChallengeId),
        eq(authChallenges.userId, userId),
        eq(authChallenges.purpose, "email_verify"),
        eq(authChallenges.email, user.email),
        isNotNull(authChallenges.consumedAt),
        isNull(authChallenges.revokedAt),
      )).limit(1);
      verified = Boolean(proof);
    }
    return {
      email: user.email,
      verified,
      verifiedAt: verified ? binding!.verifiedAt : null,
      eligible: Boolean(user.passwordHash) && !user.twoFactorEnabled
        && !["admin", "moderator"].includes(user.role),
    };
  }

  async request(input: {
    userId: string; currentToken: string; expectedPasswordHash: string;
    auditId: string; cipher: AccountMailCipher;
  }): Promise<{ challengeId: string; expiresAt: Date }> {
    const queued = await accountMailOutboxRepository.enqueue({
      purpose: "email_verify", userId: input.userId, currentToken: input.currentToken,
      expectedPasswordHash: input.expectedPasswordHash, auditId: input.auditId,
    }, input.cipher);
    return { challengeId: queued.challengeId, expiresAt: queued.expiresAt };
  }

  async confirm(input: {
    userId: string; currentToken: string; expectedPasswordHash: string;
    challengeId: string; token: string; consumeAuditId: string; bindingAuditId: string;
  }): Promise<{ email: string; verifiedAt: Date }> {
    return accountChallengeRepository.consume({
      purpose: "email_verify", userId: input.userId, currentToken: input.currentToken,
      expectedPasswordHash: input.expectedPasswordHash, auditId: input.consumeAuditId,
      id: input.challengeId, token: input.token,
    }, async (tx: Tx, proof) => {
      if (proof.purpose !== "email_verify") throw new Error("Invalid email verification purpose");
      const bindingId = `rcb_${randomUUID()}`;
      const [clock] = await tx.execute(sql`select clock_timestamp()::text as now`);
      const verifiedAt = new Date(String(clock.now));
      await tx.insert(accountRecoveryBindings).values({
        userId: proof.userId, id: bindingId, verifiedEmail: proof.email, verifiedAt,
        proofVersion: 1, proofChallengeId: proof.id,
      }).onConflictDoUpdate({
        target: accountRecoveryBindings.userId,
        set: { id: bindingId, verifiedEmail: proof.email, verifiedAt,
          proofVersion: 1, proofChallengeId: proof.id },
      });
      await tx.insert(auditEvents).values({
        id: input.bindingAuditId, actorId: proof.userId, actorType: "user",
        action: "auth.recovery_email_verified", targetId: proof.userId, targetType: "user",
        details: { proofChallengeId: proof.id }, createdAt: sql`clock_timestamp()`,
      });
      return { email: proof.email, verifiedAt };
    });
  }
}
export const accountEmailEnrollmentRepository = new AccountEmailEnrollmentRepository();
