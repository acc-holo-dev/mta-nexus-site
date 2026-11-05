import assert from "node:assert/strict";
import { eq, sql } from "drizzle-orm";
import { afterEach, describe, it } from "vitest";
import { accountMailOutbox } from "../packages/db/src/account-mail-schema";
import { authChallenges } from "../packages/db/src/account-recovery-schema";
import { db, sessions } from "../packages/db/src/client";
import { digestSessionToken } from "../packages/db/src/repositories/sessions";
import {
  cipher,
  cleanupOwnedAccounts,
  events,
  expireLease,
  fixture,
  lease,
  makeDue,
  row,
  worker,
} from "./helpers/account-mail-worker-harness";

afterEach(cleanupOwnedAccounts);

describe("D2b account mail worker: backoff and retry", () => {
  it("persists backoff and retries the identical proof without extending its expiry", async () => {
    const a = await fixture();
    const first = await lease(a.job.id);
    const before = await row(a.job.id),
      message = await worker.prepare(first, cipher);
    assert.ok(message);
    assert.equal(await worker.settle(first, "retry"), true);
    const waiting = await row(a.job.id);
    assert.ok(waiting.availableAt > new Date());
    assert.equal(waiting.leaseTokenDigest, null);
    assert.equal(waiting.attempts, 1);
    assert.equal(await worker.claim(a.job.id), null);
    assert.equal(await worker.prepare(first, cipher), null);
    await makeDue(a.job.id);
    const second = await lease(a.job.id);
    assert.equal(second.attempt, 2);
    assert.equal(second.token === first.token, false);
    const next = await worker.prepare(second, cipher);
    assert.ok(next);
    assert.equal(next.token === message.token, true);
    assert.equal(next.id, message.id);
    assert.equal((await row(a.job.id)).expiresAt.getTime(), before.expiresAt.getTime());
    assert.equal(await worker.settle(first, "discard"), false);
  });

  it("ends retries at five acquisitions and does not spend or revoke the proof", async () => {
    const a = await fixture();
    for (let i = 1; i <= 5; i++) {
      const current = await lease(a.job.id);
      assert.equal(current.attempt, i);
      assert.equal(await worker.settle(current, "retry"), true);
      if (i < 5) await makeDue(a.job.id);
    }
    assert.equal(await row(a.job.id), undefined);
    const [proof] = await db
      .select()
      .from(authChallenges)
      .where(eq(authChallenges.id, a.job.challengeId));
    assert.equal(proof.consumedAt, null);
    assert.equal(proof.revokedAt, null);
    assert.equal(
      (await events(a.job.id)).filter((e) => e.action === "auth.mail_discarded").length,
      1,
    );
  });

  it("preserves a live fifth lease but cleans an abandoned exhausted job", async () => {
    const a = await fixture();
    await db
      .update(accountMailOutbox)
      .set({ attempts: 4 })
      .where(eq(accountMailOutbox.id, a.job.id));
    const final = await lease(a.job.id);
    assert.equal(final.attempt, 5);
    await worker.discardUnavailable();
    assert.ok(await row(a.job.id));
    await expireLease(a.job.id);
    await worker.discardUnavailable();
    assert.equal(await row(a.job.id), undefined);
    assert.equal(await worker.settle(final, "accepted"), false);
  });

  it("does not schedule a retry later than the initiating session lifetime", async () => {
    const a = await fixture();
    const l = await lease(a.job.id);
    await db
      .update(sessions)
      .set({ expiresAt: sql`clock_timestamp() + interval '2 seconds'` })
      .where(eq(sessions.token, digestSessionToken(a.currentToken)));
    assert.equal(await worker.settle(l, "retry"), true);
    assert.equal(await row(a.job.id), undefined);
  });
});
