import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { UnauthorizedError } from "@nexus/domain";
import { generateSessionToken, hashPassword } from "@nexus/security";
import { db } from "../packages/db/src/client";
import { accountRecoveryBindings } from "../packages/db/src/account-recovery-schema";
import { authRepository } from "../packages/db/src/repositories/auth";
import { userRepository } from "../packages/db/src/repositories/users";
import { authService } from "../apps/web/src/lib/services/auth-service";
import {
  account,
  auditId,
  challenge,
  enrolled,
  noMutation,
  password,
  postgresCode,
  repo,
  reset,
  settled,
  unchanged,
  verification,
  version,
} from "./helpers/account-challenges-harness";

// Real PostgreSQL on disposable CI data. Never seed or write existing user data.
describe("D1 account proof primitives: credential invalidation", () => {
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
});
