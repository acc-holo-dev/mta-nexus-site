import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { UnauthorizedError } from "@nexus/domain";
import { db } from "../packages/db/src/client";
import { accountRecoveryBindings } from "../packages/db/src/account-recovery-schema";
import {
  account,
  challenge,
  enrolled,
  noMutation,
  repo,
  reset,
  verification,
} from "./helpers/account-challenges-harness";

// Real PostgreSQL on disposable CI data. Never seed or write existing user data.
describe("D1 account proof primitives: binding", () => {
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
});
