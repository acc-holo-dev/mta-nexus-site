import { describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { UnauthorizedError } from "@nexus/domain";
import { db, sessions } from "../../site/packages/db/src/client";
import { digestAccountChallenge } from "../../site/packages/db/src/repositories/account-challenges";
import { userRepository } from "../../site/packages/db/src/repositories/users";
import { digestSessionToken } from "../../site/packages/db/src/repositories/sessions";
import {
  account,
  auditId,
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
describe("D1 account proof primitives: issue", () => {
  it("issues opaque tokens, stores purpose-separated digests and never changes credentials", async () => {
    const a = await account();
    const c = await repo.issue(verification(a));
    const row = await challenge(c.id);
    expect(c.token.length).toBe(43);
    expect(row.tokenDigest === c.token).toBe(false);
    expect(row.tokenDigest === digestAccountChallenge("email_verify", c.token)).toBe(true);
    expect(digestAccountChallenge("password_reset", c.token) === row.tokenDigest).toBe(false);
    expect(row.expiresAt.getTime() - row.createdAt.getTime()).toBe(24 * 60 * 60_000);
    const issued = await events(a, "auth.challenge_issued");
    expect(issued).toHaveLength(1);
    expect(JSON.stringify(issued).includes(c.token)).toBe(false);
    expect(JSON.stringify(issued).includes(a.currentToken)).toBe(false);
    await unchanged(a);
  });

  it("does not issue reset tokens based on moderator or legacy email verification flags", async () => {
    const a = await account();
    await userRepository.update(a.userId, { emailVerified: true, isVerified: true });
    await expect(repo.issue(reset(a))).rejects.toBeInstanceOf(UnauthorizedError);
    expect(await events(a, "auth.challenge_issued")).toHaveLength(0);
    await unchanged(a);
  });

  it("requires the verified password snapshot and an owned live initiating session", async () => {
    const a = await account();
    const b = await account();
    for (const fields of [
      { currentToken: "" },
      { currentToken: b.currentToken },
      { expectedPasswordHash: "obsolete" },
      { userId: "missing-user" },
    ]) {
      await expect(repo.issue({ ...verification(a), ...fields })).rejects.toBeInstanceOf(
        UnauthorizedError,
      );
    }
    await db
      .update(sessions)
      .set({ expiresAt: sql`clock_timestamp() - interval '1 second'` })
      .where(eq(sessions.token, digestSessionToken(a.currentToken)));
    await expect(repo.issue(verification(a))).rejects.toBeInstanceOf(UnauthorizedError);
    expect(await events(a, "auth.challenge_issued")).toHaveLength(0);
  });

  it("does not introduce a recovery bypass for privileged or MFA accounts", async () => {
    const a = await account();
    for (const fields of [
      { role: "admin" as const },
      { role: "moderator" as const },
      { role: "user" as const, twoFactorEnabled: true },
    ]) {
      await userRepository.update(a.userId, fields);
      await expect(repo.issue(verification(a))).rejects.toBeInstanceOf(UnauthorizedError);
    }
    await unchanged(a);
  });

  it("reissue revokes only pending proofs of the same purpose and old links cannot replay", async () => {
    const a = await account();
    await enrolled(a);
    const r = await repo.issue(reset(a));
    const first = await repo.issue(verification(a));
    const second = await repo.issue(verification(a));
    expect(first.token === second.token).toBe(false);
    expect((await challenge(first.id)).revokedAt).not.toBeNull();
    await expect(repo.consume({ ...verification(a), ...first }, noMutation)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect((await challenge(r.id)).revokedAt).toBeNull();
    expect(await repo.consume({ ...verification(a), ...second }, noMutation)).toBe(true);
  });

  it("failed issue audit rolls back the replacement and retains the earlier valid proof", async () => {
    const a = await account();
    const usedAudit = auditId();
    const first = await repo.issue(verification(a, usedAudit));
    const result = await settled(repo.issue(verification(a, usedAudit)));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(postgresCode(result.error)).toBe("23505");
    expect((await challenge(first.id)).revokedAt).toBeNull();
    expect(await events(a, "auth.challenge_issued")).toHaveLength(1);
    expect(await repo.consume({ ...verification(a), ...first }, noMutation)).toBe(true);
  });
});
