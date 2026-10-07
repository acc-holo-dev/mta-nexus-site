import { afterEach, describe, it } from "vitest";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { fork } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { eq, inArray, sql } from "drizzle-orm";
import { db, auditEvents, sessions, users } from "../client";
import { accountAuthState, accountRecoveryBindings, authChallenges } from "../account-recovery-schema";
import { accountMailOutbox } from "../account-mail-schema";
import { accountChallengeRepository as proofs, digestAccountChallenge } from "./account-challenges";
import { AccountMailCipher, AccountMailKeyUnavailableError } from "./account-mail-crypto";
import { accountMailOutboxRepository as queue } from "./account-mail-outbox";
import { AccountMailWorkerRepository, accountMailWorkerRepository as worker } from "./account-mail-worker";
import type { MailLease } from "./account-mail-worker";
import { userRepository } from "./users";
import { digestSessionToken } from "./sessions";
import { authService } from "../../../../apps/web/src/lib/services/auth-service";
import { generateId, generateSessionToken } from "@nexus/security";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const key = randomBytes(32);
const cipher = new AccountMailCipher("d2b_test", { d2b_test: key });
const password = "Synthetic-D2b-queue-password!";
const owned: string[] = [];
const auditId = () => generateId("aud");
async function account() {
  const username = `d2b_${generateId("usr").slice(-16)}`;
  const input = { username, email: `${username}@example.invalid`, password };
  const first = await authService.register(input);
  owned.push(first.user.id);
  const stored = await userRepository.findByEmail(input.email);
  assert.ok(stored?.passwordHash);
  return { userId: first.user.id, currentToken: first.token, expectedPasswordHash: stored.passwordHash, input };
}
type Account = Awaited<ReturnType<typeof account>>;
const verification = (a: Account) => ({ purpose: "email_verify" as const,
  userId: a.userId, currentToken: a.currentToken, expectedPasswordHash: a.expectedPasswordHash, auditId: auditId() });
async function fixture(reset = false) {
  const a = await account();
  if (reset) {
    const proof = await proofs.issue(verification(a));
    await proofs.consume({ ...verification(a), ...proof }, async (tx, p) => {
      await tx.insert(accountRecoveryBindings).values({ userId: a.userId, id: `rcb_${randomUUID()}`,
        verifiedEmail: p.email, proofVersion: 1, proofChallengeId: p.id });
    });
  }
  const intent = reset ? { purpose: "password_reset" as const, userId: a.userId, auditId: auditId() } : verification(a);
  return { ...a, intent, job: await queue.enqueue(intent, cipher) };
}
async function row(id: string) {
  const [value] = await db.select().from(accountMailOutbox).where(eq(accountMailOutbox.id, id));
  return value;
}
async function events(id: string) {
  return db.select().from(auditEvents).where(eq(auditEvents.targetId, id));
}
async function lease(id: string) { const value = await worker.claim(id); assert.ok(value); return value; }
async function makeDue(id: string) {
  // Accelerate only our synthetic retry schedule, not the production clock/policy.
  await db.update(accountMailOutbox).set({ availableAt: sql`clock_timestamp() - interval '1 second'` })
    .where(eq(accountMailOutbox.id, id));
}
async function expireLease(id: string) {
  // A controlled clock-state fixture, never a claim of waiting a real minute.
  await db.update(accountMailOutbox).set({ leaseExpiresAt: sql`clock_timestamp() - interval '1 millisecond'` })
    .where(eq(accountMailOutbox.id, id));
}
function postgresCode(error: unknown): string | undefined {
  for (let i = 0; i < 6 && typeof error === "object" && error !== null; i++) {
    if ("code" in error && typeof error.code === "string") return error.code;
    error = "cause" in error ? error.cause : null;
  }
}
async function settled<T>(p: Promise<T>) {
  try { return { ok: true as const, value: await p }; }
  catch (error) { return { ok: false as const, error }; }
}
async function afterWait<T>(lock: (tx: Tx) => Promise<unknown>, work: () => Promise<T>,
  invalidate: (tx: Tx) => Promise<unknown>) {
  let pending: ReturnType<typeof settled<T>> | undefined;
  let completed = false;
  try {
    await db.transaction(async (tx) => {
      await lock(tx);
      const [pidRow] = await tx.execute(sql`select pg_backend_pid() as pid`);
      const pid = Number(pidRow.pid);
      pending = settled(work()).then((value) => { completed = true; return value; });
      const deadline = Date.now() + 3000;
      for (;;) {
        assert.equal(completed, false, "Operation must actually wait for the held database lock");
        const [result] = await db.execute(sql`select exists (
          select 1 from pg_stat_activity where ${pid}::integer = any(pg_blocking_pids(pid))
        ) as waiting`);
        if (result.waiting === true) break;
        if (Date.now() >= deadline) throw new Error("No expected lock wait observed");
        await delay(10);
      }
      await invalidate(tx);
    });
  } finally { if (pending) await pending; }
  assert.ok(pending);
  const result = await pending;
  assert.equal(result.ok, true, "The queued operation must complete without a database failure");
  return result.ok ? result.value : undefined;
}
afterEach(async () => {
  // Delete only synthetic accounts created by this file, never truncate tables.
  if (owned.length) await db.delete(users).where(inArray(users.id, owned.splice(0)));
});

describe("D2b internal account mail leases on disposable PostgreSQL", () => {
  it("adds lease defaults without changing legacy pending payloads or account data", async () => {
    const schema = `d2b_${randomUUID().replaceAll("-", "")}`;
    await db.transaction(async (tx) => {
      await tx.execute(sql.raw(`CREATE SCHEMA "${schema}"`));
      await tx.execute(sql.raw(`SET LOCAL search_path TO "${schema}"`));
      await tx.execute(sql`CREATE TABLE users (id text PRIMARY KEY, email text, password_hash text, email_verified boolean)`);
      await tx.execute(sql`CREATE TABLE sessions (id text PRIMARY KEY, user_id text, token text)`);
      await tx.execute(sql`INSERT INTO users VALUES ('legacy', 'legacy@example.invalid', 'same-hash', false)`);
      for (const file of ["0012_account_recovery_proofs.sql", "0013_account_mail_outbox.sql"]) {
        const text = readFileSync(resolve(process.cwd(), "packages/db/migrations", file), "utf8");
        for (const part of text.split("--> statement-breakpoint")) if (part.trim()) await tx.execute(sql.raw(part));
      }
      await tx.execute(sql`INSERT INTO auth_challenges
        (id, user_id, purpose, token_digest, email, credential_version, initiating_session_digest, expires_at)
        VALUES ('proof', 'legacy', 'email_verify', repeat('a',64), 'legacy@example.invalid', 0, repeat('b',64), now() + interval '1 day')`);
      await tx.execute(sql`INSERT INTO account_mail_outbox (id, challenge_id, payload, expires_at)
        VALUES ('pending', 'proof', '{"opaque":"old-fixture"}'::jsonb, now() + interval '1 day')`);
      const migration = readFileSync(resolve(process.cwd(), "packages/db/migrations/0014_account_mail_leases.sql"), "utf8");
      for (const part of migration.split("--> statement-breakpoint")) if (part.trim()) await tx.execute(sql.raw(part));
      const [mail] = await tx.execute(sql`SELECT * FROM account_mail_outbox`);
      assert.equal(mail.attempts, 0); assert.equal(mail.lease_token_digest, null); assert.equal(mail.lease_expires_at, null);
      assert.ok(mail.available_at); assert.deepEqual(mail.payload, { opaque: "old-fixture" });
      const [user] = await tx.execute(sql`SELECT * FROM users`);
      assert.equal(user.password_hash, "same-hash"); assert.equal(user.email_verified, false);
      assert.equal((await tx.execute(sql`SELECT * FROM account_recovery_bindings`)).length, 0);
      await tx.execute(sql.raw(`DROP SCHEMA "${schema}" CASCADE`));
    });
  });

  it("lists metadata only and grants exactly one concurrent claim", async () => {
    const a = await fixture();
    assert.ok((await worker.candidates(100)).includes(a.job.id));
    const attempts = await Promise.all([worker.claim(a.job.id), worker.claim(a.job.id)]);
    assert.equal(attempts.filter(Boolean).length, 1);
    const l = attempts.find((x) => x !== null); assert.ok(l);
    const stored = await row(a.job.id);
    assert.equal(stored.attempts, 1); assert.equal(stored.leaseTokenDigest === l.token, false);
    assert.ok(l.expiresAt <= stored.expiresAt);
    assert.equal((await worker.candidates(100)).includes(a.job.id), false);
    assert.equal(await worker.claim(a.job.id), null);
  });

  it("claims different accounts independently and prepares only the right payload", async () => {
    const a = await fixture(), b = await fixture(true);
    const [first, second] = await Promise.all([lease(a.job.id), lease(b.job.id)]);
    const prepared = await worker.prepare(first, cipher);
    assert.ok(prepared);
    assert.equal(prepared.recipient === a.input.email, true);
    const [proof] = await db.select().from(authChallenges).where(eq(authChallenges.id, a.job.challengeId));
    assert.equal(digestAccountChallenge("email_verify", prepared.token) === proof.tokenDigest, true);
    assert.equal(prepared.id, a.job.id); assert.equal(prepared.sendBefore.getTime(), first.expiresAt.getTime());
    assert.equal(await worker.prepare({ ...first, id: second.id }, cipher), null);
    assert.equal(await worker.settle({ ...first, id: second.id }, "accepted"), false);
    assert.ok(await worker.prepare(second, cipher));
    assert.equal((await authService.getSession(a.currentToken))?.id, a.userId);
  });

  it("rejects malformed worker inputs without mutating pending mail", async () => {
    const a = await fixture();
    await assert.rejects(worker.candidates(0)); await assert.rejects(worker.candidates(101));
    await assert.rejects(worker.discardUnavailable(0)); await assert.rejects(worker.claim("/invalid"));
    const bad = { id: a.job.id, token: "bad", attempt: 0, expiresAt: new Date() };
    await assert.rejects(worker.prepare(bad, cipher)); await assert.rejects(worker.settle(bad, "accepted"));
    assert.equal((await row(a.job.id)).attempts, 0);
  });

  it("persists backoff and retries the identical proof without extending its expiry", async () => {
    const a = await fixture(); const first = await lease(a.job.id);
    const before = await row(a.job.id), message = await worker.prepare(first, cipher); assert.ok(message);
    assert.equal(await worker.settle(first, "retry"), true);
    const waiting = await row(a.job.id);
    assert.ok(waiting.availableAt > new Date()); assert.equal(waiting.leaseTokenDigest, null);
    assert.equal(waiting.attempts, 1); assert.equal(await worker.claim(a.job.id), null);
    assert.equal(await worker.prepare(first, cipher), null);
    await makeDue(a.job.id);
    const second = await lease(a.job.id); assert.equal(second.attempt, 2); assert.equal(second.token === first.token, false);
    const next = await worker.prepare(second, cipher); assert.ok(next);
    assert.equal(next.token === message.token, true); assert.equal(next.id, message.id);
    assert.equal((await row(a.job.id)).expiresAt.getTime(), before.expiresAt.getTime());
    assert.equal(await worker.settle(first, "discard"), false);
  });

  it("recovers a committed claim after killing its worker process, rejecting the stale owner", async () => {
    const a = await fixture();
    const child = fork(resolve(process.cwd(), "packages/db/src/repositories/account-mail-worker.fixture.ts"), [a.job.id], {
      execArgv: ["--import", "tsx"], stdio: ["ignore", "pipe", "pipe", "ipc"], env: { ...process.env, NODE_ENV: "test" },
    });
    child.stdout?.resume(); child.stderr?.resume(); // Drain without recording sensitive IPC/child output.
    const exited = new Promise<void>((resolveExit) => child.once("exit", () => resolveExit()));
    let first: MailLease | undefined;
    try {
      first = await new Promise<MailLease>((resolveLease, reject) => {
        const timer = setTimeout(() => reject(new Error("Claim fixture timed out")), 8000);
        child.once("error", () => { clearTimeout(timer); reject(new Error("Claim fixture failed")); });
        child.once("exit", () => { clearTimeout(timer); reject(new Error("Claim fixture exited before handoff")); });
        child.once("message", (value: unknown) => {
          clearTimeout(timer);
          const result = value as { lease?: MailLease };
          if (!result.lease) reject(new Error("Claim fixture did not reserve its job"));
          else resolveLease({ ...result.lease, expiresAt: new Date(result.lease.expiresAt) });
        });
      });
    } finally { child.kill("SIGKILL"); await exited; }
    if (!first) throw new Error("Claim fixture did not return a lease");
    assert.equal((await row(a.job.id)).attempts, 1);
    await expireLease(a.job.id); // Accelerated expiry; the process stop above is real.
    const replacement = new AccountMailWorkerRepository();
    const second = await replacement.claim(a.job.id); assert.ok(second); assert.equal(second.attempt, 2);
    assert.equal(second.token === first.token, false);
    assert.equal(await replacement.prepare(first, cipher), null);
    assert.equal(await replacement.settle(first, "accepted"), false);
    assert.equal(await replacement.settle(first, "retry"), false);
    assert.ok(await replacement.prepare(second, new AccountMailCipher("d2b_test", { d2b_test: key })));
  }, 15_000);

  it("ends retries at five acquisitions and does not spend or revoke the proof", async () => {
    const a = await fixture();
    for (let i = 1; i <= 5; i++) {
      const current = await lease(a.job.id); assert.equal(current.attempt, i);
      assert.equal(await worker.settle(current, "retry"), true);
      if (i < 5) await makeDue(a.job.id);
    }
    assert.equal(await row(a.job.id), undefined);
    const [proof] = await db.select().from(authChallenges).where(eq(authChallenges.id, a.job.challengeId));
    assert.equal(proof.consumedAt, null); assert.equal(proof.revokedAt, null);
    assert.equal((await events(a.job.id)).filter((e) => e.action === "auth.mail_discarded").length, 1);
  });

  it("preserves a live fifth lease but cleans an abandoned exhausted job", async () => {
    const a = await fixture();
    await db.update(accountMailOutbox).set({ attempts: 4 }).where(eq(accountMailOutbox.id, a.job.id));
    const final = await lease(a.job.id); assert.equal(final.attempt, 5);
    await worker.discardUnavailable(); assert.ok(await row(a.job.id));
    await expireLease(a.job.id); await worker.discardUnavailable();
    assert.equal(await row(a.job.id), undefined); assert.equal(await worker.settle(final, "accepted"), false);
  });

  it("does not schedule a retry later than the initiating session lifetime", async () => {
    const a = await fixture(); const l = await lease(a.job.id);
    await db.update(sessions).set({ expiresAt: sql`clock_timestamp() + interval '2 seconds'` })
      .where(eq(sessions.token, digestSessionToken(a.currentToken)));
    assert.equal(await worker.settle(l, "retry"), true); assert.equal(await row(a.job.id), undefined);
  });

  it("records transport acceptance once and clears ciphertext without consuming the proof", async () => {
    const a = await fixture(); const l = await lease(a.job.id);
    assert.equal(await worker.settle(l, "accepted"), true); assert.equal(await worker.settle(l, "accepted"), false);
    assert.equal(await row(a.job.id), undefined);
    const logged = await events(a.job.id); assert.equal(logged.length, 1);
    assert.equal(logged[0].action, "auth.mail_transport_accepted");
    assert.equal(JSON.stringify(logged).includes(a.input.email), false);
    assert.equal(JSON.stringify(logged).includes(l.token), false);
    const [proof] = await db.select().from(authChallenges).where(eq(authChallenges.id, a.job.challengeId));
    assert.equal(proof.consumedAt, null); assert.equal(proof.revokedAt, null);
  });

  for (const outcome of ["accepted", "retry", "discard"] as const) {
    it(`${outcome}: rolls back queue state when its outcome audit insert fails`, async () => {
      const a = await fixture(); const l = await lease(a.job.id); const before = await row(a.job.id);
      const result = await settled(worker.settle(l, outcome, a.intent.auditId));
      assert.equal(result.ok, false); if (!result.ok) assert.equal(postgresCode(result.error), "23505");
      assert.deepEqual(await row(a.job.id), before); assert.equal((await events(a.job.id)).length, 0);
      assert.ok(await worker.prepare(l, cipher)); assert.equal(await worker.settle(l, outcome), true);
    });
  }

  const invalidators: Record<string, (a: Awaited<ReturnType<typeof fixture>>) => Promise<unknown>> = {
    "revoked session": (a) => db.delete(sessions).where(eq(sessions.token, digestSessionToken(a.currentToken))),
    "rotated session": (a) => db.update(sessions).set({ token: digestSessionToken(generateSessionToken()) })
      .where(eq(sessions.token, digestSessionToken(a.currentToken))),
    "expired session": (a) => db.update(sessions).set({ expiresAt: sql`clock_timestamp() - interval '1 second'` })
      .where(eq(sessions.token, digestSessionToken(a.currentToken))),
    "changed credential version": (a) => db.update(accountAuthState).set({ credentialVersion: 99 })
      .where(eq(accountAuthState.userId, a.userId)),
    "MFA enabled": (a) => db.update(users).set({ twoFactorEnabled: true }).where(eq(users.id, a.userId)),
    "privileged role": (a) => db.update(users).set({ role: "admin" }).where(eq(users.id, a.userId)),
  };
  for (const [name, invalidate] of Object.entries(invalidators)) {
    it(`rechecks ${name} before exposing a leased email payload`, async () => {
      const a = await fixture(); const l = await lease(a.job.id); await invalidate(a);
      assert.equal(await worker.prepare(l, cipher), null); assert.equal(await row(a.job.id), undefined);
      assert.equal(await worker.settle(l, "accepted"), false);
    });
  }

  for (const mode of ["removed", "replaced", "foreign proof"] as const) {
    it(`rejects a reset delivery whose binding was ${mode}`, async () => {
      const a = await fixture(true); const l = await lease(a.job.id);
      if (mode === "removed") await db.delete(accountRecoveryBindings).where(eq(accountRecoveryBindings.userId, a.userId));
      if (mode === "replaced") await db.update(accountRecoveryBindings).set({ id: `rcb_${randomUUID()}` })
        .where(eq(accountRecoveryBindings.userId, a.userId));
      if (mode === "foreign proof") {
        const b = await account(); const other = await proofs.issue(verification(b));
        await proofs.consume({ ...verification(b), ...other }, async () => true);
        await db.update(accountRecoveryBindings).set({ proofChallengeId: other.id })
          .where(eq(accountRecoveryBindings.userId, a.userId));
      }
      assert.equal(await worker.prepare(l, cipher), null); assert.equal(await row(a.job.id), undefined);
    });
  }

  it("fails closed on missing keys and on a validly encrypted but wrong token", async () => {
    const a = await fixture(); const l = await lease(a.job.id); const before = await row(a.job.id);
    // A cipher whose key ring lacks the envelope keyId fails closed before any
    // decryption is attempted.
    await assert.rejects(worker.prepare(l, new AccountMailCipher("other", { other: randomBytes(32) })),
      (error: unknown) => error instanceof AccountMailKeyUnavailableError);
    assert.deepEqual(await row(a.job.id), before);
    const [proof] = await db.select().from(authChallenges).where(eq(authChallenges.id, a.job.challengeId));
    const payload = cipher.seal({ id: a.job.id, challengeId: proof.id, userId: a.userId,
      purpose: proof.purpose, expiresAt: before.expiresAt }, { recipient: a.input.email, token: randomBytes(32).toString("base64url") });
    await db.update(accountMailOutbox).set({ payload }).where(eq(accountMailOutbox.id, a.job.id));
    await assert.rejects(worker.prepare(l, cipher), { message: "Account mail payload is unavailable" });
    assert.equal(await worker.settle(l, "discard"), true);
  });

  it("reissue cancels even leased mail and the stale owner cannot acknowledge the replacement", async () => {
    const a = await fixture(); const old = await lease(a.job.id);
    const replacement = await queue.enqueue(verification(a), cipher);
    assert.equal(await worker.prepare(old, cipher), null); assert.equal(await worker.settle(old, "accepted"), false);
    assert.ok(await row(replacement.id)); assert.equal((await row(replacement.id)).attempts, 0);
  });

  it("proof consumption discards leased ciphertext and failed consumption restores it", async () => {
    const a = await fixture(); const l = await lease(a.job.id);
    const prepared = await worker.prepare(l, cipher); assert.ok(prepared);
    const request = { ...verification(a), id: a.job.challengeId, token: prepared.token };
    await assert.rejects(proofs.consume(request, async () => { throw new Error("Synthetic action failure"); }));
    assert.ok(await worker.prepare(l, cipher));
    await proofs.consume({ ...request, auditId: auditId() }, async () => true);
    assert.equal(await row(a.job.id), undefined); assert.equal(await worker.settle(l, "accepted"), false);
  });

  it("checks actor validity after an observed wait on the user lock", async () => {
    const a = await fixture();
    const result = await afterWait(
      (tx) => tx.select().from(users).where(eq(users.id, a.userId)).for("update"),
      () => worker.claim(a.job.id),
      (tx) => tx.delete(sessions).where(eq(sessions.token, digestSessionToken(a.currentToken)))
    );
    assert.equal(result, null); assert.equal(await row(a.job.id), undefined);
  });

  for (const operation of ["prepare", "settle"] as const) {
    it(`${operation}: handles an expired lease after a later outbox lock wait`, async () => {
      const a = await fixture(); const l = await lease(a.job.id);
      const result = await afterWait<unknown>(
        (tx) => tx.select().from(accountMailOutbox).where(eq(accountMailOutbox.id, a.job.id)).for("update"),
        () => operation === "prepare" ? worker.prepare(l, cipher) : worker.settle(l, "accepted"),
        (tx) => tx.update(accountMailOutbox).set({ leaseExpiresAt: sql`clock_timestamp() - interval '1 millisecond'` })
          .where(eq(accountMailOutbox.id, a.job.id))
      );
      if (operation === "prepare") {
        // Preparing must not trust the expired lease: the row stays queued and
        // a fresh lease increments the attempt counter.
        assert.equal(result, null);
        assert.ok(await row(a.job.id)); assert.equal((await events(a.job.id)).length, 0);
        const next = await lease(a.job.id); assert.equal(next.attempt, 2);
      } else {
        // Settlement may arrive just after the nominal lease deadline. While
        // the same token/attempt still owns the row (no reclaim happened) the
        // real delivery outcome is recorded to avoid a duplicate send; a
        // reclaimed lease loses on the token digest mismatch instead.
        assert.equal(result, true);
        assert.equal(await row(a.job.id), undefined);
      }
    });
  }

  it("checks proof expiry after a real wait and cleans only the encrypted mail", async () => {
    const a = await fixture();
    const result = await afterWait(
      (tx) => tx.select().from(users).where(eq(users.id, a.userId)).for("update"),
      () => worker.claim(a.job.id), async (tx) => {
        await tx.update(authChallenges).set({ createdAt: sql`clock_timestamp() - interval '2 days'`,
          expiresAt: sql`clock_timestamp() - interval '1 day'` }).where(eq(authChallenges.id, a.job.challengeId));
      }
    );
    assert.equal(result, null); assert.equal(await row(a.job.id), undefined);
    assert.equal((await db.select().from(authChallenges).where(eq(authChallenges.id, a.job.challengeId))).length, 1);
  });
});
