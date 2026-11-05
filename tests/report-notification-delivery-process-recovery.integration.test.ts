import { expect, it, vi } from "vitest";
import {
  actor,
  db,
  deferred,
  delivery,
  drain,
  eq,
  failInsert,
  job,
  jobs,
  noticeId,
  notices,
  notifications,
  ReportNotificationDeliveryRepository,
  ready,
  setNotificationPreferencesForTest,
  setupReportNotificationDelivery,
  source,
  users,
} from "./helpers/report-notification-delivery-harness";

setupReportNotificationDelivery();

it("resumes bounded pages across concurrent workers, deduplicating without changing read state", async () => {
  const recipients = await Promise.all(Array.from({ length: 5 }, () => actor("moderator")));
  recipients.sort();
  const f = await job(true);
  const existingId = noticeId(f.reportId, recipients[0]);
  const originalTime = new Date("2000-06-01T00:00:00Z");
  await db.insert(notifications).values({
    id: existingId,
    recipientId: recipients[0],
    type: "security",
    category: "security",
    title: "New report",
    message: "A report is awaiting review.",
    isRead: true,
    createdAt: originalTime,
  });
  await Promise.all([
    delivery.processNext(2),
    new ReportNotificationDeliveryRepository().processNext(2),
  ]);
  const afterConcurrent = await source(f.reportId);
  expect([recipients[1], recipients[3]]).toContain(afterConcurrent.lastRecipientId);
  await drain(f.reportId, 2);
  const stored = await notices(f.reportId);
  expect(stored.map((row) => row.recipientId)).toEqual(recipients);
  expect(stored.find((row) => row.id === existingId)).toMatchObject({
    isRead: true,
    createdAt: originalTime,
  });
  for (const row of stored.filter((row) => row.id !== existingId)) {
    expect(row).toMatchObject({
      title: "New report",
      message: "A report is awaiting review.",
      link: `/admin/reports/${f.reportId}`,
      category: "security",
    });
    expect(JSON.stringify(row)).not.toContain("PRIVATE_");
  }
  expect((await source(f.reportId)).completedAt).not.toBeNull();
});

it("rolls back every inbox write and cursor on a failed page, then retries durably up to five times", async () => {
  const first = await actor("moderator", "aaa");
  const second = await actor("admin", "bbb");
  const f = await job();
  const removeFailure = await failInsert("notifications", second);
  for (let attempt = 1; attempt <= 5; attempt++) {
    await ready(f.reportId);
    const result = await delivery.processNext(2);
    expect(result).toEqual({
      state: attempt === 5 ? "failed" : "retry",
      recipients: 0,
      stored: 0,
      pushDeferred: 0,
    });
    expect(await source(f.reportId)).toMatchObject({
      attempts: attempt,
      lastRecipientId: null,
      completedAt: null,
    });
    expect((await source(f.reportId)).availableAt.getTime()).toBeGreaterThan(Date.now());
    expect(await notices(f.reportId)).toEqual([]);
  }
  const stats = await delivery.stats();
  expect(stats.failed).toBeGreaterThanOrEqual(1);
  expect(stats.oldestAgeSeconds).toBeGreaterThan(0);
  await removeFailure();
  await ready(f.reportId);
  await delivery.processNext(2);
  expect(await notices(f.reportId)).toEqual([]);
  // An explicit, report-scoped operator reset preserves the same cursor and IDs.
  await db.update(jobs).set({ attempts: 0 }).where(eq(jobs.reportId, f.reportId));
  await drain(f.reportId, 2);
  expect((await notices(f.reportId)).map((row) => row.recipientId)).toEqual([first, second]);
});

it("recovers a lost process before commit with no partial inbox or cursor", async () => {
  await actor("moderator");
  const f = await job();
  const original = db.transaction.bind(db);
  vi.spyOn(db, "transaction").mockImplementationOnce((run) =>
    original(async (tx) => {
      await run(tx);
      throw Error("SIMULATED_PROCESS_EXIT");
    }),
  );
  await expect(delivery.processNext()).rejects.toThrow("SIMULATED_PROCESS_EXIT");
  vi.restoreAllMocks();
  expect(await notices(f.reportId)).toEqual([]);
  expect(await source(f.reportId)).toMatchObject({
    attempts: 0,
    lastRecipientId: null,
    completedAt: null,
  });
  await drain(f.reportId);
  expect(await notices(f.reportId)).toHaveLength(1);
});

it("uses current staff roles and the fixed account horizon, with safe generic links", async () => {
  const demoted = await actor("moderator");
  const promoted = await actor();
  const late = await actor("admin");
  const f = await job();
  await db.update(users).set({ role: "user" }).where(eq(users.id, demoted));
  await db.update(users).set({ role: "admin" }).where(eq(users.id, promoted));
  await db
    .update(users)
    .set({ createdAt: new Date("2002-01-01T00:00:00Z") })
    .where(eq(users.id, late));
  await setNotificationPreferencesForTest(promoted, {
    followsEnabled: false,
    contentEnabled: false,
    commerceEnabled: false,
    serverEnabled: false,
    systemEnabled: false,
  });
  await drain(f.reportId);
  expect(await notices(f.reportId)).toMatchObject([
    { recipientId: promoted, link: "/admin", category: "security" },
  ]);
  expect(await notices(f.reportId)).toHaveLength(1);
});

it("retries a locked recipient without skipping its cursor or deadlocking reporter deletion", async () => {
  const f = await job();
  await db.update(users).set({ role: "moderator" }).where(eq(users.id, f.reporterId));
  const locked = deferred();
  const release = deferred();
  const blocker = db.transaction(async (tx) => {
    await tx.select().from(users).where(eq(users.id, f.reporterId)).for("update");
    locked.resolve();
    await release.promise;
    // Account deletion cascades report -> source. A waiting recipient lock
    // would hold source -> user and deadlock with this direction.
    await tx.delete(users).where(eq(users.id, f.reporterId));
  });
  await Promise.race([locked.promise, blocker]);
  try {
    expect(await delivery.processNext()).toEqual({
      state: "retry",
      recipients: 0,
      stored: 0,
      pushDeferred: 0,
    });
    expect(await source(f.reportId)).toMatchObject({ attempts: 1, lastRecipientId: null });
    expect(await notices(f.reportId)).toEqual([]);
  } finally {
    release.resolve();
    await blocker;
  }
  expect(await db.select().from(jobs).where(eq(jobs.reportId, f.reportId))).toEqual([]);
});

it("rechecks a demotion after contention and retains unblocked recipients", async () => {
  const recipient = await actor("moderator", "aaa");
  const retained = await actor("admin", "bbb");
  const f = await job();
  const locked = deferred();
  const release = deferred();
  const blocker = db.transaction(async (tx) => {
    await tx.update(users).set({ role: "user" }).where(eq(users.id, recipient));
    locked.resolve();
    await release.promise;
  });
  await Promise.race([locked.promise, blocker]);
  try {
    expect((await delivery.processNext(1)).state).toBe("retry");
    expect((await source(f.reportId)).lastRecipientId).toBeNull();
  } finally {
    release.resolve();
    await blocker;
  }
  await drain(f.reportId, 1);
  expect((await notices(f.reportId)).map((row) => row.recipientId)).toEqual([retained]);
});
