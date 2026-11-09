import { expect, it, vi } from "vitest";
import {
  actor,
  db,
  deferred,
  delivery,
  drain,
  eq,
  failInsert,
  fixture,
  inArray,
  isolated,
  jobs,
  noticeId,
  notices,
  notifications,
  ready,
  reply,
  SupportNotificationDeliveryRepository,
  setupSupportNotificationDelivery,
  source,
  staffCaseLink,
  users,
} from "../helpers/support-notification-delivery-harness";

setupSupportNotificationDelivery();

it("resumes concurrent pages with stable IDs, preserved reads and generic content", async () => {
  const recipients = await Promise.all(Array.from({ length: 5 }, () => actor("moderator")));
  recipients.sort();
  const f = await fixture();
  await f.create();
  await isolated(f.messageId);
  const originalTime = new Date("2000-06-01T00:00:00Z");
  await db.insert(notifications).values({
    id: noticeId(f.messageId, recipients[0]),
    recipientId: recipients[0],
    type: "system",
    category: "system",
    title: "New support case",
    message: "A support case is awaiting review.",
    isRead: true,
    createdAt: originalTime,
  });
  await Promise.all([
    delivery.processNext(2),
    new SupportNotificationDeliveryRepository().processNext(2),
  ]);
  expect([recipients[1], recipients[3]]).toContain((await source(f.messageId)).lastRecipientId);
  await drain(f.messageId, 2);
  const stored = await notices(f.messageId);
  expect(stored.map((row) => row.recipientId)).toEqual(recipients);
  expect(stored.map((row) => row.id)).toEqual(
    recipients.map((recipient) => noticeId(f.messageId, recipient)),
  );
  expect(stored[0]).toMatchObject({ isRead: true, createdAt: originalTime });
  for (const row of stored.slice(1)) {
    expect(row).toMatchObject({
      title: "New support case",
      message: "A support case is awaiting review.",
      link: staffCaseLink(f.caseId),
      category: "system",
    });
    expect(JSON.stringify(row)).not.toContain("PRIVATE_");
    expect(JSON.stringify(row)).not.toContain(f.requesterId);
    expect(JSON.stringify(row)).not.toContain(f.messageId);
  }
  expect((await source(f.messageId)).completedAt).not.toBeNull();
});

it("rolls back a failed page, bounds retries and resumes after an operator reset", async () => {
  const first = await actor("moderator", "aaa");
  const second = await actor("admin", "bbb");
  const f = await fixture();
  await f.create();
  await isolated(f.messageId);
  const removeFailure = await failInsert("notifications", second);
  for (let attempt = 1; attempt <= 5; attempt++) {
    await ready(f.messageId);
    expect(await delivery.processNext(2)).toEqual({
      state: attempt === 5 ? "failed" : "retry",
      recipients: 0,
      stored: 0,
      pushDeferred: 0,
    });
    expect(await source(f.messageId)).toMatchObject({
      attempts: attempt,
      lastRecipientId: null,
      completedAt: null,
    });
    expect((await source(f.messageId)).availableAt.getTime()).toBeGreaterThan(Date.now());
    expect(await notices(f.messageId)).toEqual([]);
  }
  expect((await delivery.stats()).failed).toBeGreaterThanOrEqual(1);
  await removeFailure();
  await ready(f.messageId);
  await delivery.processNext(2);
  expect(await notices(f.messageId)).toEqual([]);
  await db.update(jobs).set({ attempts: 0 }).where(eq(jobs.messageId, f.messageId));
  await drain(f.messageId, 2);
  expect((await notices(f.messageId)).map((row) => row.recipientId)).toEqual([first, second]);
});

it("recovers a worker lost before commit without a partial page", async () => {
  const recipient = await actor("moderator");
  const f = await fixture();
  await f.create();
  await isolated(f.messageId);
  const original = db.transaction.bind(db);
  vi.spyOn(db, "transaction").mockImplementationOnce((run) =>
    original(async (tx) => {
      await run(tx);
      throw Error("SIMULATED_PROCESS_EXIT");
    }),
  );
  await expect(delivery.processNext()).rejects.toThrow("SIMULATED_PROCESS_EXIT");
  vi.restoreAllMocks();
  expect(await source(f.messageId)).toMatchObject({
    attempts: 0,
    lastRecipientId: null,
    completedAt: null,
  });
  expect(await notices(f.messageId)).toEqual([]);
  await drain(f.messageId);
  expect((await notices(f.messageId)).map((row) => row.recipientId)).toEqual([recipient]);
});

it("uses current roles and the fixed horizon, excluding the requester on replies", async () => {
  const demoted = await actor("moderator");
  const promoted = await actor();
  const late = await actor("admin");
  const f = await fixture();
  await f.create();
  await db.update(jobs).set({ completedAt: new Date() }).where(eq(jobs.messageId, f.messageId));
  const r = reply(f);
  await r.send();
  await isolated(r.messageId);
  await db.update(users).set({ role: "user" }).where(eq(users.id, demoted));
  await db
    .update(users)
    .set({ role: "admin" })
    .where(inArray(users.id, [promoted, f.requesterId]));
  await db
    .update(users)
    .set({ createdAt: new Date("2002-01-01T00:00:00Z") })
    .where(eq(users.id, late));
  await drain(r.messageId);
  expect(await notices(r.messageId)).toMatchObject([
    {
      recipientId: promoted,
      title: "Support case updated",
      message: "A support case has a new requester message.",
      link: staffCaseLink(f.caseId),
    },
  ]);
  expect(await notices(r.messageId)).toHaveLength(1);
  expect(JSON.stringify(await notices(r.messageId))).not.toContain("PRIVATE_");
});

it("retries a locked recipient without advancing, then rechecks a committed demotion", async () => {
  const demoted = await actor("moderator", "aaa");
  const retained = await actor("admin", "bbb");
  const f = await fixture();
  await f.create();
  await isolated(f.messageId);
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
    expect(await source(f.messageId)).toMatchObject({ attempts: 1, lastRecipientId: null });
    expect(await notices(f.messageId)).toEqual([]);
  } finally {
    release.resolve();
    await blocker;
  }
  await drain(f.messageId, 1);
  expect((await notices(f.messageId)).map((row) => row.recipientId)).toEqual([retained]);
});
