import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { UnauthorizedError } from "@nexus/domain";
import { db } from "../client";
import { auditEvents, sessions, users } from "../schema";
import { accountAuthState, accountRecoveryBindings, authChallenges } from "../account-recovery-schema";
import { digestSessionToken } from "./sessions";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type ChallengePurpose = "email_verify" | "password_reset";
export type ChallengeIntent = { userId: string; auditId: string } & (
  | { purpose: "email_verify"; currentToken: string; expectedPasswordHash: string }
  | { purpose: "password_reset" }
);
type Intent = ChallengeIntent;
export type ConsumedProof = Readonly<{
  id: string; userId: string; purpose: ChallengePurpose; email: string;
  credentialVersion: number; bindingId: string | null;
}>;
type IssuedProof = Readonly<{
  id: string; token: string; userId: string; purpose: ChallengePurpose; email: string; expiresAt: Date;
}>;
const lifetimeMs = { email_verify: 24 * 60 * 60_000, password_reset: 30 * 60_000 } as const;
const invalid = () => new UnauthorizedError("Invalid or expired account confirmation");

export function digestAccountChallenge(purpose: ChallengePurpose, token: string): string {
  if (!Object.hasOwn(lifetimeMs, purpose) || typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)
    || Buffer.from(token, "base64url").toString("base64url") !== token) throw invalid();
  return createHash("sha256").update(`nexus:account-challenge:v1:${purpose}\0${token}`).digest("hex");
}

// Internal DB primitive, not exported from @nexus/db and not called by any HTTP
// handler. Callers must verify the current password before email_verify and
// perform the protected action INSIDE consume's callback using the supplied tx.
// No SMTP/network/side effects or detached promises inside transaction callbacks.
export class AccountChallengeRepository {
  async issue(input: Intent): Promise<{ id: string; token: string; expiresAt: Date }> {
    return this.issueAtomic(input, async (_tx, proof) => ({
      id: proof.id, token: proof.token, expiresAt: proof.expiresAt,
    }));
  }

  // Delivery must be persisted via this transaction, never after issue commits.
  async issueForDelivery<T>(input: Intent, persist: (tx: Tx, proof: IssuedProof) => Promise<T>): Promise<T> {
    return this.issueAtomic(input, persist);
  }

  private async issueAtomic<T>(input: Intent, persist: (tx: Tx, proof: IssuedProof) => Promise<T>): Promise<T> {
    const token = randomBytes(32).toString("base64url");
    const tokenDigest = digestAccountChallenge(input.purpose, token);
    return db.transaction(async (tx) => {
      const { user, version, sessionDigest, bindingId, sessionExpiresAt } = await this.lockContext(tx, input);
      const [clock] = await tx.execute(sql`select clock_timestamp()::text as now`);
      const createdAt = new Date(String(clock.now));
      const expiresAt = new Date(createdAt.getTime() + lifetimeMs[input.purpose]);
      await tx.update(authChallenges).set({ revokedAt: createdAt }).where(and(
        eq(authChallenges.userId, user.id), eq(authChallenges.purpose, input.purpose),
        isNull(authChallenges.consumedAt), isNull(authChallenges.revokedAt)
      ));
      await this.checkSessionExpiry(tx, sessionExpiresAt);
      const id = `ach_${randomUUID()}`;
      await tx.insert(authChallenges).values({
        id, userId: user.id, purpose: input.purpose, email: user.email,
        credentialVersion: version, tokenDigest, initiatingSessionDigest: sessionDigest,
        bindingId, createdAt, expiresAt,
      });
      await this.audit(tx, input, id, "auth.challenge_issued");
      const result = await persist(tx, Object.freeze({ id, token, expiresAt,
        userId: user.id, email: user.email, purpose: input.purpose }));
      // A queue-capacity lock can add a later wait: recheck time after it too.
      await this.checkSessionExpiry(tx, sessionExpiresAt);
      const [live] = await tx.select({ id: authChallenges.id }).from(authChallenges).where(and(
        eq(authChallenges.id, id), isNull(authChallenges.consumedAt), isNull(authChallenges.revokedAt),
        gt(authChallenges.expiresAt, sql`clock_timestamp()`)
      ));
      if (!live) throw invalid();
      // Sensitive proof data is internal only; queued callers return metadata.
      return result;
    }, { isolationLevel: "read committed" });
  }

  async consume<T>(input: Intent & { id: string; token: string },
    apply: (tx: Tx, proof: ConsumedProof) => Promise<T>): Promise<T> {
    const tokenDigest = digestAccountChallenge(input.purpose, input.token);
    return db.transaction(async (tx) => {
      const { user, version, sessionDigest, bindingId, sessionExpiresAt } = await this.lockContext(tx, input);
      const [challenge] = await tx.select().from(authChallenges).where(and(
        eq(authChallenges.id, input.id), eq(authChallenges.userId, user.id),
        eq(authChallenges.purpose, input.purpose), eq(authChallenges.tokenDigest, tokenDigest)
      )).for("update");
      if (!challenge || challenge.email !== user.email || challenge.credentialVersion !== version
        || challenge.bindingId !== bindingId || challenge.initiatingSessionDigest !== sessionDigest
        || challenge.consumedAt || challenge.revokedAt) throw invalid();
      await this.checkSessionExpiry(tx, sessionExpiresAt);
      // Use the database wall clock after lock waits (not transaction-start now()).
      // Claim only once; a failed callback/audit rolls this update back too.
      const claimed = await tx.update(authChallenges).set({ consumedAt: sql`clock_timestamp()` })
        .where(and(eq(authChallenges.id, challenge.id), isNull(authChallenges.consumedAt),
          isNull(authChallenges.revokedAt), gt(authChallenges.expiresAt, sql`clock_timestamp()`)))
        .returning({ id: authChallenges.id });
      if (claimed.length !== 1) throw invalid();
      const result = await apply(tx, Object.freeze({
        id: challenge.id, userId: user.id, purpose: challenge.purpose, email: user.email,
        credentialVersion: version, bindingId,
      }));
      await this.audit(tx, input, challenge.id, "auth.challenge_consumed");
      return result;
    });
  }

  private async lockContext(tx: Tx, input: Intent) {
    const [user] = await tx.select({ id: users.id, email: users.email, passwordHash: users.passwordHash,
      role: users.role, twoFactorEnabled: users.twoFactorEnabled })
      .from(users).where(eq(users.id, input.userId)).for("update");
    // Privileged/MFA enrollment remains an explicit rollout decision, not a bypass.
    if (!user?.passwordHash || user.twoFactorEnabled || ["admin", "moderator"].includes(user.role)) throw invalid();
    await tx.insert(accountAuthState).values({ userId: user.id }).onConflictDoNothing();
    const [state] = await tx.select().from(accountAuthState)
      .where(eq(accountAuthState.userId, user.id)).for("update");
    if (!state) throw invalid();
    let sessionDigest: string | null = null;
    let bindingId: string | null = null;
    let sessionExpiresAt: Date | null = null;
    if (input.purpose === "email_verify") {
      if (!input.currentToken || user.passwordHash !== input.expectedPasswordHash) throw invalid();
      sessionDigest = digestSessionToken(input.currentToken);
      const [current] = await tx.select({ id: sessions.id, expiresAt: sessions.expiresAt })
        .from(sessions).where(and(eq(sessions.userId, user.id), eq(sessions.token, sessionDigest)))
        .for("update");
      const [clock] = await tx.execute(sql`select clock_timestamp()::text as now`);
      if (!current || current.expiresAt <= new Date(String(clock.now))) throw invalid();
      sessionExpiresAt = current.expiresAt;
    } else if (input.purpose === "password_reset") {
      const [binding] = await tx.select().from(accountRecoveryBindings)
        .where(eq(accountRecoveryBindings.userId, user.id)).for("update");
      if (!binding || binding.verifiedEmail !== user.email || binding.proofVersion !== 1) throw invalid();
      // Legacy emailVerified/isVerified booleans are deliberately not consulted.
      const [proof] = await tx.select({ id: authChallenges.id }).from(authChallenges).where(and(
        eq(authChallenges.id, binding.proofChallengeId), eq(authChallenges.userId, user.id),
        eq(authChallenges.purpose, "email_verify"), eq(authChallenges.email, user.email),
        sql`${authChallenges.consumedAt} is not null`, isNull(authChallenges.revokedAt)
      ));
      if (!proof) throw invalid();
      bindingId = binding.id;
    } else throw invalid();
    return { user, version: state.credentialVersion, sessionDigest, bindingId, sessionExpiresAt };
  }

  private async checkSessionExpiry(tx: Tx, expiresAt: Date | null) {
    if (expiresAt === null) return;
    const [clock] = await tx.execute(sql`select clock_timestamp()::text as now`);
    if (expiresAt <= new Date(String(clock.now))) throw invalid();
  }

  private async audit(tx: Tx, input: Intent, challengeId: string, action: string) {
    await tx.insert(auditEvents).values({
      id: input.auditId, actorId: input.userId, actorType: "user", action,
      targetId: challengeId, targetType: "auth_challenge", details: { purpose: input.purpose },
      createdAt: sql`clock_timestamp()`,
    });
  }
}

export const accountChallengeRepository = new AccountChallengeRepository();
