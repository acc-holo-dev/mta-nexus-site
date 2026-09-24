import { afterEach, describe, it } from "vitest";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, auditEvents, sessions, users } from "../client";
import { authChallenges, accountRecoveryBindings } from "../account-recovery-schema";
import { accountMailOutbox, accountMailQueueGate } from "../account-mail-schema";
import { accountChallengeRepository as proofs, digestAccountChallenge } from "./account-challenges";
import { AccountMailCipher } from "./account-mail-crypto";
import type { MailContext, MailPayload } from "./account-mail-crypto";
import { accountMailOutboxRepository as queue, AccountMailQueueFullError } from "./account-mail-outbox";
import { userRepository } from "./users";
import { authRepository } from "./auth";
import { digestSessionToken } from "./sessions";
import { authService } from "../../../../apps/web/src/lib/services/auth-service";
import { generateId, generateSessionToken, hashPassword } from "@nexus/security";
import { UnauthorizedError } from "@nexus/domain";

const key = randomBytes(32);
const cipher = new AccountMailCipher("d2_test", { d2_test: key });
const password = "Synthetic-D2-queue-password!";
const auditId = () => generateId("aud");
let owned: string[] = [];
let restoreCapacity: number | undefined;
async function account() {
  const username = `d2_${generateId("usr").slice(-18)}`;
  const input = { username, email: `${username}@example.invalid`, password };
  const first = await authService.register(input);
  owned.push(first.user.id);
  const stored = await userRepository.findByEmail(input.email);
  assert.ok(stored?.passwordHash);
  return { userId: first.user.id, currentToken: first.token, expectedPasswordHash: stored.passwordHash, input };
}
type Account = Awaited<ReturnType<typeof account>>;
const verification = (a: Account, id = auditId()) => ({ purpose: "email_verify" as const,
  userId: a.userId, currentToken: a.currentToken, expectedPasswordHash: a.expectedPasswordHash, auditId: id });
async function pending(a: Account) {
  return db.select().from(authChallenges).where(and(eq(authChallenges.userId, a.userId),
    isNull(authChallenges.consumedAt), isNull(authChallenges.revokedAt)));
}
async function mail(id: string) {
  const [row] = await db.select({ mail: accountMailOutbox, proof: authChallenges })
    .from(accountMailOutbox).innerJoin(authChallenges, eq(accountMailOutbox.challengeId, authChallenges.id))
    .where(eq(accountMailOutbox.id, id));
  assert.ok(row, "Expected synthetic queued mail");
  const context: MailContext = { id: row.mail.id, challengeId: row.proof.id, userId: row.proof.userId,
    purpose: row.proof.purpose, expiresAt: row.mail.expiresAt };
  return { ...row, context, decoded: cipher.open(context, row.mail.payload) };
}
async function exists(id: string) {
  return (await db.select({ id: accountMailOutbox.id }).from(accountMailOutbox).where(eq(accountMailOutbox.id, id))).length === 1;
}
async function issued(a: Account) {
  return db.select().from(auditEvents).where(and(eq(auditEvents.actorId, a.userId), eq(auditEvents.action, "auth.challenge_issued")));
}
async function capacity(value: number) {
  const [gate] = await db.select().from(accountMailQueueGate);
  assert.ok(gate); restoreCapacity ??= gate.capacity;
  await db.update(accountMailQueueGate).set({ capacity: value }).where(eq(accountMailQueueGate.singleton, true));
}
async function settled<T>(promise: Promise<T>) {
  try { return { ok: true as const, value: await promise }; }
  catch (error) { return { ok: false as const, error }; }
}
function postgresCode(error: unknown): string | undefined {
  for (let i = 0; i < 6 && typeof error === "object" && error !== null; i++) {
    if ("code" in error && typeof error.code === "string") return error.code;
    error = "cause" in error ? error.cause : null;
  }
}
afterEach(async () => {
  // Only accounts created by this file; never truncate shared tables.
  try { if (owned.length) await db.delete(users).where(inArray(users.id, owned)); }
  finally {
    owned = [];
    if (restoreCapacity !== undefined) {
      await db.update(accountMailQueueGate).set({ capacity: restoreCapacity }).where(eq(accountMailQueueGate.singleton, true));
      restoreCapacity = undefined;
    }
  }
});

describe("D2a atomic encrypted mail enqueue on disposable PostgreSQL", () => {
  it("applies the additive migration without creating mail for old proofs or changing users", async () => {
    const schema = `d2_${randomUUID().replaceAll("-", "")}`;
    await db.transaction(async (tx) => {
      await tx.execute(sql.raw(`CREATE SCHEMA "${schema}"`));
      await tx.execute(sql.raw(`SET LOCAL search_path TO "${schema}"`));
      await tx.execute(sql`CREATE TABLE users (id text PRIMARY KEY, email text, password_hash text, email_verified boolean)`);
      await tx.execute(sql`CREATE TABLE sessions (id text PRIMARY KEY, user_id text, token text)`);
      for (const name of ["0012_account_recovery_proofs.sql"]) {
        for (const part of readFileSync(resolve(process.cwd(), "packages/db/migrations", name), "utf8").split("--> statement-breakpoint")) {
          if (part.trim()) await tx.execute(sql.raw(part));
        }
      }
      await tx.execute(sql`INSERT INTO users VALUES ('legacy', 'legacy@example.invalid', 'same-hash', false)`);
      await tx.execute(sql`INSERT INTO sessions VALUES ('legacy-session', 'legacy', 'same-digest')`);
      await tx.execute(sql`INSERT INTO auth_challenges
        (id,user_id,purpose,token_digest,email,credential_version,initiating_session_digest,expires_at)
        VALUES ('legacy-proof','legacy','email_verify',repeat('a',64),'legacy@example.invalid',0,repeat('b',64),now()+interval '1 hour')`);
      const migration = readFileSync(resolve(process.cwd(), "packages/db/migrations/0013_account_mail_outbox.sql"), "utf8");
      for (const part of migration.split("--> statement-breakpoint")) if (part.trim()) await tx.execute(sql.raw(part));
      const [u] = await tx.execute(sql`SELECT * FROM users`);
      assert.equal(u.password_hash === "same-hash" && u.email_verified === false, true);
      assert.equal((await tx.execute(sql`SELECT * FROM sessions`)).length, 1);
      assert.equal((await tx.execute(sql`SELECT * FROM account_mail_outbox`)).length, 0);
      const [p] = await tx.execute(sql`SELECT * FROM auth_challenges`);
      assert.equal(p.id, "legacy-proof"); assert.equal(p.revoked_at, null); assert.equal(p.consumed_at, null);
      const [g] = await tx.execute(sql`SELECT capacity FROM account_mail_queue_gate`); assert.equal(g.capacity, 1000);
      await tx.execute(sql.raw(`DROP SCHEMA "${schema}" CASCADE`));
    });
  });

  it("commits the proof, safe audit and encrypted envelope together without returning secrets", async () => {
    const a = await account(); const result = await queue.enqueue(verification(a), cipher); const m = await mail(result.id);
    assert.equal(m.decoded.recipient === a.input.email, true);
    assert.equal(digestAccountChallenge("email_verify", m.decoded.token) === m.proof.tokenDigest, true);
    assert.equal(m.mail.expiresAt.getTime(), m.proof.expiresAt.getTime());
    assert.equal(m.proof.expiresAt.getTime() - m.proof.createdAt.getTime(), 24 * 60 * 60_000);
    assert.deepEqual(Object.keys(result).sort(), ["challengeId", "expiresAt", "id"]);
    const audits = await issued(a); assert.equal(audits.length, 1);
    const exposed = JSON.stringify([result, m.mail, audits]);
    assert.equal(exposed.includes(m.decoded.token) || exposed.includes(a.currentToken) || exposed.includes(a.input.email), false);
    assert.equal((await authService.getSession(a.currentToken))?.id, a.userId);
    assert.equal((await userRepository.findByEmail(a.input.email))?.passwordHash === a.expectedPasswordHash, true);
  });

  it("can read persisted ciphertext with a new key ring without generating another proof", async () => {
    const a = await account(); const result = await queue.enqueue(verification(a), cipher); const m = await mail(result.id);
    const fresh = new AccountMailCipher("next_key", { d2_test: key, next_key: randomBytes(32) });
    assert.equal(fresh.open(m.context, m.mail.payload).token === m.decoded.token, true);
    assert.equal((await pending(a)).length, 1); assert.equal((await issued(a)).length, 1);
  });

  it("reissue replaces only the old pending envelope and keeps its transaction atomic", async () => {
    const a = await account(); const first = await queue.enqueue(verification(a), cipher); const old = await mail(first.id);
    const next = await queue.enqueue(verification(a), cipher);
    assert.equal(await exists(first.id), false); assert.equal(await exists(next.id), true);
    assert.equal((await pending(a)).length, 1);
    await assert.rejects(() => proofs.consume({ ...verification(a), id: first.challengeId, token: old.decoded.token }, async () => true), UnauthorizedError);
  });

  it("rolls back reissue and outbox deletion on a real duplicate audit failure", async () => {
    const a = await account(); const firstAudit = auditId(); const first = await queue.enqueue(verification(a, firstAudit), cipher);
    const old = await mail(first.id);
    const failure = await settled(queue.enqueue(verification(a, firstAudit), cipher));
    assert.equal(failure.ok, false); if (!failure.ok) assert.equal(postgresCode(failure.error), "23505");
    assert.equal(await exists(first.id), true); assert.equal((await pending(a))[0].id, first.challengeId);
    assert.equal(JSON.stringify((await mail(first.id)).mail.payload) === JSON.stringify(old.mail.payload), true);
    assert.equal((await issued(a)).length, 1);
  });

  it("rolls back proof and audit when the database rejects an oversized queue envelope", async () => {
    const a = await account(); const first = await queue.enqueue(verification(a), cipher);
    class OversizedEnvelope extends AccountMailCipher {
      override seal(context: MailContext, input: MailPayload) {
        const envelope = super.seal(context, input);
        return { ...envelope, ciphertext: envelope.ciphertext.repeat(30) };
      }
    }
    // Explicit fault injection in the cipher result; the 23514 database failure is real.
    const failure = await settled(queue.enqueue(verification(a), new OversizedEnvelope("d2_test", { d2_test: key })));
    assert.equal(failure.ok, false); if (!failure.ok) assert.equal(postgresCode(failure.error), "23514");
    assert.equal(await exists(first.id), true); assert.equal((await pending(a))[0].id, first.challengeId);
    assert.equal((await issued(a)).length, 1);
  });

  it("enforces the last queue slot across two competing accounts", async () => {
    assert.equal((await db.select().from(accountMailOutbox)).length, 0, "Capacity test requires an empty disposable queue");
    const a = await account(); const b = await account(); await capacity(1);
    const outcomes = await Promise.all([settled(queue.enqueue(verification(a), cipher)), settled(queue.enqueue(verification(b), cipher))]);
    assert.equal(outcomes.filter((r) => r.ok).length, 1);
    const failure = outcomes.find((r) => !r.ok); assert.ok(failure && !failure.ok);
    assert.ok(failure.error instanceof AccountMailQueueFullError);
    assert.equal((await db.select().from(accountMailOutbox)).length, 1);
    assert.equal((await pending(a)).length + (await pending(b)).length, 1);
    assert.equal((await issued(a)).length + (await issued(b)).length, 1);
  });

  it("a full queue preserves an earlier standalone proof rather than silently revoking it", async () => {
    assert.equal((await db.select().from(accountMailOutbox)).length, 0);
    const a = await account(); const b = await account(); const previous = await proofs.issue(verification(a));
    await capacity(1); const occupant = await queue.enqueue(verification(b), cipher);
    await assert.rejects(() => queue.enqueue(verification(a), cipher), AccountMailQueueFullError);
    assert.equal((await pending(a))[0].id, previous.id); assert.equal(await exists(occupant.id), true);
    assert.equal(await proofs.consume({ ...verification(a), ...previous }, async () => true), true);
  });

  it("two concurrent reissues leave only the final mail and proof pending", async () => {
    const a = await account(); const jobs = await Promise.all([queue.enqueue(verification(a), cipher), queue.enqueue(verification(a), cipher)]);
    const live = await Promise.all(jobs.map((j) => exists(j.id)));
    assert.equal(live.filter(Boolean).length, 1); assert.equal((await pending(a)).length, 1);
  });

  it("consuming a verification removes its envelope, then allows a bound reset envelope", async () => {
    const a = await account(); const first = await queue.enqueue(verification(a), cipher); const m = await mail(first.id);
    await proofs.consume({ ...verification(a), id: first.challengeId, token: m.decoded.token }, async (tx, p) => {
      // Synthetic binding: no claim of proving a real mailbox or changing sessions.
      await tx.insert(accountRecoveryBindings).values({ userId: p.userId, id: `rcb_${randomUUID()}`,
        verifiedEmail: p.email, proofVersion: 1, proofChallengeId: p.id });
    });
    assert.equal(await exists(first.id), false);
    const reset = await queue.enqueue({ purpose: "password_reset", userId: a.userId, auditId: auditId() }, cipher);
    const r = await mail(reset.id); assert.equal(r.proof.purpose, "password_reset");
    assert.equal(digestAccountChallenge("password_reset", r.decoded.token) === r.proof.tokenDigest, true);
    assert.equal(r.proof.expiresAt.getTime() - r.proof.createdAt.getTime(), 30 * 60_000);
  });

  it("failed consumption restores both the queued ciphertext and the usable proof", async () => {
    const a = await account(); const id = auditId(); const first = await queue.enqueue(verification(a, id), cipher); const m = await mail(first.id);
    const failure = await settled(proofs.consume({ ...verification(a, id), id: first.challengeId, token: m.decoded.token }, async () => true));
    assert.equal(failure.ok, false); if (!failure.ok) assert.equal(postgresCode(failure.error), "23505");
    assert.equal(await exists(first.id), true); assert.equal((await pending(a))[0].consumedAt, null);
  });

  it("password and email changes discard queued mail; failed password changes restore it", async () => {
    const a = await account(); const first = await queue.enqueue(verification(a), cipher);
    const [registered] = await db.select().from(auditEvents).where(eq(auditEvents.actorId, a.userId)).limit(1);
    const changedHash = await hashPassword("Synthetic-D2-next-password!");
    const failed = await settled(authRepository.changePassword({ userId: a.userId, currentToken: a.currentToken,
      expectedPasswordHash: a.expectedPasswordHash, passwordHash: changedHash, nextToken: generateSessionToken(),
      audit: { id: registered.id, actorId: a.userId, actorType: "user", action: "user.password_changed", targetId: a.userId, targetType: "user" } }));
    assert.equal(failed.ok, false); if (!failed.ok) assert.equal(postgresCode(failed.error), "23505");
    assert.equal(await exists(first.id), true);
    await authService.changePassword({ userId: a.userId, currentToken: a.currentToken,
      currentPassword: password, newPassword: "Synthetic-D2-next-password!" });
    assert.equal(await exists(first.id), false);
    const b = await account(); const bMail = await queue.enqueue(verification(b), cipher);
    await userRepository.update(b.userId, { email: `changed_${b.input.email}` });
    assert.equal(await exists(bMail.id), false);
  });

  it("never queues reset mail for an account without a verified binding", async () => {
    const a = await account();
    await userRepository.update(a.userId, { emailVerified: true, isVerified: true });
    await assert.rejects(() => queue.enqueue({ purpose: "password_reset", userId: a.userId, auditId: auditId() }, cipher), UnauthorizedError);
    assert.equal((await pending(a)).length, 0); assert.equal((await issued(a)).length, 0);
  });

  it("bounded expiry cleanup removes old payloads but not live mail or proof provenance", async () => {
    const jobs = [];
    for (let i = 0; i < 4; i++) jobs.push(await queue.enqueue(verification(await account()), cipher));
    const expired = jobs.slice(0, 3).map((j) => j.id);
    await db.update(accountMailOutbox).set({ createdAt: sql`clock_timestamp() - interval '2 hours'`,
      expiresAt: sql`clock_timestamp() - interval '1 hour'` }).where(inArray(accountMailOutbox.id, expired));
    assert.equal(await queue.discardExpired(2), 2); assert.equal(await queue.discardExpired(2), 1);
    assert.equal(await queue.discardExpired(2), 0); assert.equal(await exists(jobs[3].id), true);
    assert.equal((await db.select().from(authChallenges).where(inArray(authChallenges.id, jobs.map((j) => j.challengeId)))).length, 4);
    await assert.rejects(() => queue.discardExpired(101)); await assert.rejects(() => queue.discardExpired(0));
  });

  it("rechecks session expiry after actually waiting for the queue gate", async () => {
    const a = await account();
    let operation: ReturnType<typeof settled<unknown>> | undefined;
    let finished = false;
    try {
      await db.transaction(async (tx) => {
        await tx.select().from(accountMailQueueGate).where(eq(accountMailQueueGate.singleton, true)).for("update");
        // Modify the synthetic session before starting the producer; never take
        // its session lock while that producer holds the user/session locks.
        await db.update(sessions).set({ expiresAt: sql`clock_timestamp() + interval '2 seconds'` })
          .where(eq(sessions.token, digestSessionToken(a.currentToken)));
        const [backend] = await tx.execute(sql`select pg_backend_pid() as pid`);
        operation = settled(queue.enqueue(verification(a), cipher)).then((v) => { finished = true; return v; });
        const deadline = Date.now() + 3000;
        for (;;) {
          assert.equal(finished, false, "Producer must wait for the queue gate");
          const [waiting] = await db.execute(sql`select exists (
            select 1 from pg_stat_activity where ${Number(backend.pid)}::integer = any(pg_blocking_pids(pid))
          ) as waiting`);
          if (waiting.waiting === true) break;
          if (Date.now() >= deadline) throw new Error("Expected queue gate wait was not observed");
          await delay(10);
        }
        // Wait for the measured DB deadline, not a guessed ordering delay.
        await tx.execute(sql`select pg_sleep(greatest(0, extract(epoch from (expires_at - clock_timestamp()))) + 0.02)
          from sessions where token = ${digestSessionToken(a.currentToken)}`);
      });
    } finally { if (operation) await operation; }
    assert.ok(operation); const result = await operation; assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.error instanceof UnauthorizedError);
    assert.equal((await pending(a)).length, 0); assert.equal((await issued(a)).length, 0);
    const rows = await db.select({ id: accountMailOutbox.id }).from(accountMailOutbox)
      .innerJoin(authChallenges, eq(accountMailOutbox.challengeId, authChallenges.id)).where(eq(authChallenges.userId, a.userId));
    assert.equal(rows.length, 0);
  });
});
