import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { auditEvents, db, users } from "../client";
import { accountMailOutbox } from "../account-mail-schema";
import { accountRecoveryBindings, authChallenges } from "../account-recovery-schema";
import { accountEmailEnrollmentRepository } from "./account-email-enrollment";
import { AccountMailCipher } from "./account-mail-crypto";
import { authService } from "../../../../apps/web/src/lib/services/auth-service";
import { userRepository } from "./users";
import { generateId } from "@nexus/security";

const password = "Synthetic-D3-current-password!";
const envBackup = { ...process.env };

async function account() {
  const username = `d3_${generateId("usr").slice(-18)}`;
  const email = `${username}@example.invalid`;
  const registered = await authService.register({ username, email, password });
  const stored = await userRepository.findByEmail(email);
  if (!stored?.passwordHash) throw new Error("Missing synthetic password hash");
  return { userId: registered.user.id, token: registered.token, email, hash: stored.passwordHash };
}

describe("D3a verified recovery email enrollment", () => {
  beforeEach(() => {
    process.env.ACCOUNT_MAIL_KEY_ID = "d3";
    process.env.ACCOUNT_MAIL_KEY = randomBytes(32).toString("base64url");
    process.env.ACCOUNT_RECOVERY_ABUSE_KEY = randomBytes(32).toString("base64url");
  });
  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("queues only encrypted verification metadata and creates no binding before confirmation", async () => {
    const a = await account();
    const result = await authService.requestRecoveryEmailVerification({
      userId: a.userId, currentToken: a.token, currentPassword: password,
    });
    expect(result.accepted).toBe(true);
    if (!result.challengeId) throw new Error("Accepted verification must expose its internal challenge ID");
    const challengeId = result.challengeId;
    const mail = await db.select().from(accountMailOutbox);
    const row = mail.find((item) => item.challengeId === challengeId);
    expect(row).toBeTruthy();
    expect(JSON.stringify(row)).not.toContain(a.email);
    expect(await db.select().from(accountRecoveryBindings).where(eq(accountRecoveryBindings.userId, a.userId))).toHaveLength(0);
  });

  it("requires the current password and consumes the durable limit before proof issuance", async () => {
    const a = await account();
    await expect(authService.requestRecoveryEmailVerification({
      userId: a.userId, currentToken: a.token, currentPassword: "wrong-password",
    })).rejects.toThrow("Current password is incorrect");
    const proofs = await db.select().from(authChallenges).where(eq(authChallenges.userId, a.userId));
    expect(proofs).toHaveLength(0);
  });

  it("atomically creates a provenance-backed binding on one valid confirmation and rejects replay", async () => {
    const a = await account();
    const cipher = new AccountMailCipher("d3", { d3: Buffer.from(process.env.ACCOUNT_MAIL_KEY!, "base64url") });
    const queued = await authService.requestRecoveryEmailVerification({
      userId: a.userId, currentToken: a.token, currentPassword: password,
    });
    if (!queued.challengeId) throw new Error("Accepted verification must expose its internal challenge ID");
    const challengeId = queued.challengeId;
    const [mail] = await db.select().from(accountMailOutbox).where(eq(accountMailOutbox.challengeId, challengeId));
    expect(mail).toBeTruthy();
    const payload = cipher.open({
      id: mail.id, challengeId: mail.challengeId, userId: a.userId,
      purpose: "email_verify", expiresAt: mail.expiresAt,
    }, mail.payload);
    const confirmed = await authService.confirmRecoveryEmailVerification({
      userId: a.userId, currentToken: a.token,
      challengeId, token: payload.token,
    });
    expect(confirmed.email).toBe(a.email);
    const status = await authService.getRecoveryEmailStatus(a.userId);
    expect(status?.verified).toBe(true);
    const [binding] = await db.select().from(accountRecoveryBindings).where(eq(accountRecoveryBindings.userId, a.userId));
    expect(binding.verifiedEmail).toBe(a.email);
    expect(binding.proofChallengeId).toBe(challengeId);
    const [proof] = await db.select().from(authChallenges).where(eq(authChallenges.id, challengeId));
    expect(proof.consumedAt).not.toBeNull();
    expect(await db.select().from(accountMailOutbox).where(eq(accountMailOutbox.challengeId, challengeId))).toHaveLength(0);
    const events = await db.select().from(auditEvents).where(and(
      eq(auditEvents.actorId, a.userId), eq(auditEvents.action, "auth.recovery_email_verified"),
    ));
    expect(events).toHaveLength(1);
    await expect(authService.confirmRecoveryEmailVerification({
      userId: a.userId, currentToken: a.token,
      challengeId, token: payload.token,
    })).rejects.toThrow("Invalid or expired account confirmation");
  });

  it("does not trust legacy verification flags and blocks privileged or MFA enrollment", async () => {
    const a = await account();
    await userRepository.update(a.userId, { emailVerified: true, isVerified: true });
    expect((await authService.getRecoveryEmailStatus(a.userId))?.verified).toBe(false);
    for (const updates of [
      { role: "admin" as const },
      { role: "moderator" as const },
      { role: "user" as const, twoFactorEnabled: true },
    ]) {
      await userRepository.update(a.userId, updates);
      await expect(authService.requestRecoveryEmailVerification({
        userId: a.userId, currentToken: a.token, currentPassword: password,
      })).rejects.toThrow("unavailable");
    }
  });

  it("fails closed when producer or durable-limit keys are unavailable", async () => {
    const a = await account();
    delete process.env.ACCOUNT_RECOVERY_ABUSE_KEY;
    await expect(authService.requestRecoveryEmailVerification({
      userId: a.userId, currentToken: a.token, currentPassword: password,
    })).rejects.toThrow("ACCOUNT_RECOVERY_ABUSE_KEY");
    process.env.ACCOUNT_RECOVERY_ABUSE_KEY = randomBytes(32).toString("base64url");
    delete process.env.ACCOUNT_MAIL_KEY;
    await expect(authService.requestRecoveryEmailVerification({
      userId: a.userId, currentToken: a.token, currentPassword: password,
    })).rejects.toThrow("ACCOUNT_MAIL_KEY");
  });
});
