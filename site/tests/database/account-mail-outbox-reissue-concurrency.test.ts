import assert from "node:assert/strict";
import { UnauthorizedError } from "@nexus/domain";
import { describe, it } from "vitest";
import { accountMailOutbox } from "../../packages/db/src/account-mail-schema";
import { db } from "../../packages/db/src/client";
import {
  AccountMailQueueFullError,
  account,
  auditId,
  capacity,
  cipher,
  clearDisposableOutbox,
  exists,
  issued,
  mail,
  pending,
  postgresCode,
  proofs,
  queue,
  settled,
  verification,
} from "../helpers/account-mail-outbox-harness";

describe("D2a atomic encrypted mail enqueue: reissue and concurrency", () => {
  it("reissue replaces only the old pending envelope and keeps its transaction atomic", async () => {
    const a = await account();
    const first = await queue.enqueue(verification(a), cipher);
    const old = await mail(first.id);
    const next = await queue.enqueue(verification(a), cipher);
    assert.equal(await exists(first.id), false);
    assert.equal(await exists(next.id), true);
    assert.equal((await pending(a)).length, 1);
    await assert.rejects(
      () =>
        proofs.consume(
          { ...verification(a), id: first.challengeId, token: old.decoded.token },
          async () => true,
        ),
      UnauthorizedError,
    );
  });

  it("rolls back reissue and outbox deletion on a real duplicate audit failure", async () => {
    const a = await account();
    const firstAudit = auditId();
    const first = await queue.enqueue(verification(a, firstAudit), cipher);
    const old = await mail(first.id);
    const failure = await settled(queue.enqueue(verification(a, firstAudit), cipher));
    assert.equal(failure.ok, false);
    if (!failure.ok) assert.equal(postgresCode(failure.error), "23505");
    assert.equal(await exists(first.id), true);
    assert.equal((await pending(a))[0].id, first.challengeId);
    assert.equal(
      JSON.stringify((await mail(first.id)).mail.payload) === JSON.stringify(old.mail.payload),
      true,
    );
    assert.equal((await issued(a)).length, 1);
  });

  it("enforces the last queue slot across two competing accounts", async () => {
    await clearDisposableOutbox();
    assert.equal(
      (await db.select().from(accountMailOutbox)).length,
      0,
      "Capacity test requires an empty disposable queue",
    );
    const a = await account();
    const b = await account();
    await capacity(1);
    const outcomes = await Promise.all([
      settled(queue.enqueue(verification(a), cipher)),
      settled(queue.enqueue(verification(b), cipher)),
    ]);
    assert.equal(outcomes.filter((r) => r.ok).length, 1);
    const failure = outcomes.find((r) => !r.ok);
    assert.ok(failure && !failure.ok);
    assert.ok(failure.error instanceof AccountMailQueueFullError);
    assert.equal((await db.select().from(accountMailOutbox)).length, 1);
    assert.equal((await pending(a)).length + (await pending(b)).length, 1);
    assert.equal((await issued(a)).length + (await issued(b)).length, 1);
  });

  it("a full queue preserves an earlier standalone proof rather than silently revoking it", async () => {
    await clearDisposableOutbox();
    assert.equal((await db.select().from(accountMailOutbox)).length, 0);
    const a = await account();
    const b = await account();
    const previous = await proofs.issue(verification(a));
    await capacity(1);
    const occupant = await queue.enqueue(verification(b), cipher);
    await assert.rejects(() => queue.enqueue(verification(a), cipher), AccountMailQueueFullError);
    assert.equal((await pending(a))[0].id, previous.id);
    assert.equal(await exists(occupant.id), true);
    assert.equal(await proofs.consume({ ...verification(a), ...previous }, async () => true), true);
  });

  it("two concurrent reissues leave only the final mail and proof pending", async () => {
    const a = await account();
    const jobs = await Promise.all([
      queue.enqueue(verification(a), cipher),
      queue.enqueue(verification(a), cipher),
    ]);
    const live = await Promise.all(jobs.map((j) => exists(j.id)));
    assert.equal(live.filter(Boolean).length, 1);
    assert.equal((await pending(a)).length, 1);
  });
});
