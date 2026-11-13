import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { UnauthorizedError } from "@nexus/domain";
import { generateSessionToken, hashPassword } from "@nexus/security";
import { eq } from "drizzle-orm";
import { describe, it } from "vitest";
import { authService } from "../site/src/lib/services/auth-service";
import { accountRecoveryBindings } from "../packages/db/src/account-recovery-schema";
import { auditEvents, db } from "../packages/db/src/client";
import { authRepository } from "../packages/db/src/repositories/auth";
import { userRepository } from "../packages/db/src/repositories/users";
import {
  account,
  auditId,
  cipher,
  digestAccountChallenge,
  exists,
  issued,
  mail,
  password,
  pending,
  postgresCode,
  proofs,
  queue,
  settled,
  verification,
} from "./helpers/account-mail-outbox-harness";

describe("D2a atomic encrypted mail enqueue: consumption and password", () => {
  it("consuming a verification removes its envelope, then allows a bound reset envelope", async () => {
    const a = await account();
    const first = await queue.enqueue(verification(a), cipher);
    const m = await mail(first.id);
    await proofs.consume(
      { ...verification(a), id: first.challengeId, token: m.decoded.token },
      async (tx, p) => {
        // Synthetic binding: no claim of proving a real mailbox or changing sessions.
        await tx.insert(accountRecoveryBindings).values({
          userId: p.userId,
          id: `rcb_${randomUUID()}`,
          verifiedEmail: p.email,
          proofVersion: 1,
          proofChallengeId: p.id,
        });
      },
    );
    assert.equal(await exists(first.id), false);
    const reset = await queue.enqueue(
      { purpose: "password_reset", userId: a.userId, auditId: auditId() },
      cipher,
    );
    const r = await mail(reset.id);
    assert.equal(r.proof.purpose, "password_reset");
    assert.equal(
      digestAccountChallenge("password_reset", r.decoded.token) === r.proof.tokenDigest,
      true,
    );
    assert.equal(r.proof.expiresAt.getTime() - r.proof.createdAt.getTime(), 30 * 60_000);
  });

  it("failed consumption restores both the queued ciphertext and the usable proof", async () => {
    const a = await account();
    const id = auditId();
    const first = await queue.enqueue(verification(a, id), cipher);
    const m = await mail(first.id);
    const failure = await settled(
      proofs.consume(
        { ...verification(a, id), id: first.challengeId, token: m.decoded.token },
        async () => true,
      ),
    );
    assert.equal(failure.ok, false);
    if (!failure.ok) assert.equal(postgresCode(failure.error), "23505");
    assert.equal(await exists(first.id), true);
    assert.equal((await pending(a))[0].consumedAt, null);
  });

  it("password and email changes discard queued mail; failed password changes restore it", async () => {
    const a = await account();
    const first = await queue.enqueue(verification(a), cipher);
    const [registered] = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.actorId, a.userId))
      .limit(1);
    const changedHash = await hashPassword("Synthetic-D2-next-password!");
    const failed = await settled(
      authRepository.changePassword({
        userId: a.userId,
        currentToken: a.currentToken,
        expectedPasswordHash: a.expectedPasswordHash,
        passwordHash: changedHash,
        nextToken: generateSessionToken(),
        audit: {
          id: registered.id,
          actorId: a.userId,
          actorType: "user",
          action: "user.password_changed",
          targetId: a.userId,
          targetType: "user",
        },
      }),
    );
    assert.equal(failed.ok, false);
    if (!failed.ok) assert.equal(postgresCode(failed.error), "23505");
    assert.equal(await exists(first.id), true);
    await authService.changePassword({
      userId: a.userId,
      currentToken: a.currentToken,
      currentPassword: password,
      newPassword: "Synthetic-D2-next-password!",
    });
    assert.equal(await exists(first.id), false);
    const b = await account();
    const bMail = await queue.enqueue(verification(b), cipher);
    await userRepository.update(b.userId, { email: `changed_${b.input.email}` });
    assert.equal(await exists(bMail.id), false);
  });

  it("never queues reset mail for an account without a verified binding", async () => {
    const a = await account();
    await userRepository.update(a.userId, { emailVerified: true, isVerified: true });
    await assert.rejects(
      () =>
        queue.enqueue({ purpose: "password_reset", userId: a.userId, auditId: auditId() }, cipher),
      UnauthorizedError,
    );
    assert.equal((await pending(a)).length, 0);
    assert.equal((await issued(a)).length, 0);
  });
});
