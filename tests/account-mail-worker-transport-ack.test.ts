import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { afterEach, describe, it } from "vitest";
import { authChallenges } from "../packages/db/src/account-recovery-schema";
import { db } from "../packages/db/src/client";
import {
  cipher,
  cleanupOwnedAccounts,
  events,
  fixture,
  lease,
  postgresCode,
  row,
  settled,
  worker,
} from "./helpers/account-mail-worker-harness";

afterEach(cleanupOwnedAccounts);

describe("D2b account mail worker: transport acknowledgement", () => {
  it("records transport acceptance once and clears ciphertext without consuming the proof", async () => {
    const a = await fixture();
    const l = await lease(a.job.id);
    assert.equal(await worker.settle(l, "accepted"), true);
    assert.equal(await worker.settle(l, "accepted"), false);
    assert.equal(await row(a.job.id), undefined);
    const logged = await events(a.job.id);
    assert.equal(logged.length, 1);
    assert.equal(logged[0].action, "auth.mail_transport_accepted");
    assert.equal(JSON.stringify(logged).includes(a.input.email), false);
    assert.equal(JSON.stringify(logged).includes(l.token), false);
    const [proof] = await db
      .select()
      .from(authChallenges)
      .where(eq(authChallenges.id, a.job.challengeId));
    assert.equal(proof.consumedAt, null);
    assert.equal(proof.revokedAt, null);
  });

  for (const outcome of ["accepted", "retry", "discard"] as const) {
    it(`${outcome}: rolls back queue state when its outcome audit insert fails`, async () => {
      const a = await fixture();
      const l = await lease(a.job.id);
      const before = await row(a.job.id);
      const result = await settled(worker.settle(l, outcome, a.intent.auditId));
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(postgresCode(result.error), "23505");
      assert.deepEqual(await row(a.job.id), before);
      assert.equal((await events(a.job.id)).length, 0);
      assert.ok(await worker.prepare(l, cipher));
      assert.equal(await worker.settle(l, outcome), true);
    });
  }
});
