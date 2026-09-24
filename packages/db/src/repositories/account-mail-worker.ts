import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, gt, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { db } from "../client";
import { auditEvents, sessions, users } from "../schema";
import { accountAuthState, accountRecoveryBindings, authChallenges } from "../account-recovery-schema";
import { accountMailOutbox, accountMailQueueGate } from "../account-mail-schema";
import { AccountMailCipher, AccountMailKeyUnavailableError } from "./account-mail-crypto";
import type { MailContext, MailPayload } from "./account-mail-crypto";
import { digestAccountChallenge } from "./account-challenges";
import type { AccountMailTransportStage } from "./account-mail-smtp";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type MailLease = Readonly<{ id: string; token: string; attempt: number; expiresAt: Date }>;
export type PreparedAccountMail = Readonly<MailContext & MailPayload & { sendBefore: Date }>;
export const ACCOUNT_MAIL_MAX_ATTEMPTS = 5;
const leaseMs = 60_000;
const backoffMs = [5_000, 30_000, 120_000, 300_000] as const;
const providerBackoffMs = [30_000, 60_000, 120_000, 300_000, 600_000] as const;
const providerFailureRetentionMs = 600_000;

function providerRetryDelayMs(streak: number): number {
  return providerBackoffMs[Math.min(Math.max(streak - 1, 0), providerBackoffMs.length - 1)];
}

function retryDelayMs(id: string, attempt: number): number {
  const base = backoffMs[Math.min(Math.max(attempt - 1, 0), backoffMs.length - 1)];
  const digest = createHash("sha256")
    .update(`nexus:account-mail-backoff:v1\0${id}\0${attempt}`)
    .digest();
  // Stable 80–120% spread prevents a provider outage from making every row
  // eligible on the same second, while keeping the schedule deterministic.
  const fraction = digest.readUInt32BE(0) / 0xffffffff;
  const factor = 0.8 + fraction * 0.4;
  return Math.max(1_000, Math.round(base * factor));
}
const availableLease = () => or(isNull(accountMailOutbox.leaseExpiresAt),
  lte(accountMailOutbox.leaseExpiresAt, sql`clock_timestamp()`));
function checkId(id: string) {
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(id)) throw new Error("Invalid account mail identifier");
}
function leaseDigest(lease: MailLease) {
  checkId(lease.id);
  if (!Number.isInteger(lease.attempt) || lease.attempt < 1 || lease.attempt > ACCOUNT_MAIL_MAX_ATTEMPTS
    || typeof lease.token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(lease.token)
    || Buffer.from(lease.token, "base64url").toString("base64url") !== lease.token) {
    throw new Error("Invalid account mail lease");
  }
  return createHash("sha256").update(`nexus:account-mail-lease:v1\0${lease.token}`).digest("hex");
}
function checkLimit(limit: number) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("Invalid account mail batch limit");
}
async function clock(tx: Tx) {
  const [row] = await tx.execute(sql`select clock_timestamp()::text as now`);
  return new Date(String(row.now));
}
async function transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`set local lock_timeout = '5s'`);
    await tx.execute(sql`set local statement_timeout = '10s'`);
    return work(tx);
  }, { isolationLevel: "read committed" });
}

// Internal DB delivery protocol only. Not exported from @nexus/db, scheduled, or
// connected to SMTP/HTTP. Each call commits before any future network operation.
// Lease tokens and prepared plaintext must never be logged or sent to a client.
export type AccountMailProviderGateStatus = Readonly<{
  blocked: boolean;
  blockedUntil: Date | null;
  failureStreak: number;
}>;

export class AccountMailWorkerRepository {
  async providerGateStatus(): Promise<AccountMailProviderGateStatus> {
    const [gate] = await db.select({
      blocked: sql<boolean>`${accountMailQueueGate.providerBlockedUntil} is not null
        and ${accountMailQueueGate.providerBlockedUntil} > clock_timestamp()`,
      blockedUntil: accountMailQueueGate.providerBlockedUntil,
      failureStreak: accountMailQueueGate.providerFailureStreak,
    }).from(accountMailQueueGate).where(eq(accountMailQueueGate.singleton, true)).limit(1);
    if (!gate) throw new Error("Account mail queue gate is unavailable");
    return Object.freeze({
      blocked: gate.blocked,
      blockedUntil: gate.blockedUntil,
      failureStreak: gate.failureStreak,
    });
  }

  async candidates(limit = 20): Promise<string[]> {
    checkLimit(limit);
    const [gate] = await db.select({
      blocked: sql<boolean>`${accountMailQueueGate.providerBlockedUntil} is not null
        and ${accountMailQueueGate.providerBlockedUntil} > clock_timestamp()`,
    }).from(accountMailQueueGate).where(eq(accountMailQueueGate.singleton, true)).limit(1);
    if (!gate) throw new Error("Account mail queue gate is unavailable");
    if (gate.blocked) return [];

    const rows = await db.select({ id: accountMailOutbox.id }).from(accountMailOutbox)
      .where(and(lte(accountMailOutbox.availableAt, sql`clock_timestamp()`), availableLease(),
        gt(accountMailOutbox.expiresAt, sql`clock_timestamp()`),
        lt(accountMailOutbox.attempts, ACCOUNT_MAIL_MAX_ATTEMPTS)))
      .orderBy(accountMailOutbox.availableAt, accountMailOutbox.id).limit(limit);
    // A hint, not a reservation: another worker may claim before this caller.
    return rows.map((row) => row.id);
  }

  async claim(id: string): Promise<MailLease | null> {
    checkId(id);
    return transaction(async (tx) => {
      const item = await this.lockLiveMail(tx, id);
      if (!item) return null;
      const { mail, now, validUntil } = item;
      const [providerGate] = await tx.select({
        blocked: sql<boolean>`${accountMailQueueGate.providerBlockedUntil} is not null
          and ${accountMailQueueGate.providerBlockedUntil} > clock_timestamp()`,
      }).from(accountMailQueueGate).where(eq(accountMailQueueGate.singleton, true)).limit(1);
      if (!providerGate) throw new Error("Account mail queue gate is unavailable");
      if (providerGate.blocked) return null;
      if (mail.leaseExpiresAt && mail.leaseExpiresAt > now) return null;
      if (mail.attempts >= ACCOUNT_MAIL_MAX_ATTEMPTS) {
        await tx.delete(accountMailOutbox).where(eq(accountMailOutbox.id, id));
        return null;
      }
      if (mail.availableAt > now) return null;
      const token = randomBytes(32).toString("base64url");
      const lease: MailLease = { id, token, attempt: mail.attempts + 1,
        expiresAt: new Date(Math.min(now.getTime() + leaseMs, validUntil.getTime())) };
      const changed = await tx.update(accountMailOutbox).set({
        attempts: lease.attempt, leaseTokenDigest: leaseDigest(lease), leaseExpiresAt: lease.expiresAt,
      }).where(and(eq(accountMailOutbox.id, id), availableLease(),
        lte(accountMailOutbox.availableAt, sql`clock_timestamp()`),
        gt(accountMailOutbox.expiresAt, sql`clock_timestamp()`)))
        .returning({ id: accountMailOutbox.id });
      return changed.length ? Object.freeze(lease) : null;
    });
  }

  async prepare(lease: MailLease, cipher: AccountMailCipher): Promise<PreparedAccountMail | null> {
    const digest = leaseDigest(lease);
    return transaction(async (tx) => {
      const item = await this.lockLiveMail(tx, lease.id);
      if (!item || !this.owns(item, lease, digest)) return null;
      const context: MailContext = { id: item.mail.id, challengeId: item.proof.id,
        userId: item.proof.userId, purpose: item.proof.purpose, expiresAt: item.mail.expiresAt };
      let decoded: MailPayload;
      try {
        decoded = cipher.open(context, item.mail.payload);
        if (decoded.recipient !== item.proof.email
          || digestAccountChallenge(item.proof.purpose, decoded.token) !== item.proof.tokenDigest) {
          throw new Error("Payload does not match proof");
        }
      } catch (error) {
        if (error instanceof AccountMailKeyUnavailableError) throw error;
        // No raw crypto error, SQL, recipient, ciphertext or token in the error.
        // Keep the lease for explicit retry/discard or bounded expiry recovery.
        throw new Error("Account mail payload is unavailable");
      }
      const sendBefore = new Date(Math.min(item.mail.leaseExpiresAt!.getTime(), item.validUntil.getTime()));
      if (sendBefore <= await clock(tx)) return null;
      return Object.freeze({ ...context, ...decoded, sendBefore });
    });
  }

  async releaseForMissingKey(lease: MailLease): Promise<boolean> {
    const digest = leaseDigest(lease);
    return transaction(async (tx) => {
      const item = await this.lockLiveMail(tx, lease.id);
      if (!item || !this.owns(item, lease, digest)) return false;

      const retryAt = new Date(Math.min(
        item.now.getTime() + 30_000,
        item.validUntil.getTime(),
      ));
      const changed = await tx.update(accountMailOutbox).set({
        attempts: Math.max(0, lease.attempt - 1),
        availableAt: retryAt,
        leaseTokenDigest: null,
        leaseExpiresAt: null,
      }).where(and(
        eq(accountMailOutbox.id, lease.id),
        eq(accountMailOutbox.leaseTokenDigest, digest),
        eq(accountMailOutbox.attempts, lease.attempt),
        gt(accountMailOutbox.leaseExpiresAt, sql`clock_timestamp()`),
      )).returning({ id: accountMailOutbox.id });
      return changed.length === 1;
    });
  }

  async deferProviderFailure(
    lease: MailLease,
    transport: Readonly<{ smtpCode?: number; stage: AccountMailTransportStage }>,
    auditId = `aud_${randomUUID()}`,
  ): Promise<boolean> {
    const digest = leaseDigest(lease);
    checkId(auditId);
    if (!["connect", "greeting", "ehlo", "starttls", "auth", "mail_from"].includes(transport.stage)) {
      throw new Error("Invalid provider-wide SMTP stage");
    }
    if (transport.smtpCode !== undefined
      && (!Number.isInteger(transport.smtpCode) || transport.smtpCode < 200 || transport.smtpCode > 599)) {
      throw new Error("Invalid SMTP transport code");
    }
    return transaction(async (tx) => {
      const item = await this.lockLiveMail(tx, lease.id);
      if (!item || !this.owns(item, lease, digest)) return false;

      const [gate] = await tx.select().from(accountMailQueueGate)
        .where(eq(accountMailQueueGate.singleton, true)).for("update");
      if (!gate) throw new Error("Account mail queue gate is unavailable");
      // Re-read the DB clock after waiting on the shared gate lock. Using the
      // earlier mail-lock timestamp would shorten the cooldown under contention.
      const providerNow = await clock(tx);
      const previousFailureStreak = gate.providerBlockedUntil
        && gate.providerBlockedUntil.getTime() + providerFailureRetentionMs > providerNow.getTime()
        ? gate.providerFailureStreak
        : 0;
      const providerFailureStreak = Math.min(previousFailureStreak + 1, 10);
      const providerBlockedUntil = new Date(
        providerNow.getTime() + providerRetryDelayMs(providerFailureStreak),
      );
      const retryAt = new Date(Math.min(
        providerBlockedUntil.getTime(),
        item.validUntil.getTime(),
      ));
      const changed = await tx.update(accountMailOutbox).set({
        attempts: Math.max(0, lease.attempt - 1),
        availableAt: retryAt,
        leaseTokenDigest: null,
        leaseExpiresAt: null,
      }).where(and(
        eq(accountMailOutbox.id, lease.id),
        eq(accountMailOutbox.leaseTokenDigest, digest),
        eq(accountMailOutbox.attempts, lease.attempt),
        gt(accountMailOutbox.leaseExpiresAt, sql`clock_timestamp()`),
      )).returning({ id: accountMailOutbox.id });
      if (changed.length !== 1) return false;

      await tx.update(accountMailQueueGate).set({
        providerBlockedUntil,
        providerFailureStreak,
      }).where(eq(accountMailQueueGate.singleton, true));

      await tx.insert(auditEvents).values({
        id: auditId,
        actorId: "system:account-mail-worker",
        actorType: "system",
        action: "auth.mail_provider_deferred",
        targetId: lease.id,
        targetType: "account_mail",
        details: {
          purpose: item.proof.purpose,
          stage: transport.stage,
          ...(transport.smtpCode !== undefined ? { smtpCode: transport.smtpCode } : {}),
        },
        createdAt: sql`clock_timestamp()`,
      });
      return true;
    });
  }

  async settle(
    lease: MailLease,
    outcome: "accepted" | "retry" | "discard",
    auditId = `aud_${randomUUID()}`,
    transport?: Readonly<{
      smtpCode?: number;
      uncertain?: boolean;
      stage?: AccountMailTransportStage;
    }>,
  ): Promise<boolean> {
    const digest = leaseDigest(lease);
    checkId(auditId);
    if (!["accepted", "retry", "discard"].includes(outcome)) throw new Error("Invalid account mail outcome");
    if (transport?.smtpCode !== undefined
      && (!Number.isInteger(transport.smtpCode) || transport.smtpCode < 200 || transport.smtpCode > 599)) {
      throw new Error("Invalid SMTP transport code");
    }
    if (transport?.uncertain !== undefined && typeof transport.uncertain !== "boolean") {
      throw new Error("Invalid SMTP uncertainty flag");
    }
    if (transport?.stage !== undefined
      && !["connect", "greeting", "ehlo", "starttls", "auth", "mail_from", "rcpt_to", "data", "final_reply"]
        .includes(transport.stage)) {
      throw new Error("Invalid SMTP transport stage");
    }
    return transaction(async (tx) => {
      const item = await this.lockLiveMail(tx, lease.id);
      // Settlement may arrive just after the nominal lease deadline. Accept it
      // only while the same token/attempt still owns the row. If another worker
      // has already reclaimed the expired lease, the token digest no longer
      // matches and this stale result loses safely.
      if (!item || !this.matchesLease(item, lease, digest)) return false;
      const retryAt = new Date(item.now.getTime() + retryDelayMs(item.mail.id, item.mail.attempts));
      const retry = outcome === "retry" && item.mail.attempts < ACCOUNT_MAIL_MAX_ATTEMPTS
        && retryAt < item.validUntil;
      const owned = and(
        eq(accountMailOutbox.id, lease.id),
        eq(accountMailOutbox.leaseTokenDigest, digest),
        eq(accountMailOutbox.attempts, lease.attempt),
      );
      const changed = retry
        ? await tx.update(accountMailOutbox).set({ availableAt: retryAt,
            leaseTokenDigest: null, leaseExpiresAt: null }).where(owned).returning({ id: accountMailOutbox.id })
        : await tx.delete(accountMailOutbox).where(owned).returning({ id: accountMailOutbox.id });
      if (!changed.length) return false;
      if (transport?.stage !== undefined) {
        const [gate] = await tx.select().from(accountMailQueueGate)
          .where(eq(accountMailQueueGate.singleton, true)).for("update");
        if (!gate) throw new Error("Account mail queue gate is unavailable");
        if (gate.providerBlockedUntil !== null || gate.providerFailureStreak !== 0) {
          await tx.update(accountMailQueueGate).set({
            providerBlockedUntil: null,
            providerFailureStreak: 0,
          }).where(eq(accountMailQueueGate.singleton, true));
        }
      }
      await tx.insert(auditEvents).values({
        id: auditId, actorId: "system:account-mail-worker", actorType: "system", action: outcome === "accepted"
          ? "auth.mail_transport_accepted" : retry ? "auth.mail_retry_scheduled" : "auth.mail_discarded",
        targetId: lease.id, targetType: "account_mail",
        details: {
          attempt: item.mail.attempts,
          purpose: item.proof.purpose,
          ...(transport?.smtpCode !== undefined ? { smtpCode: transport.smtpCode } : {}),
          ...(transport?.uncertain === true ? { uncertain: true } : {}),
          ...(transport?.stage !== undefined ? { stage: transport.stage } : {}),
        },
        createdAt: sql`clock_timestamp()`,
      });
      // "accepted" is the trusted transport caller's report, NOT inbox delivery.
      // A lost response after commit remains uncertain; do not invent success.
      return true;
    });
  }

  async discardUnavailable(limit = 100): Promise<number> {
    checkLimit(limit);
    return transaction(async (tx) => {
      // Terminal cleanup needs only outbox locks and never acquires parent locks.
      // It must still leave a non-sensitive audit trail when a crashed worker
      // never reached explicit settle on the final attempt.
      const rows = await tx.select({
        id: accountMailOutbox.id,
        attempts: accountMailOutbox.attempts,
        expiresAt: accountMailOutbox.expiresAt,
      }).from(accountMailOutbox).where(or(
        lte(accountMailOutbox.expiresAt, sql`clock_timestamp()`),
        and(eq(accountMailOutbox.attempts, ACCOUNT_MAIL_MAX_ATTEMPTS), availableLease())
      )).orderBy(accountMailOutbox.expiresAt, accountMailOutbox.id).limit(limit)
        .for("update", { skipLocked: true });
      if (!rows.length) return 0;

      // Evaluate terminal reason after every selected row lock is held. A DB
      // wait must not leave us classifying expiry against a stale timestamp.
      const now = await clock(tx);
      const removed = await tx.delete(accountMailOutbox)
        .where(inArray(accountMailOutbox.id, rows.map((row) => row.id)))
        .returning({ id: accountMailOutbox.id });
      if (!removed.length) return 0;

      const removedIds = new Set(removed.map((row) => row.id));
      const terminal = rows.filter((row) => removedIds.has(row.id));
      await tx.insert(auditEvents).values(terminal.map((row) => {
        const expired = row.expiresAt <= now;
        return {
          id: `aud_${randomUUID()}`,
          actorId: "system:account-mail-worker",
          actorType: "system" as const,
          action: expired ? "auth.mail_expired" : "auth.mail_attempts_exhausted",
          targetId: row.id,
          targetType: "account_mail",
          details: {
            attempts: row.attempts,
            terminalReason: expired ? "expired" : "attempts_exhausted",
          },
          createdAt: sql`clock_timestamp()`,
        };
      }));
      return removed.length;
    });
  }

  private matchesLease(item: NonNullable<Awaited<ReturnType<AccountMailWorkerRepository["lockLiveMail"]>>>,
    lease: MailLease, digest: string): boolean {
    return item.mail.leaseTokenDigest === digest
      && item.mail.attempts === lease.attempt
      && item.mail.leaseExpiresAt !== null;
  }

  private owns(item: NonNullable<Awaited<ReturnType<AccountMailWorkerRepository["lockLiveMail"]>>>,
    lease: MailLease, digest: string): boolean {
    return this.matchesLease(item, lease, digest)
      && item.mail.leaseExpiresAt! > item.now;
  }

  private async lockLiveMail(tx: Tx, id: string) {
    // Discover IDs WITHOUT locking outbox first. Credential/proof writers delete
    // outbox via a trigger; taking outbox -> user would invert their lock order.
    const [hint] = await tx.select({ userId: authChallenges.userId, challengeId: authChallenges.id })
      .from(accountMailOutbox).innerJoin(authChallenges, eq(accountMailOutbox.challengeId, authChallenges.id))
      .where(eq(accountMailOutbox.id, id));
    if (!hint) return null;
    const [user] = await tx.select().from(users).where(eq(users.id, hint.userId)).for("update");
    const [state] = await tx.select().from(accountAuthState)
      .where(eq(accountAuthState.userId, hint.userId)).for("update");
    const [snapshot] = await tx.select().from(authChallenges).where(eq(authChallenges.id, hint.challengeId));
    if (!user || !snapshot) return null; // Account/proof deletion cascades mail deletion.
    let sessionExpiry: Date | null = null;
    let contextValid = false;
    if (snapshot.purpose === "email_verify" && snapshot.initiatingSessionDigest && !snapshot.bindingId) {
      const [session] = await tx.select().from(sessions).where(and(eq(sessions.userId, user.id),
        eq(sessions.token, snapshot.initiatingSessionDigest))).for("update");
      sessionExpiry = session?.expiresAt ?? null;
      contextValid = session !== undefined;
    } else if (snapshot.purpose === "password_reset" && snapshot.bindingId && !snapshot.initiatingSessionDigest) {
      const [binding] = await tx.select().from(accountRecoveryBindings)
        .where(eq(accountRecoveryBindings.userId, user.id)).for("update");
      if (binding && binding.id === snapshot.bindingId && binding.verifiedEmail === user.email && binding.proofVersion === 1) {
        const [source] = await tx.select().from(authChallenges)
          .where(eq(authChallenges.id, binding.proofChallengeId)).for("update");
        contextValid = Boolean(source && source.userId === user.id && source.email === user.email
          && source.purpose === "email_verify" && source.consumedAt && !source.revokedAt);
      }
    }
    const [proof] = await tx.select().from(authChallenges)
      .where(eq(authChallenges.id, hint.challengeId)).for("update");
    const [mail] = await tx.select().from(accountMailOutbox).where(and(eq(accountMailOutbox.id, id),
      eq(accountMailOutbox.challengeId, hint.challengeId))).for("update");
    if (!mail) return null;
    const now = await clock(tx); // AFTER every potential lock wait.
    if (!proof || !state || !user.passwordHash || user.twoFactorEnabled || ["admin", "moderator"].includes(user.role)
      || !contextValid || proof.userId !== user.id || proof.email !== user.email
      || proof.credentialVersion !== state.credentialVersion || proof.consumedAt || proof.revokedAt
      || proof.purpose !== snapshot.purpose || proof.bindingId !== snapshot.bindingId
      || proof.initiatingSessionDigest !== snapshot.initiatingSessionDigest
      || proof.expiresAt <= now || mail.expiresAt <= now
      || mail.expiresAt.getTime() !== proof.expiresAt.getTime() || (sessionExpiry && sessionExpiry <= now)) {
      await tx.delete(accountMailOutbox).where(eq(accountMailOutbox.id, id));
      return null;
    }
    const validUntil = new Date(Math.min(proof.expiresAt.getTime(), sessionExpiry?.getTime() ?? Infinity));
    return { mail, proof, now, validUntil };
  }
}
export const accountMailWorkerRepository = new AccountMailWorkerRepository();
