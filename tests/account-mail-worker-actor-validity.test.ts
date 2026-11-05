import assert from "node:assert/strict";
import { generateSessionToken } from "@nexus/security";
import { eq, sql } from "drizzle-orm";
import { afterEach, describe, it } from "vitest";
import { accountAuthState } from "../packages/db/src/account-recovery-schema";
import { db, sessions, users } from "../packages/db/src/client";
import { digestSessionToken } from "../packages/db/src/repositories/sessions";
import {
  afterWait,
  cipher,
  cleanupOwnedAccounts,
  type Fixture,
  fixture,
  lease,
  row,
  worker,
} from "./helpers/account-mail-worker-harness";

afterEach(cleanupOwnedAccounts);

describe("D2b account mail worker: actor validity", () => {
  const invalidators: Record<string, (a: Fixture) => Promise<unknown>> = {
    "revoked session": (a) =>
      db.delete(sessions).where(eq(sessions.token, digestSessionToken(a.currentToken))),
    "rotated session": (a) =>
      db
        .update(sessions)
        .set({ token: digestSessionToken(generateSessionToken()) })
        .where(eq(sessions.token, digestSessionToken(a.currentToken))),
    "expired session": (a) =>
      db
        .update(sessions)
        .set({ expiresAt: sql`clock_timestamp() - interval '1 second'` })
        .where(eq(sessions.token, digestSessionToken(a.currentToken))),
    "changed credential version": (a) =>
      db
        .update(accountAuthState)
        .set({ credentialVersion: 99 })
        .where(eq(accountAuthState.userId, a.userId)),
    "MFA enabled": (a) =>
      db.update(users).set({ twoFactorEnabled: true }).where(eq(users.id, a.userId)),
    "privileged role": (a) => db.update(users).set({ role: "admin" }).where(eq(users.id, a.userId)),
  };

  for (const [name, invalidate] of Object.entries(invalidators)) {
    it(`rechecks ${name} before exposing a leased email payload`, async () => {
      const a = await fixture();
      const l = await lease(a.job.id);
      await invalidate(a);
      assert.equal(await worker.prepare(l, cipher), null);
      assert.equal(await row(a.job.id), undefined);
      assert.equal(await worker.settle(l, "accepted"), false);
    });
  }

  it("checks actor validity after an observed wait on the user lock", async () => {
    const a = await fixture();
    const result = await afterWait(
      (tx) => tx.select().from(users).where(eq(users.id, a.userId)).for("update"),
      () => worker.claim(a.job.id),
      (tx) => tx.delete(sessions).where(eq(sessions.token, digestSessionToken(a.currentToken))),
    );
    assert.equal(result, null);
    assert.equal(await row(a.job.id), undefined);
  });
});
