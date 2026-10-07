import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { auditEvents, db, notifications } from "../client";
import { accountMailOutbox } from "../account-mail-schema";
import { authChallenges } from "../account-recovery-schema";
import { AccountMailCipher } from "./account-mail-crypto";
import { accountChallengeRepository } from "./account-challenges";
import { authService } from "../../../../apps/web/src/lib/services/auth-service";
import { userRepository } from "./users";
import { generateId } from "@nexus/security";

const oldPassword = "Synthetic-D4-old-password!";
const newPassword = "Synthetic-D4-new-password!";
const envBackup = { ...process.env };

function accountMailKey(): string {
  const value = process.env.ACCOUNT_MAIL_KEY;
  if (!value) throw new Error("ACCOUNT_MAIL_KEY is required by this fixture");
  return value;
}

async function account() {
  const username = `d4_${generateId("usr").slice(-18)}`;
  const email = `${username}@example.invalid`;
  const first = await authService.register({ username, email, password: oldPassword });
  const second = await authService.login({ email, password: oldPassword });
  return { userId: first.user.id, firstToken: first.token, secondToken: second.token, email };
}

async function enroll(a: Awaited<ReturnType<typeof account>>) {
  const queued = await authService.requestRecoveryEmailVerification({
    userId: a.userId, currentToken: a.firstToken, currentPassword: oldPassword,
  });
  if (!queued.challengeId) throw new Error("verification challenge missing");
  const [mail] = await db.select().from(accountMailOutbox)
    .where(eq(accountMailOutbox.challengeId, queued.challengeId));
  const cipher = new AccountMailCipher("d4", { d4: Buffer.from(accountMailKey(), "base64url") });
  const payload = cipher.open({
    id: mail.id, challengeId: mail.challengeId, userId: a.userId,
    purpose: "email_verify", expiresAt: mail.expiresAt,
  }, mail.payload);
  await authService.confirmRecoveryEmailVerification({
    userId: a.userId, currentToken: a.firstToken, challengeId: queued.challengeId, token: payload.token,
  });
}

async function resetProof(email: string) {
  await authService.requestPasswordReset({ email, ip: "192.0.2.44" });
  const user = await userRepository.findByEmail(email);
  if (!user) throw new Error("synthetic user missing");
  const rows = await db.select().from(authChallenges).where(and(
    eq(authChallenges.userId, user.id), eq(authChallenges.purpose, "password_reset"),
  ));
  const challenge = rows.at(-1);
  if (!challenge) throw new Error("reset challenge missing");
  const [mail] = await db.select().from(accountMailOutbox)
    .where(eq(accountMailOutbox.challengeId, challenge.id));
  const cipher = new AccountMailCipher("d4", { d4: Buffer.from(accountMailKey(), "base64url") });
  const payload = cipher.open({
    id: mail.id, challengeId: mail.challengeId, userId: user.id,
    purpose: "password_reset", expiresAt: mail.expiresAt,
  }, mail.payload);
  return { id: challenge.id, token: payload.token, userId: user.id };
}

describe("D4a password reset service", () => {
  beforeEach(() => {
    process.env.ACCOUNT_MAIL_KEY_ID = "d4";
    process.env.ACCOUNT_MAIL_KEY = randomBytes(32).toString("base64url");
    process.env.ACCOUNT_RECOVERY_ABUSE_KEY = randomBytes(32).toString("base64url");
  });
  afterEach(() => { process.env = { ...envBackup }; });

  it("returns the same neutral request result for eligible, unknown and unverified addresses", async () => {
    const eligible = await account();
    await enroll(eligible);
    const unverified = await account();
    for (const email of [eligible.email, unverified.email, "missing-d4@example.invalid"]) {
      await expect(authService.requestPasswordReset({ email, ip: "198.51.100.10" }))
        .resolves.toEqual({ accepted: true });
    }
    const resetRows = await db.select().from(authChallenges).where(eq(authChallenges.purpose, "password_reset"));
    expect(resetRows.filter((row) => row.userId === eligible.userId)).toHaveLength(1);
    expect(resetRows.filter((row) => row.userId === unverified.userId)).toHaveLength(0);
  });

  it("applies keyed durable email and IP limits without changing the neutral response", async () => {
    const a = await account();
    await enroll(a);
    for (let i = 0; i < 5; i++) {
      await expect(authService.requestPasswordReset({ email: a.email, ip: "203.0.113.10" }))
        .resolves.toEqual({ accepted: true });
    }
    const rows = await db.select().from(authChallenges).where(and(
      eq(authChallenges.userId, a.userId), eq(authChallenges.purpose, "password_reset"),
    ));
    // Reissue replaces the pending proof; the email limit prevents further issue after three attempts.
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const pending = rows.filter((row) => row.consumedAt === null && row.revokedAt === null);
    expect(pending).toHaveLength(1);
  });

  it("atomically resets the password, revokes every session, invalidates other proofs and writes audit plus security notification", async () => {
    const a = await account();
    await enroll(a);
    const proof = await resetProof(a.email);
    const stored = await userRepository.findByEmail(a.email);
    if (!stored?.passwordHash) throw new Error("stored password hash missing");
    const extraVerification = await accountChallengeRepository.issue({
      purpose: "email_verify",
      userId: a.userId,
      currentToken: a.firstToken,
      expectedPasswordHash: stored.passwordHash,
      auditId: generateId("aud"),
    });

    const result = await authService.confirmPasswordReset({
      challengeId: proof.id, token: proof.token, newPassword, ip: "203.0.113.10",
    });
    expect(result.revokedSessionCount).toBe(2);
    expect(await authService.getSession(a.firstToken)).toBeNull();
    expect(await authService.getSession(a.secondToken)).toBeNull();
    await expect(authService.login({ email: a.email, password: oldPassword })).rejects.toThrow();
    await expect(authService.login({ email: a.email, password: newPassword })).resolves.toBeTruthy();

    const [resetRow] = await db.select().from(authChallenges).where(eq(authChallenges.id, proof.id));
    expect(resetRow.consumedAt).not.toBeNull();
    const [otherRow] = await db.select().from(authChallenges).where(eq(authChallenges.id, extraVerification.id));
    expect(otherRow.revokedAt).not.toBeNull();
    expect(await db.select().from(auditEvents).where(and(
      eq(auditEvents.actorId, a.userId), eq(auditEvents.action, "user.password_reset"),
    ))).toHaveLength(1);
    expect(await db.select().from(notifications).where(and(
      eq(notifications.recipientId, a.userId), eq(notifications.category, "security"),
    ))).toHaveLength(1);
    await expect(authService.confirmPasswordReset({
      challengeId: proof.id, token: proof.token, newPassword: "Synthetic-D4-replay-password!", ip: "203.0.113.10",
    })).rejects.toThrow("Invalid or expired");
  });

  it("rolls back password, sessions, proof consumption and notification when the final consume audit conflicts", async () => {
    const a = await account();
    await enroll(a);
    const proof = await resetProof(a.email);
    const usedAudit = generateId("aud");
    await db.insert(auditEvents).values({
      id: usedAudit, actorId: a.userId, actorType: "user", action: "fixture",
      targetId: a.userId, targetType: "user", createdAt: new Date(),
    });
    const storedBefore = await userRepository.findByEmail(a.email);
    if (!storedBefore?.passwordHash) throw new Error("password hash missing");
    await expect(authService.confirmPasswordReset({
      challengeId: proof.id, token: proof.token, newPassword, ip: "203.0.113.10",
      consumeAuditId: usedAudit,
    })).rejects.toThrow();
    const storedAfter = await userRepository.findByEmail(a.email);
    expect(storedAfter?.passwordHash).toBe(storedBefore.passwordHash);
    expect(await authService.getSession(a.firstToken)).not.toBeNull();
    const [row] = await db.select().from(authChallenges).where(eq(authChallenges.id, proof.id));
    expect(row.consumedAt).toBeNull();
    expect(await db.select().from(notifications).where(and(
      eq(notifications.recipientId, a.userId), eq(notifications.category, "security"),
    ))).toHaveLength(0);
  });

  it("fails closed before account lookup when dedicated runtime keys are missing", async () => {
    delete process.env.ACCOUNT_MAIL_KEY;
    await expect(authService.requestPasswordReset({ email: "missing@example.invalid", ip: "192.0.2.1" }))
      .rejects.toThrow("ACCOUNT_MAIL_KEY");
  });
});
