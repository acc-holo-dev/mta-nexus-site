import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq, sql } from "drizzle-orm";
import { afterEach, describe, it } from "vitest";
import { authService } from "../apps/web/src/lib/services/auth-service";
import { accountMailOutbox } from "../packages/db/src/account-mail-schema";
import { authChallenges } from "../packages/db/src/account-recovery-schema";
import { db } from "../packages/db/src/client";
import { digestAccountChallenge } from "../packages/db/src/repositories/account-challenges";
import { AccountMailCipher } from "../packages/db/src/repositories/account-mail-crypto";
import {
  AccountMailWorkerRepository,
  type MailLease,
} from "../packages/db/src/repositories/account-mail-worker";
import {
  afterWait,
  cipher,
  cleanupOwnedAccounts,
  events,
  expireLease,
  fixture,
  key,
  lease,
  row,
  worker,
} from "./helpers/account-mail-worker-harness";

afterEach(cleanupOwnedAccounts);

describe("D2b account mail worker: lease and claim", () => {
  it("adds lease defaults without changing legacy pending payloads or account data", async () => {
    const schema = `d2b_${randomUUID().replaceAll("-", "")}`;
    await db.transaction(async (tx) => {
      await tx.execute(sql.raw(`CREATE SCHEMA "${schema}"`));
      await tx.execute(sql.raw(`SET LOCAL search_path TO "${schema}"`));
      await tx.execute(
        sql`CREATE TABLE users (id text PRIMARY KEY, email text, password_hash text, email_verified boolean)`,
      );
      await tx.execute(sql`CREATE TABLE sessions (id text PRIMARY KEY, user_id text, token text)`);
      await tx.execute(
        sql`INSERT INTO users VALUES ('legacy', 'legacy@example.invalid', 'same-hash', false)`,
      );
      for (const file of ["0012_account_recovery_proofs.sql", "0013_account_mail_outbox.sql"]) {
        const text = readFileSync(resolve(process.cwd(), "packages/db/migrations", file), "utf8");
        for (const part of text.split("--> statement-breakpoint"))
          if (part.trim()) await tx.execute(sql.raw(part));
      }
      await tx.execute(sql`INSERT INTO auth_challenges
        (id, user_id, purpose, token_digest, email, credential_version, initiating_session_digest, expires_at)
        VALUES ('proof', 'legacy', 'email_verify', repeat('a',64), 'legacy@example.invalid', 0, repeat('b',64), now() + interval '1 day')`);
      await tx.execute(sql`INSERT INTO account_mail_outbox (id, challenge_id, payload, expires_at)
        VALUES ('pending', 'proof', '{"opaque":"old-fixture"}'::jsonb, now() + interval '1 day')`);
      const migration = readFileSync(
        resolve(process.cwd(), "packages/db/migrations/0014_account_mail_leases.sql"),
        "utf8",
      );
      for (const part of migration.split("--> statement-breakpoint"))
        if (part.trim()) await tx.execute(sql.raw(part));
      const [mail] = await tx.execute(sql`SELECT * FROM account_mail_outbox`);
      assert.equal(mail.attempts, 0);
      assert.equal(mail.lease_token_digest, null);
      assert.equal(mail.lease_expires_at, null);
      assert.ok(mail.available_at);
      assert.deepEqual(mail.payload, { opaque: "old-fixture" });
      const [user] = await tx.execute(sql`SELECT * FROM users`);
      assert.equal(user.password_hash, "same-hash");
      assert.equal(user.email_verified, false);
      assert.equal((await tx.execute(sql`SELECT * FROM account_recovery_bindings`)).length, 0);
      await tx.execute(sql.raw(`DROP SCHEMA "${schema}" CASCADE`));
    });
  });

  it("lists metadata only and grants exactly one concurrent claim", async () => {
    const a = await fixture();
    assert.ok((await worker.candidates(100)).includes(a.job.id));
    const attempts = await Promise.all([worker.claim(a.job.id), worker.claim(a.job.id)]);
    assert.equal(attempts.filter(Boolean).length, 1);
    const l = attempts.find((x) => x !== null);
    assert.ok(l);
    const stored = await row(a.job.id);
    assert.equal(stored.attempts, 1);
    assert.equal(stored.leaseTokenDigest === l.token, false);
    assert.ok(l.expiresAt <= stored.expiresAt);
    assert.equal((await worker.candidates(100)).includes(a.job.id), false);
    assert.equal(await worker.claim(a.job.id), null);
  });

  it("claims different accounts independently and prepares only the right payload", async () => {
    const a = await fixture(),
      b = await fixture(true);
    const [first, second] = await Promise.all([lease(a.job.id), lease(b.job.id)]);
    const prepared = await worker.prepare(first, cipher);
    assert.ok(prepared);
    assert.equal(prepared.recipient === a.input.email, true);
    const [proof] = await db
      .select()
      .from(authChallenges)
      .where(eq(authChallenges.id, a.job.challengeId));
    assert.equal(
      digestAccountChallenge("email_verify", prepared.token) === proof.tokenDigest,
      true,
    );
    assert.equal(prepared.id, a.job.id);
    assert.equal(prepared.sendBefore.getTime(), first.expiresAt.getTime());
    assert.equal(await worker.prepare({ ...first, id: second.id }, cipher), null);
    assert.equal(await worker.settle({ ...first, id: second.id }, "accepted"), false);
    assert.ok(await worker.prepare(second, cipher));
    assert.equal((await authService.getSession(a.currentToken))?.id, a.userId);
  });

  it("rejects malformed worker inputs without mutating pending mail", async () => {
    const a = await fixture();
    await assert.rejects(worker.candidates(0));
    await assert.rejects(worker.candidates(101));
    await assert.rejects(worker.discardUnavailable(0));
    await assert.rejects(worker.claim("/invalid"));
    const bad = { id: a.job.id, token: "bad", attempt: 0, expiresAt: new Date() };
    await assert.rejects(worker.prepare(bad, cipher));
    await assert.rejects(worker.settle(bad, "accepted"));
    assert.equal((await row(a.job.id)).attempts, 0);
  });

  it("recovers a committed claim after killing its worker process, rejecting the stale owner", async () => {
    const a = await fixture();
    const child = fork(
      resolve(process.cwd(), "packages/db/src/repositories/account-mail-worker.fixture.ts"),
      [a.job.id],
      {
        execArgv: ["--import", "tsx"],
        stdio: ["ignore", "pipe", "pipe", "ipc"],
        env: { ...process.env, NODE_ENV: "test" },
      },
    );
    child.stdout?.resume();
    child.stderr?.resume(); // Drain without recording sensitive IPC/child output.
    const exited = new Promise<void>((resolveExit) => child.once("exit", () => resolveExit()));
    let first: MailLease | undefined;
    try {
      first = await new Promise<MailLease>((resolveLease, reject) => {
        const timer = setTimeout(() => reject(new Error("Claim fixture timed out")), 8000);
        child.once("error", () => {
          clearTimeout(timer);
          reject(new Error("Claim fixture failed"));
        });
        child.once("exit", () => {
          clearTimeout(timer);
          reject(new Error("Claim fixture exited before handoff"));
        });
        child.once("message", (value: unknown) => {
          clearTimeout(timer);
          const result = value as { lease?: MailLease };
          if (!result.lease) reject(new Error("Claim fixture did not reserve its job"));
          else resolveLease({ ...result.lease, expiresAt: new Date(result.lease.expiresAt) });
        });
      });
    } finally {
      child.kill("SIGKILL");
      await exited;
    }
    if (!first) throw new Error("Claim fixture did not return a lease");
    assert.equal((await row(a.job.id)).attempts, 1);
    await expireLease(a.job.id); // Accelerated expiry; the process stop above is real.
    const replacement = new AccountMailWorkerRepository();
    const second = await replacement.claim(a.job.id);
    assert.ok(second);
    assert.equal(second.attempt, 2);
    assert.equal(second.token === first.token, false);
    assert.equal(await replacement.prepare(first, cipher), null);
    assert.equal(await replacement.settle(first, "accepted"), false);
    assert.equal(await replacement.settle(first, "retry"), false);
    assert.ok(
      await replacement.prepare(second, new AccountMailCipher("d2b_test", { d2b_test: key })),
    );
  }, 15_000);

  for (const operation of ["prepare", "settle"] as const) {
    it(`${operation}: handles an expired lease after a later outbox lock wait`, async () => {
      const a = await fixture();
      const l = await lease(a.job.id);
      const result = await afterWait<unknown>(
        (tx) =>
          tx
            .select()
            .from(accountMailOutbox)
            .where(eq(accountMailOutbox.id, a.job.id))
            .for("update"),
        () => (operation === "prepare" ? worker.prepare(l, cipher) : worker.settle(l, "accepted")),
        (tx) =>
          tx
            .update(accountMailOutbox)
            .set({ leaseExpiresAt: sql`clock_timestamp() - interval '1 millisecond'` })
            .where(eq(accountMailOutbox.id, a.job.id)),
      );
      if (operation === "prepare") {
        // Preparing must not trust the expired lease: the row stays queued and
        // a fresh lease increments the attempt counter.
        assert.equal(result, null);
        assert.ok(await row(a.job.id));
        assert.equal((await events(a.job.id)).length, 0);
        const next = await lease(a.job.id);
        assert.equal(next.attempt, 2);
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
});
