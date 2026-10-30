import { describe, expect, it } from "vitest";
import { and, eq, isNull, sql } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { UnauthorizedError } from "@nexus/domain";
import { generateId, generateSessionToken, hashPassword } from "@nexus/security";
import { db, auditEvents, sessions, users } from "../client";
import {
  accountAuthState,
  accountRecoveryBindings,
  authChallenges,
} from "../account-recovery-schema";
import { accountChallengeRepository as repo, digestAccountChallenge } from "./account-challenges";
import type { ConsumedProof } from "./account-challenges";
import { authRepository } from "./auth";
import { userRepository } from "./users";
import { digestSessionToken } from "./sessions";
import { authService } from "../../../../apps/web/src/lib/services/auth-service";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const password = "Synthetic-D1-known-password!";
const auditId = () => generateId("aud");
async function account() {
  const username = `d1_${generateId("usr").slice(-18)}`;
  const input = { username, email: `${username}@example.invalid`, password };
  const first = await authService.register(input);
  const second = await authService.login(input);
  const stored = await userRepository.findByEmail(input.email);
  if (!stored?.passwordHash) throw new Error("Synthetic fixture missing password hash");
  return {
    userId: first.user.id,
    currentToken: first.token,
    otherToken: second.token,
    expectedPasswordHash: stored.passwordHash,
    input,
  };
}
type Account = Awaited<ReturnType<typeof account>>;
const verification = (a: Account, id = auditId()) => ({
  purpose: "email_verify" as const,
  userId: a.userId,
  currentToken: a.currentToken,
  expectedPasswordHash: a.expectedPasswordHash,
  auditId: id,
});
const reset = (a: Account, id = auditId()) => ({
  purpose: "password_reset" as const,
  userId: a.userId,
  auditId: id,
});
const noMutation = async () => true;
async function bind(tx: Tx, proof: ConsumedProof) {
  // A synthetic DB action, not an implemented email/HTTP flow. No passwords,
  // sessions, email flags or privileges are changed by this fixture callback.
  if (proof.purpose !== "email_verify") throw new Error("Wrong fixture purpose");
  await tx.insert(accountRecoveryBindings).values({
    userId: proof.userId,
    id: `rcb_${randomUUID()}`,
    verifiedEmail: proof.email,
    proofVersion: 1,
    proofChallengeId: proof.id,
  });
  return true;
}
async function enrolled(a: Account) {
  const c = await repo.issue(verification(a));
  await repo.consume({ ...verification(a), ...c }, bind);
  return c;
}
async function challenge(id: string) {
  const [row] = await db.select().from(authChallenges).where(eq(authChallenges.id, id));
  return row;
}
async function version(a: Account) {
  const [row] = await db
    .select()
    .from(accountAuthState)
    .where(eq(accountAuthState.userId, a.userId));
  return row?.credentialVersion ?? 0;
}
async function events(a: Account, action = "auth.challenge_consumed") {
  return db
    .select()
    .from(auditEvents)
    .where(and(eq(auditEvents.actorId, a.userId), eq(auditEvents.action, action)));
}
async function unchanged(a: Account) {
  expect(
    (await userRepository.findByEmail(a.input.email))?.passwordHash === a.expectedPasswordHash,
  ).toBe(true);
  expect((await authService.getSession(a.currentToken))?.id === a.userId).toBe(true);
  expect((await authService.getSession(a.otherToken))?.id === a.userId).toBe(true);
}
function postgresCode(error: unknown): string | undefined {
  for (let i = 0; i < 6 && typeof error === "object" && error !== null; i++) {
    if ("code" in error && typeof error.code === "string") return error.code;
    error = "cause" in error ? error.cause : null;
  }
}
async function settled<T>(p: Promise<T>) {
  try {
    return { ok: true as const, value: await p };
  } catch (error) {
    return { ok: false as const, error };
  }
}
async function afterWait(
  lock: (tx: Tx) => Promise<unknown>,
  operation: () => Promise<unknown>,
  invalidate: (tx: Tx) => Promise<unknown>,
) {
  let pending: ReturnType<typeof settled<unknown>> | undefined;
  let completed = false;
  try {
    await db.transaction(async (tx) => {
      await lock(tx);
      const rows = await tx.execute(sql`select pg_backend_pid() as pid`);
      const pid = Number(rows[0].pid);
      pending = settled(operation()).then((r) => {
        completed = true;
        return r;
      });
      const deadline = Date.now() + 3000;
      for (;;) {
        expect(completed, "The proof operation must really wait for the held lock").toBe(false);
        const waiting = await db.execute(sql`select exists (
          select 1 from pg_stat_activity where ${pid}::integer = any(pg_blocking_pids(pid))
        ) as waiting`);
        if (waiting[0].waiting === true) break;
        if (Date.now() >= deadline) throw new Error("No database lock wait observed");
        await delay(10);
      }
      await invalidate(tx);
    });
  } finally {
    if (pending) await pending;
  }
  if (!pending) throw new Error("Queued operation was not started");
  const result = await pending;
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error).toBeInstanceOf(UnauthorizedError);
}

// Real PostgreSQL on disposable CI data. Never seed or write existing user data.
describe("D1 account proof primitives", () => {
  it("rehearses the additive migration with existing users/sessions and trusts no legacy flag", async () => {
    const schema = `d1_${randomUUID().replaceAll("-", "")}`;
    const migration = readFileSync(
      resolve(process.cwd(), "packages/db/migrations/0012_account_recovery_proofs.sql"),
      "utf8",
    );
    await db.transaction(async (tx) => {
      await tx.execute(sql.raw(`CREATE SCHEMA "${schema}"`));
      await tx.execute(sql.raw(`SET LOCAL search_path TO "${schema}"`));
      await tx.execute(
        sql`CREATE TABLE users (id text PRIMARY KEY, email text, password_hash text, email_verified boolean)`,
      );
      await tx.execute(sql`CREATE TABLE sessions (id text PRIMARY KEY, user_id text, token text)`);
      await tx.execute(
        sql`INSERT INTO users VALUES ('legacy', 'legacy@example.invalid', 'unchanged-hash', true)`,
      );
      await tx.execute(
        sql`INSERT INTO sessions VALUES ('legacy-session', 'legacy', 'unchanged-digest')`,
      );
      for (const part of migration.split("--> statement-breakpoint")) {
        if (part.trim()) await tx.execute(sql.raw(part));
      }
      const legacy = await tx.execute(sql`SELECT * FROM users`);
      expect(legacy[0]).toMatchObject({
        id: "legacy",
        email: "legacy@example.invalid",
        password_hash: "unchanged-hash",
        email_verified: true,
      });
      const oldSessions = await tx.execute(sql`SELECT * FROM sessions`);
      expect(oldSessions).toHaveLength(1);
      expect(oldSessions[0].token === "unchanged-digest").toBe(true);
      for (const table of ["account_auth_state", "account_recovery_bindings", "auth_challenges"]) {
        expect((await tx.execute(sql.raw(`SELECT * FROM "${table}"`))).length).toBe(0);
      }
      await tx.execute(
        sql`UPDATE users SET password_hash = 'new-synthetic-hash' WHERE id = 'legacy'`,
      );
      const state = await tx.execute(
        sql`SELECT credential_version FROM account_auth_state WHERE user_id = 'legacy'`,
      );
      expect(state[0].credential_version).toBe(1);
      await tx.execute(sql.raw(`DROP SCHEMA "${schema}" CASCADE`));
    });
  });

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

  it("binding provenance must refer to an actually consumed verification for this account", async () => {
    const a = await account();
    const c = await repo.issue(verification(a));
    await db.insert(accountRecoveryBindings).values({
      userId: a.userId,
      id: `rcb_${randomUUID()}`,
      verifiedEmail: a.input.email,
      proofVersion: 1,
      proofChallengeId: c.id,
    });
    await expect(repo.issue(reset(a))).rejects.toBeInstanceOf(UnauthorizedError);
    const b = await account();
    const otherProof = await repo.issue(verification(b));
    await repo.consume({ ...verification(b), ...otherProof }, noMutation);
    await db
      .update(accountRecoveryBindings)
      .set({ proofChallengeId: otherProof.id })
      .where(eq(accountRecoveryBindings.userId, a.userId));
    await expect(repo.issue(reset(a))).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("a changed binding ID rejects an outstanding reset even when the email is unchanged", async () => {
    const a = await account();
    await enrolled(a);
    const c = await repo.issue(reset(a));
    await db
      .update(accountRecoveryBindings)
      .set({ id: `rcb_${randomUUID()}` })
      .where(eq(accountRecoveryBindings.userId, a.userId));
    await expect(repo.consume({ ...reset(a), ...c }, noMutation)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect((await challenge(c.id)).consumedAt).toBeNull();
  });

  it("known-password change invalidates old proofs without losing the verified binding", async () => {
    const a = await account();
    await enrolled(a);
    const c = await repo.issue(reset(a));
    const before = await version(a);
    await authService.changePassword({
      userId: a.userId,
      currentToken: a.currentToken,
      currentPassword: password,
      newPassword: "Synthetic-D1-new-password!",
    });
    expect(await version(a)).toBe(before + 1);
    expect((await challenge(c.id)).revokedAt).not.toBeNull();
    await expect(repo.consume({ ...reset(a), ...c }, noMutation)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect((await repo.issue(reset(a))).id === c.id).toBe(false);
  });

  it("password transaction failure also rolls back the trigger version and proof revocation", async () => {
    const a = await account();
    const usedAudit = auditId();
    const c = await repo.issue(verification(a, usedAudit));
    const before = await version(a);
    const result = await settled(
      authRepository.changePassword({
        userId: a.userId,
        expectedPasswordHash: a.expectedPasswordHash,
        passwordHash: await hashPassword("Synthetic-D1-rollback-password!"),
        currentToken: a.currentToken,
        nextToken: generateSessionToken(),
        audit: {
          id: usedAudit,
          actorId: a.userId,
          actorType: "user",
          action: "user.password_changed",
          targetId: a.userId,
          targetType: "user",
        },
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(postgresCode(result.error)).toBe("23505");
    expect(await version(a)).toBe(before);
    expect((await challenge(c.id)).revokedAt).toBeNull();
    await unchanged(a);
    expect(await repo.consume({ ...verification(a), ...c }, noMutation)).toBe(true);
  });

  it("email changes including change-away-and-back remove bindings and invalidate all pending purposes", async () => {
    const a = await account();
    await enrolled(a);
    const r = await repo.issue(reset(a));
    const v = await repo.issue(verification(a));
    const before = await version(a);
    await userRepository.update(a.userId, { email: `changed_${a.input.email}` });
    await userRepository.update(a.userId, { email: a.input.email });
    expect(await version(a)).toBe(before + 2);
    for (const c of [r, v]) expect((await challenge(c.id)).revokedAt).not.toBeNull();
    expect(
      await db
        .select()
        .from(accountRecoveryBindings)
        .where(eq(accountRecoveryBindings.userId, a.userId)),
    ).toHaveLength(0);
    await expect(repo.issue(reset(a))).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("profile updates and no-op password assignments do not invalidate unrelated confirmations", async () => {
    const a = await account();
    const c = await repo.issue(verification(a));
    const before = await version(a);
    await userRepository.update(a.userId, {
      displayName: "Changed display name",
      activeContextId: "personal",
    });
    await userRepository.updatePassword(a.userId, a.expectedPasswordHash);
    expect(await version(a)).toBe(before);
    expect((await challenge(c.id)).revokedAt).toBeNull();
    expect(await repo.consume({ ...verification(a), ...c }, noMutation)).toBe(true);
  });

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
