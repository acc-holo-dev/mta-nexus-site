import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { UnauthorizedError } from "@nexus/domain";
import { eq, inArray, sql } from "drizzle-orm";
import { describe, it } from "vitest";
import {
  accountMailOutbox,
  accountMailQueueGate,
} from "../../site/packages/db/src/account-mail-schema";
import { authChallenges } from "../../site/packages/db/src/account-recovery-schema";
import { db, sessions } from "../../site/packages/db/src/client";
import { digestSessionToken } from "../../site/packages/db/src/repositories/sessions";
import {
  account,
  cipher,
  exists,
  issued,
  pending,
  queue,
  settled,
  verification,
} from "../helpers/account-mail-outbox-harness";

describe("D2a atomic encrypted mail enqueue: expiry and session", () => {
  it("bounded expiry cleanup removes old payloads but not live mail or proof provenance", async () => {
    const jobs = [];
    for (let i = 0; i < 4; i++)
      jobs.push(await queue.enqueue(verification(await account()), cipher));
    const expired = jobs.slice(0, 3).map((j) => j.id);
    await db
      .update(accountMailOutbox)
      .set({
        createdAt: sql`clock_timestamp() - interval '2 hours'`,
        expiresAt: sql`clock_timestamp() - interval '1 hour'`,
      })
      .where(inArray(accountMailOutbox.id, expired));
    assert.equal(await queue.discardExpired(2), 2);
    assert.equal(await queue.discardExpired(2), 1);
    assert.equal(await queue.discardExpired(2), 0);
    assert.equal(await exists(jobs[3].id), true);
    assert.equal(
      (
        await db
          .select()
          .from(authChallenges)
          .where(
            inArray(
              authChallenges.id,
              jobs.map((j) => j.challengeId),
            ),
          )
      ).length,
      4,
    );
    await assert.rejects(() => queue.discardExpired(101));
    await assert.rejects(() => queue.discardExpired(0));
  });

  it("rechecks session expiry after actually waiting for the queue gate", async () => {
    const a = await account();
    let operation: ReturnType<typeof settled<unknown>> | undefined;
    let finished = false;
    try {
      await db.transaction(async (tx) => {
        await tx
          .select()
          .from(accountMailQueueGate)
          .where(eq(accountMailQueueGate.singleton, true))
          .for("update");
        // Modify the synthetic session before starting the producer; never take
        // its session lock while that producer holds the user/session locks.
        await db
          .update(sessions)
          // TTL must outlive producer setup (user/session locks, challenge insert,
          // audit) so the gate wait is observed before checkSessionExpiry can
          // abort. 100ms raced under CI load after the suite-time cut; 1s keeps
          // most of that win without false "must wait" failures.
          .set({ expiresAt: sql`clock_timestamp() + interval '1 second'` })
          .where(eq(sessions.token, digestSessionToken(a.currentToken)));
        const [backend] = await tx.execute(sql`select pg_backend_pid() as pid`);
        operation = settled(queue.enqueue(verification(a), cipher)).then((v) => {
          finished = true;
          return v;
        });
        const deadline = Date.now() + 3000;
        for (;;) {
          assert.equal(finished, false, "Producer must wait for the queue gate");
          const [waiting] = await db.execute(sql`select exists (
            select 1 from pg_stat_activity where ${Number(backend.pid)}::integer = any(pg_blocking_pids(pid))
          ) as waiting`);
          if (waiting.waiting === true) break;
          if (Date.now() >= deadline) throw new Error("Expected queue gate wait was not observed");
          await delay(10);
        }
        // Wait for the measured DB deadline, not a guessed ordering delay.
        await tx.execute(sql`select pg_sleep(greatest(0, extract(epoch from (expires_at - clock_timestamp()))) + 0.02)
          from sessions where token = ${digestSessionToken(a.currentToken)}`);
      });
    } finally {
      if (operation) await operation;
    }
    assert.ok(operation);
    const result = await operation;
    assert.equal(result.ok, false);
    if (!result.ok) assert.ok(result.error instanceof UnauthorizedError);
    assert.equal((await pending(a)).length, 0);
    assert.equal((await issued(a)).length, 0);
    const rows = await db
      .select({ id: accountMailOutbox.id })
      .from(accountMailOutbox)
      .innerJoin(authChallenges, eq(accountMailOutbox.challengeId, authChallenges.id))
      .where(eq(authChallenges.userId, a.userId));
    assert.equal(rows.length, 0);
  });
});
