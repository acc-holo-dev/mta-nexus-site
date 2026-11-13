import { describe, expect, it } from "vitest";
import { and, eq, isNull, sql } from "drizzle-orm";
import { setTimeout as delay } from "node:timers/promises";
import { UnauthorizedError } from "@nexus/domain";
import { generateSessionToken } from "@nexus/security";
import { db, sessions, users } from "../../site/packages/db/src/client";
import {
  accountRecoveryBindings,
  authChallenges,
} from "../../site/packages/db/src/account-recovery-schema";
import { digestSessionToken } from "../../site/packages/db/src/repositories/sessions";
import {
  account,
  afterWait,
  challenge,
  enrolled,
  events,
  noMutation,
  repo,
  reset,
  verification,
} from "../helpers/account-challenges-harness";

// Real PostgreSQL on disposable CI data. Never seed or write existing user data.
describe("D1 account proof primitives: lock wait", () => {
  it("two issuers serialize and leave exactly one unconsumed unrevoked proof", async () => {
    const a = await account();
    const issued = await Promise.all([repo.issue(verification(a)), repo.issue(verification(a))]);
    const pending = await db
      .select()
      .from(authChallenges)
      .where(
        and(
          eq(authChallenges.userId, a.userId),
          isNull(authChallenges.consumedAt),
          isNull(authChallenges.revokedAt),
        ),
      );
    expect(pending).toHaveLength(1);
    const pendingId = pending[0]?.id;
    if (!pendingId) throw new Error("Expected one pending proof");
    const winner = issued.find((c) => c.id === pendingId);
    const loser = issued.find((c) => c.id !== pendingId);
    if (!winner || !loser) throw new Error("Expected serialized winner and loser proofs");
    expect(await repo.consume({ ...verification(a), ...winner }, noMutation)).toBe(true);
    await expect(repo.consume({ ...verification(a), ...loser }, noMutation)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  for (const reason of ["revoked", "rotated", "expired"] as const) {
    it(`rechecks a ${reason} initiator after an observed user-lock wait`, async () => {
      const a = await account();
      const c = await repo.issue(verification(a));
      await afterWait(
        (tx) => tx.select().from(users).where(eq(users.id, a.userId)).for("update"),
        () => repo.consume({ ...verification(a), ...c }, noMutation),
        async (tx) => {
          const target = eq(sessions.token, digestSessionToken(a.currentToken));
          if (reason === "revoked") await tx.delete(sessions).where(target);
          if (reason === "rotated")
            await tx
              .update(sessions)
              .set({ token: digestSessionToken(generateSessionToken()) })
              .where(target);
          if (reason === "expired")
            await tx
              .update(sessions)
              .set({ expiresAt: sql`clock_timestamp() - interval '1 second'` })
              .where(target);
        },
      );
      expect((await challenge(c.id)).consumedAt).toBeNull();
      expect(await events(a)).toHaveLength(0);
    });
  }

  it("rechecks proof expiry after an observed challenge-row wait", async () => {
    const a = await account();
    const c = await repo.issue(verification(a));
    await afterWait(
      (tx) => tx.select().from(authChallenges).where(eq(authChallenges.id, c.id)).for("update"),
      () => repo.consume({ ...verification(a), ...c }, noMutation),
      (tx) =>
        tx
          .update(authChallenges)
          .set({
            createdAt: sql`clock_timestamp() - interval '2 hours'`,
            expiresAt: sql`clock_timestamp() - interval '1 hour'`,
          })
          .where(eq(authChallenges.id, c.id)),
    );
    expect((await challenge(c.id)).consumedAt).toBeNull();
  });

  it("rechecks initiating-session time after the later challenge lock, not only the user lock", async () => {
    const a = await account();
    const c = await repo.issue(verification(a));
    await db
      .update(sessions)
      .set({ expiresAt: sql`clock_timestamp() + interval '100 milliseconds'` })
      .where(eq(sessions.token, digestSessionToken(a.currentToken)));
    await afterWait(
      (tx) => tx.select().from(authChallenges).where(eq(authChallenges.id, c.id)).for("update"),
      () => repo.consume({ ...verification(a), ...c }, noMutation),
      // The lock wait is already observed. This deliberate time advance tests
      // expiry, not guessed request ordering; no application clock mocking.
      async () => {
        await delay(150);
      },
    );
    expect((await challenge(c.id)).consumedAt).toBeNull();
  });

  it("rechecks a deleted binding after waiting for the user lock", async () => {
    const a = await account();
    await enrolled(a);
    const c = await repo.issue(reset(a));
    await afterWait(
      (tx) => tx.select().from(users).where(eq(users.id, a.userId)).for("update"),
      () => repo.consume({ ...reset(a), ...c }, noMutation),
      (tx) =>
        tx.delete(accountRecoveryBindings).where(eq(accountRecoveryBindings.userId, a.userId)),
    );
    expect((await challenge(c.id)).consumedAt).toBeNull();
  });
});
