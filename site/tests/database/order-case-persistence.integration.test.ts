import { randomBytes, randomUUID } from "node:crypto";
import { and, count, eq, sql } from "drizzle-orm";
import { expect, it } from "vitest";
import {
  db,
  userRepository,
  sessionRepository,
  sessions,
  orderCasesRepository as repo,
} from "@nexus/db";
import {
  auditEvents,
  commerceOrderCases,
  notifications,
  orders,
  payments,
  supportCases,
  supportCaseMessages,
} from "../../packages/db/src/schema";

// Requires disposable PostgreSQL migrated through 0052. The completed payment
// below is a recorded fixture only; no provider or financial executor is called.
async function fixture() {
  const suffix = randomBytes(6).toString("hex"),
    buyerId = `usr_oc_${suffix}`,
    staffId = `usr_os_${suffix}`,
    orderId = `ord_oc_${suffix}`;
  for (const [id, role] of [
    [buyerId, "user"],
    [staffId, "admin"],
  ] as const)
    await userRepository.create({
      id,
      role,
      email: `${id}@example.invalid`,
      username: id,
      displayName: "Order support fixture",
    });
  const staffToken = `staff-token-${suffix}`;
  await sessionRepository.create({
    id: `ses_oc_${suffix}`,
    userId: staffId,
    token: staffToken,
    expiresAt: new Date(Date.now() + 3600000),
  });
  await db.insert(orders).values({
    id: orderId,
    orderNumber: `case-${suffix}`,
    buyerId,
    status: "completed",
    totalAmount: 1200,
    currency: "USD",
  });
  await db.insert(payments).values({
    id: `pay_oc_${suffix}`,
    orderId,
    status: "completed",
    amount: 1200,
    currency: "USD",
    provider: "recorded-fixture",
    providerTransactionId: "must-not-be-projected",
  });
  const input = {
    orderId,
    actorId: buyerId,
    caseId: `sup_${randomBytes(12).toString("hex")}`,
    messageId: `spm_${suffix}`,
    auditId: `aud_oc_${suffix}`,
    command: {
      requestId: randomUUID(),
      kind: "refund_request" as const,
      subject: "Review purchase refund request",
      message: "Please investigate the recorded purchase.",
      requestedAmount: 600,
    },
  };
  await repo.create(input);
  return { suffix, buyerId, staffId, staffToken, orderId, input };
}
async function reviewInput(
  f: Awaited<ReturnType<typeof fixture>>,
  action: "start_review" | "recommend_refund" | "resolve" = "start_review",
) {
  const detail = await repo.detail(f.input.caseId, f.staffId, true);
  return {
    caseId: f.input.caseId,
    actorId: f.staffId,
    currentToken: f.staffToken,
    auditId: `aud_r_${randomBytes(8).toString("hex")}`,
    statusAuditId: `aud_s_${randomBytes(8).toString("hex")}`,
    messageId: `spm_r_${randomBytes(8).toString("hex")}`,
    command: {
      action,
      expectedRevision: detail.case.revision,
      expectedSupportUpdatedAt: detail.case.supportUpdatedAt.toISOString(),
      expectedEvidenceHash: detail.evidenceHash,
      notes: "Review of recorded financial evidence only",
    },
  };
}
it("replays intake without duplicate context or messages, and rejects a second request for the same order", async () => {
  const f = await fixture();
  const results = await Promise.all(
    Array.from({ length: 4 }, () =>
      repo.create({
        ...f.input,
        caseId: `sup_${randomBytes(12).toString("hex")}`,
        auditId: `aud_${randomBytes(10).toString("hex")}`,
      }),
    ),
  );
  expect(results.every((result) => result.caseId === f.input.caseId && result.replayed)).toBe(true);
  await expect(
    repo.create({ ...f.input, command: { ...f.input.command, requestId: randomUUID() } }),
  ).rejects.toMatchObject({ code: "ORDER_CASE_EXISTS" });
  expect(
    (
      await db
        .select({ total: count() })
        .from(supportCaseMessages)
        .where(eq(supportCaseMessages.caseId, f.input.caseId))
    )[0]?.total,
  ).toBe(1);
});
it("commits one competing review and rejects the stale reviewer", async () => {
  const f = await fixture(),
    input = await reviewInput(f);
  const results = await Promise.allSettled([
    repo.review(input),
    repo.review({
      ...input,
      auditId: `${input.auditId}_other`,
      statusAuditId: `${input.statusAuditId}_other`,
      messageId: `${input.messageId}_other`,
    }),
  ]);
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(
    (results.find((result) => result.status === "rejected") as PromiseRejectedResult).reason,
  ).toMatchObject({ code: "ORDER_CASE_REVISION_CONFLICT" });
  expect((await repo.detail(f.input.caseId, f.buyerId)).case.revision).toBe(2);
});
it("records a recommendation and notification without changing the order or recorded capture", async () => {
  const f = await fixture();
  await repo.review(await reviewInput(f));
  const beforeOrder = await db.select().from(orders).where(eq(orders.id, f.orderId)),
    beforePayments = await db.select().from(payments).where(eq(payments.orderId, f.orderId));
  const input = await reviewInput(f, "recommend_refund");
  expect(await repo.review(input)).toMatchObject({
    financialExecution: false,
    reviewStatus: "refund_recommended",
    threadStatus: "open",
  });
  expect(await db.select().from(orders).where(eq(orders.id, f.orderId))).toEqual(beforeOrder);
  expect(await db.select().from(payments).where(eq(payments.orderId, f.orderId))).toEqual(
    beforePayments,
  );
  const detail = await repo.detail(f.input.caseId, f.buyerId);
  expect(JSON.stringify(detail)).not.toContain("must-not-be-projected");
  expect(JSON.stringify(detail)).not.toContain("recorded-fixture");
  expect(
    (await db.select().from(notifications).where(eq(notifications.recipientId, f.buyerId))).length,
  ).toBeGreaterThan(0);
});
it("rejects SQL reassociation and immutable intake changes", async () => {
  const f = await fixture();
  await expect(
    db
      .update(commerceOrderCases)
      .set({ requestedAmount: 500 })
      .where(eq(commerceOrderCases.caseId, f.input.caseId)),
  ).rejects.toThrow();
  await expect(
    db
      .update(supportCases)
      .set({ requesterId: f.staffId })
      .where(eq(supportCases.id, f.input.caseId)),
  ).rejects.toThrow();
  await db
    .update(commerceOrderCases)
    .set({ revision: 99 })
    .where(eq(commerceOrderCases.caseId, f.input.caseId));
  expect((await repo.detail(f.input.caseId, f.buyerId)).case.revision).toBe(1);
  await expect(repo.detail(f.input.caseId, f.staffId, false)).rejects.toMatchObject({
    statusCode: 404,
  });
});
it("rolls review, shared status, message and notification back when auditing fails", async () => {
  const f = await fixture(),
    input = await reviewInput(f);
  await db.insert(auditEvents).values({
    id: input.auditId,
    actorId: f.staffId,
    actorType: "admin",
    action: "fixture",
    targetType: "support_case",
    targetId: f.input.caseId,
  });
  const before = await repo.detail(f.input.caseId, f.buyerId);
  await expect(repo.review(input)).rejects.toThrow();
  const after = await repo.detail(f.input.caseId, f.buyerId);
  expect(after.case).toEqual(before.case);
  expect(
    (
      await db
        .select({ total: count() })
        .from(supportCaseMessages)
        .where(eq(supportCaseMessages.caseId, f.input.caseId))
    )[0]?.total,
  ).toBe(1);
  expect(
    await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.recipientId, f.buyerId))),
  ).toHaveLength(0);
});

function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function waitBlocked(pid: number) {
  await expect
    .poll(
      async () => {
        const [row] = await db.execute<{ waiting: boolean }>(sql`select exists(
      select 1 from pg_stat_activity where datname=current_database()
      and ${pid}=any(pg_blocking_pids(pid)) and wait_event_type='Lock'
    ) as waiting`);
        return row.waiting;
      },
      { timeout: 5000, interval: 10 },
    )
    .toBe(true);
}
async function reviewState(f: Awaited<ReturnType<typeof fixture>>) {
  return {
    cases: await db
      .select()
      .from(commerceOrderCases)
      .where(eq(commerceOrderCases.caseId, f.input.caseId)),
    tickets: await db.select().from(supportCases).where(eq(supportCases.id, f.input.caseId)),
    messages: await db
      .select()
      .from(supportCaseMessages)
      .where(eq(supportCaseMessages.caseId, f.input.caseId)),
    audits: await db.select().from(auditEvents).where(eq(auditEvents.targetId, f.input.caseId)),
    notices: await db.select().from(notifications).where(eq(notifications.recipientId, f.buyerId)),
  };
}
it("rejects a revoked staff session after waiting for the order lock", async () => {
  const f = await fixture(),
    input = await reviewInput(f),
    before = await reviewState(f),
    locked = deferred(),
    release = deferred();
  let pid = 0;
  const blocker = db.transaction(async (tx) => {
    await tx.select().from(orders).where(eq(orders.id, f.orderId)).for("update");
    const [row] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
    pid = row.pid;
    locked.resolve();
    await release.promise;
  });
  await Promise.race([
    locked.promise,
    blocker.then(() => {
      throw new Error("Blocker exited before locking");
    }),
  ]);
  const pending = repo.review(input).then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  );
  try {
    await waitBlocked(pid);
    await sessionRepository.delete(f.staffToken);
  } finally {
    release.resolve();
    await blocker;
  }
  expect(await pending).toMatchObject({ error: { code: "UNAUTHORIZED" } });
  expect(await reviewState(f)).toEqual(before);
}, 15000);
it("rolls back review, status, message, audit and notice when session expires during an audit write", async () => {
  const f = await fixture(),
    input = await reviewInput(f),
    before = await reviewState(f),
    expiresAt = new Date(Date.now() + 2000),
    locked = deferred(),
    release = deferred();
  await db.update(sessions).set({ expiresAt }).where(eq(sessions.userId, f.staffId));
  let pid = 0;
  const blocker = db
    .transaction(async (tx) => {
      await tx.insert(auditEvents).values({
        id: input.auditId,
        actorId: f.staffId,
        actorType: "admin",
        targetType: "support_case",
        targetId: f.input.caseId,
        action: "fixture.collision",
        details: {},
      });
      const [row] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
      pid = row.pid;
      locked.resolve();
      await release.promise;
      throw new Error("rollback fixture blocker");
    })
    .catch((error: unknown) => {
      if (!(error instanceof Error) || error.message !== "rollback fixture blocker") throw error;
    });
  await Promise.race([
    locked.promise,
    blocker.then(() => {
      throw new Error("Blocker exited before locking");
    }),
  ]);
  const pending = repo.review(input).then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  );
  try {
    await waitBlocked(pid);
    await expect
      .poll(
        async () => {
          const [row] = await db.execute<{ expired: boolean }>(
            sql`select clock_timestamp()>=${expiresAt}::timestamptz as expired`,
          );
          return row.expired;
        },
        { timeout: 5000, interval: 10 },
      )
      .toBe(true);
  } finally {
    release.resolve();
    await blocker;
  }
  expect(await pending).toMatchObject({ error: { code: "UNAUTHORIZED" } });
  expect(await reviewState(f)).toEqual(before);
}, 15000);
