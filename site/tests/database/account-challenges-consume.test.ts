import { describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { UnauthorizedError } from "@nexus/domain";
import { db } from "../../packages/db/src/client";
import {
  accountRecoveryBindings,
  authChallenges,
} from "../../packages/db/src/account-recovery-schema";
import {
  account,
  auditId,
  bind,
  challenge,
  enrolled,
  events,
  noMutation,
  postgresCode,
  repo,
  reset,
  settled,
  unchanged,
  verification,
} from "../helpers/account-challenges-harness";

// Real PostgreSQL on disposable CI data. Never seed or write existing user data.
describe("D1 account proof primitives: consume", () => {
  it("consumes proof and synthetic binding atomically before a reset proof can be issued", async () => {
    const a = await account();
    const proof = await enrolled(a);
    expect((await challenge(proof.id)).consumedAt).not.toBeNull();
    const c = await repo.issue(reset(a));
    const row = await challenge(c.id);
    expect(row.expiresAt.getTime() - row.createdAt.getTime()).toBe(30 * 60_000);
    expect(row.bindingId).not.toBeNull();
    expect(row.initiatingSessionDigest).toBeNull();
    expect(await repo.consume({ ...reset(a), ...c }, noMutation)).toBe(true);
    await unchanged(a); // D1 is not a password reset implementation.
  });

  it("rejects incorrect tokens, accounts, identifiers and purposes without consuming a valid proof", async () => {
    const a = await account();
    const b = await account();
    await enrolled(a);
    const c = await repo.issue(verification(a));
    for (const input of [
      { ...verification(a), ...c, token: "invalid" },
      { ...verification(a), ...c, token: a.currentToken },
      { ...verification(b), ...c },
      { ...verification(a), ...c, id: "missing-proof" },
      { ...reset(a), ...c },
    ])
      await expect(repo.consume(input, noMutation)).rejects.toBeInstanceOf(UnauthorizedError);
    expect((await challenge(c.id)).consumedAt).toBeNull();
    expect(await repo.consume({ ...verification(a), ...c }, noMutation)).toBe(true);
  });

  for (const reason of ["expired", "revoked"] as const) {
    it(`rejects ${reason} proofs without applying the protected action`, async () => {
      const a = await account();
      const c = await repo.issue(verification(a));
      await db
        .update(authChallenges)
        .set(
          reason === "revoked"
            ? { revokedAt: sql`clock_timestamp()` }
            : {
                createdAt: sql`clock_timestamp() - interval '2 hours'`,
                expiresAt: sql`clock_timestamp() - interval '1 hour'`,
              },
        )
        .where(eq(authChallenges.id, c.id));
      let called = false;
      await expect(
        repo.consume({ ...verification(a), ...c }, async () => {
          called = true;
        }),
      ).rejects.toBeInstanceOf(UnauthorizedError);
      expect(called).toBe(false);
      expect((await challenge(c.id)).consumedAt).toBeNull();
    });
  }

  it("allows exactly one concurrent consume and one success audit, then rejects replay", async () => {
    const a = await account();
    const c = await repo.issue(verification(a));
    const results = await Promise.allSettled(
      [0, 1].map(() => repo.consume({ ...verification(a), ...c }, bind)),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect(await events(a)).toHaveLength(1);
    await expect(repo.consume({ ...verification(a), ...c }, noMutation)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(await events(a)).toHaveLength(1);
  });

  it("rolls back the callback writes and proof consumption if the callback rejects", async () => {
    const a = await account();
    const c = await repo.issue(verification(a));
    await expect(
      repo.consume({ ...verification(a), ...c }, async (tx, proof) => {
        await bind(tx, proof);
        throw new Error("Synthetic action failed");
      }),
    ).rejects.toThrow("Synthetic action failed");
    expect((await challenge(c.id)).consumedAt).toBeNull();
    expect(
      await db
        .select()
        .from(accountRecoveryBindings)
        .where(eq(accountRecoveryBindings.userId, a.userId)),
    ).toHaveLength(0);
    expect(await events(a)).toHaveLength(0);
    expect(await repo.consume({ ...verification(a), ...c }, bind)).toBe(true);
  });

  it("audit-write conflict rolls back the actual protected write and token consumption together", async () => {
    const a = await account();
    const usedAudit = auditId();
    const c = await repo.issue(verification(a, usedAudit));
    const result = await settled(repo.consume({ ...verification(a, usedAudit), ...c }, bind));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(postgresCode(result.error)).toBe("23505");
    expect((await challenge(c.id)).consumedAt).toBeNull();
    expect(
      await db
        .select()
        .from(accountRecoveryBindings)
        .where(eq(accountRecoveryBindings.userId, a.userId)),
    ).toHaveLength(0);
    expect(await events(a)).toHaveLength(0);
    await unchanged(a);
  });
});
