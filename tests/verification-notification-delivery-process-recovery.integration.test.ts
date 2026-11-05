import { expect, it, vi } from "vitest";
import {
  actor,
  apply,
  db,
  deferred,
  delivery,
  drain,
  eq,
  failInsert,
  isolated,
  jobs,
  ne,
  noticeId,
  notices,
  notifications,
  PENDING_LINK,
  ready,
  setupVerificationNotificationDelivery,
  source,
  users,
  VerificationNotificationDeliveryRepository,
} from "./helpers/verification-notification-delivery-harness";

setupVerificationNotificationDelivery();

it("resumes concurrent pages with stable IDs, preserved reads and generic content", async () => {
  const recipients = await Promise.all(Array.from({ length: 5 }, () => actor("moderator")));
  recipients.sort();
  const requesterId = await actor();
  const request = await apply(requesterId);
  await isolated(request.id);
  const originalTime = new Date("2000-06-01T00:00:00Z");
  await db.insert(notifications).values({
    id: noticeId(request.id, recipients[0]),
    recipientId: recipients[0],
    type: "security",
    category: "security",
    title: "New verification request",
    message: "A verification request is awaiting review.",
    link: PENDING_LINK,
    isRead: true,
    createdAt: originalTime,
  });
  await Promise.all([
    delivery.processNext(2),
    new VerificationNotificationDeliveryRepository().processNext(2),
  ]);
  expect([recipients[1], recipients[3]]).toContain((await source(request.id)).lastRecipientId);
  await drain(request.id, 2);
  const stored = await notices(request.id);
  expect(stored.map((row) => row.recipientId)).toEqual(recipients);
  expect(stored[0]).toMatchObject({ isRead: true, createdAt: originalTime });
  for (const row of stored.slice(1)) {
    expect(row).toMatchObject({
      title: "New verification request",
      message: "A verification request is awaiting review.",
      link: PENDING_LINK,
      category: "security",
    });
    expect(JSON.stringify(row)).not.toContain("PRIVATE_");
    expect(JSON.stringify(row)).not.toContain(requesterId);
    expect(JSON.stringify(row)).not.toContain(request.id);
  }
  expect((await source(request.id)).completedAt).not.toBeNull();
});

it("rolls back a failed page, bounds retries and resumes after an operator reset", async () => {
  const first = await actor("moderator", "aaa");
  const second = await actor("admin", "bbb");
  const requesterId = await actor();
  const request = await apply(requesterId);
  await isolated(request.id);
  const removeFailure = await failInsert("notifications", second);
  for (let attempt = 1; attempt <= 5; attempt++) {
    await ready(request.id);
    expect(await delivery.processNext(2)).toEqual({
      state: attempt === 5 ? "failed" : "retry",
      recipients: 0,
      stored: 0,
      pushDeferred: 0,
    });
    expect(await source(request.id)).toMatchObject({
      attempts: attempt,
      lastRecipientId: null,
      completedAt: null,
    });
    expect((await source(request.id)).availableAt.getTime()).toBeGreaterThan(Date.now());
    expect(await notices(request.id)).toEqual([]);
  }
  expect((await delivery.stats()).failed).toBeGreaterThanOrEqual(1);
  // Exhausted jobs stay unclaimed until an operator reset. Defer unrelated ready
  // rows so this assertion measures that property on a shared disposable DB.
  await db
    .update(jobs)
    .set({ availableAt: new Date("2099-01-01T00:00:00.000Z") })
    .where(ne(jobs.verificationRequestId, request.id));
  expect(await delivery.processNext(2)).toEqual({
    state: "idle",
    recipients: 0,
    stored: 0,
    pushDeferred: 0,
  });
  await removeFailure();
  await ready(request.id);
  await delivery.processNext(2);
  expect(await notices(request.id)).toEqual([]);
  await db.update(jobs).set({ attempts: 0 }).where(eq(jobs.verificationRequestId, request.id));
  await drain(request.id, 2);
  expect((await notices(request.id)).map((row) => row.recipientId)).toEqual([first, second]);
});

it("recovers a lost process before commit with no partial inbox or cursor", async () => {
  const recipient = await actor("moderator");
  const requesterId = await actor();
  const request = await apply(requesterId);
  await isolated(request.id);
  const original = db.transaction.bind(db);
  vi.spyOn(db, "transaction").mockImplementationOnce((run) =>
    original(async (tx) => {
      await run(tx);
      throw Error("SIMULATED_PROCESS_EXIT");
    }),
  );
  await expect(delivery.processNext()).rejects.toThrow("SIMULATED_PROCESS_EXIT");
  vi.restoreAllMocks();
  expect(await source(request.id)).toMatchObject({
    attempts: 0,
    lastRecipientId: null,
    completedAt: null,
  });
  expect(await notices(request.id)).toEqual([]);
  await drain(request.id);
  expect((await notices(request.id)).map((row) => row.recipientId)).toEqual([recipient]);
});

it("retries a locked recipient without advancing, then rechecks a committed demotion", async () => {
  const demoted = await actor("moderator", "aaa");
  const retained = await actor("admin", "bbb");
  const requesterId = await actor();
  const request = await apply(requesterId);
  await isolated(request.id);
  const locked = deferred();
  const release = deferred();
  const blocker = db.transaction(async (tx) => {
    await tx.update(users).set({ role: "user" }).where(eq(users.id, demoted));
    locked.resolve();
    await release.promise;
  });
  await Promise.race([locked.promise, blocker]);
  try {
    expect(await delivery.processNext(1)).toEqual({
      state: "retry",
      recipients: 0,
      stored: 0,
      pushDeferred: 0,
    });
    expect(await source(request.id)).toMatchObject({ attempts: 1, lastRecipientId: null });
    expect(await notices(request.id)).toEqual([]);
  } finally {
    release.resolve();
    await blocker;
  }
  await drain(request.id, 1);
  expect((await notices(request.id)).map((row) => row.recipientId)).toEqual([retained]);
});
