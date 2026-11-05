import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterEach, describe, it } from "vitest";
import { accountMailOutbox } from "../packages/db/src/account-mail-schema";
import {
  accountRecoveryBindings,
  authChallenges,
} from "../packages/db/src/account-recovery-schema";
import { db, users } from "../packages/db/src/client";
import {
  AccountMailCipher,
  AccountMailKeyUnavailableError,
} from "../packages/db/src/repositories/account-mail-crypto";
import { accountMailOutboxRepository as queue } from "../packages/db/src/repositories/account-mail-outbox";
import {
  account,
  afterWait,
  auditId,
  cipher,
  cleanupOwnedAccounts,
  fixture,
  lease,
  proofs,
  row,
  verification,
  worker,
} from "./helpers/account-mail-worker-harness";

afterEach(cleanupOwnedAccounts);

describe("D2b account mail worker: proof and reissue", () => {
  for (const mode of ["removed", "replaced", "foreign proof"] as const) {
    it(`rejects a reset delivery whose binding was ${mode}`, async () => {
      const a = await fixture(true);
      const l = await lease(a.job.id);
      if (mode === "removed")
        await db
          .delete(accountRecoveryBindings)
          .where(eq(accountRecoveryBindings.userId, a.userId));
      if (mode === "replaced")
        await db
          .update(accountRecoveryBindings)
          .set({ id: `rcb_${randomUUID()}` })
          .where(eq(accountRecoveryBindings.userId, a.userId));
      if (mode === "foreign proof") {
        const b = await account();
        const other = await proofs.issue(verification(b));
        await proofs.consume({ ...verification(b), ...other }, async () => true);
        await db
          .update(accountRecoveryBindings)
          .set({ proofChallengeId: other.id })
          .where(eq(accountRecoveryBindings.userId, a.userId));
      }
      assert.equal(await worker.prepare(l, cipher), null);
      assert.equal(await row(a.job.id), undefined);
    });
  }

  it("fails closed on missing keys and on a validly encrypted but wrong token", async () => {
    const a = await fixture();
    const l = await lease(a.job.id);
    const before = await row(a.job.id);
    // A cipher whose key ring lacks the envelope keyId fails closed before any
    // decryption is attempted.
    await assert.rejects(
      worker.prepare(l, new AccountMailCipher("other", { other: randomBytes(32) })),
      (error: unknown) => error instanceof AccountMailKeyUnavailableError,
    );
    assert.deepEqual(await row(a.job.id), before);
    const [proof] = await db
      .select()
      .from(authChallenges)
      .where(eq(authChallenges.id, a.job.challengeId));
    const payload = cipher.seal(
      {
        id: a.job.id,
        challengeId: proof.id,
        userId: a.userId,
        purpose: proof.purpose,
        expiresAt: before.expiresAt,
      },
      { recipient: a.input.email, token: randomBytes(32).toString("base64url") },
    );
    await db.update(accountMailOutbox).set({ payload }).where(eq(accountMailOutbox.id, a.job.id));
    await assert.rejects(worker.prepare(l, cipher), {
      message: "Account mail payload is unavailable",
    });
    assert.equal(await worker.settle(l, "discard"), true);
  });

  it("reissue cancels even leased mail and the stale owner cannot acknowledge the replacement", async () => {
    const a = await fixture();
    const old = await lease(a.job.id);
    const replacement = await queue.enqueue(verification(a), cipher);
    assert.equal(await worker.prepare(old, cipher), null);
    assert.equal(await worker.settle(old, "accepted"), false);
    assert.ok(await row(replacement.id));
    assert.equal((await row(replacement.id)).attempts, 0);
  });

  it("proof consumption discards leased ciphertext and failed consumption restores it", async () => {
    const a = await fixture();
    const l = await lease(a.job.id);
    const prepared = await worker.prepare(l, cipher);
    assert.ok(prepared);
    const request = { ...verification(a), id: a.job.challengeId, token: prepared.token };
    await assert.rejects(
      proofs.consume(request, async () => {
        throw new Error("Synthetic action failure");
      }),
    );
    assert.ok(await worker.prepare(l, cipher));
    await proofs.consume({ ...request, auditId: auditId() }, async () => true);
    assert.equal(await row(a.job.id), undefined);
    assert.equal(await worker.settle(l, "accepted"), false);
  });

  it("checks proof expiry after a real wait and cleans only the encrypted mail", async () => {
    const a = await fixture();
    const result = await afterWait(
      (tx) => tx.select().from(users).where(eq(users.id, a.userId)).for("update"),
      () => worker.claim(a.job.id),
      async (tx) => {
        await tx
          .update(authChallenges)
          .set({
            createdAt: sql`clock_timestamp() - interval '2 days'`,
            expiresAt: sql`clock_timestamp() - interval '1 day'`,
          })
          .where(eq(authChallenges.id, a.job.challengeId));
      },
    );
    assert.equal(result, null);
    assert.equal(await row(a.job.id), undefined);
    assert.equal(
      (await db.select().from(authChallenges).where(eq(authChallenges.id, a.job.challengeId)))
        .length,
      1,
    );
  });
});
