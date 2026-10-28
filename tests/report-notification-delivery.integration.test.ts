import { createHash, randomUUID } from "node:crypto";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { afterEach, expect, it, vi } from "vitest";
import {
  communityReportsRepository,
  db,
  reportRepository,
  sessionRepository,
  webPushSubscriptionRepository,
} from "@nexus/db";
import {
  ReportNotificationDeliveryRepository,
  reportNotificationDeliveryRepository as delivery,
} from "../packages/db/src/repositories/report-notification-delivery";
import { notificationRepository } from "../packages/db/src/repositories/notifications";
import {
  auditEvents,
  content,
  notifications,
  reportNotificationDeliveries as jobs,
  reports,
  users,
  webPushOutbox,
} from "../packages/db/src/schema";

const actors: string[] = [];
const reportIds: string[] = [];
const triggers: { table: string; name: string }[] = [];
const id = (prefix: string) => `${prefix}_report_delivery_${randomUUID().replaceAll("-", "")}`;
const noticeId = (reportId: string, recipientId: string) =>
  `ntf_report_created_${createHash("sha256")
    .update(JSON.stringify([reportId, recipientId]))
    .digest("hex")}`;

afterEach(async () => {
  vi.restoreAllMocks();
  for (const { table, name } of triggers.splice(0)) {
    await db.execute(sql.raw(`drop trigger if exists ${name} on ${table}`));
    await db.execute(sql.raw(`drop function if exists ${name}()`));
  }
  if (reportIds.length) {
    await db.delete(auditEvents).where(inArray(auditEvents.targetId, reportIds));
    await db.delete(reports).where(inArray(reports.id, reportIds));
  }
  if (actors.length) await db.delete(users).where(inArray(users.id, actors));
  actors.length = 0;
  reportIds.length = 0;
});

async function actor(role = "user", prefix = "usr") {
  const userId = id(prefix);
  await db.insert(users).values({
    id: userId,
    username: userId,
    email: `${userId}@nexus.test`,
    displayName: "Report delivery fixture",
    role,
    createdAt: new Date("2000-01-01T00:00:00Z"),
  });
  actors.push(userId);
  return userId;
}

async function command(community = false) {
  const reporterId = await actor();
  const reportId = id("rpt");
  const auditId = id("aud");
  reportIds.push(reportId);
  if (community) {
    const authorId = await actor();
    const contentId = id("cnt");
    await db.insert(content).values({
      id: contentId,
      slug: contentId,
      authorId,
      title: "PRIVATE_TARGET_TITLE",
      body: "PRIVATE_TARGET_BODY",
      status: "published",
    });
    const input = {
      actorId: reporterId,
      id: reportId,
      auditId,
      targetType: "content" as const,
      targetId: contentId,
      type: "abuse",
      reason: "PRIVATE_REPORT_REASON",
      evidenceUrls: ["https://example.invalid/PRIVATE_EVIDENCE"],
    };
    return {
      reportId,
      auditId,
      reporterId,
      create: () => communityReportsRepository.submit(input),
    };
  }
  const data = {
    id: reportId,
    reporterId,
    targetType: "product" as const,
    targetId: id("prd"),
    type: "scam" as const,
    reason: "PRIVATE_REPORT_REASON",
    evidenceUrls: ["https://example.invalid/PRIVATE_EVIDENCE"],
    status: "open" as const,
  };
  const audit = {
    id: auditId,
    actorId: reporterId,
    actorType: "user" as const,
    action: "report.created",
    targetType: "report",
    targetId: reportId,
    details: {},
  };
  return {
    reportId,
    auditId,
    reporterId,
    create: () => reportRepository.createWithAudit(data, audit),
  };
}

async function job(community = false) {
  const fixture = await command(community);
  await fixture.create();
  // A synthetic horizon keeps retained moderators from other PG suites outside
  // this fixture. Production sources copy the report's exact database timestamp.
  await db
    .update(jobs)
    .set({ createdAt: new Date("2001-01-01T00:00:00Z"), availableAt: new Date(0) })
    .where(eq(jobs.reportId, fixture.reportId));
  return fixture;
}

async function source(reportId: string) {
  const [row] = await db.select().from(jobs).where(eq(jobs.reportId, reportId));
  if (!row) throw Error("Missing fixture source");
  return row;
}

async function ready(reportId: string) {
  await db
    .update(jobs)
    .set({ availableAt: new Date(0) })
    .where(eq(jobs.reportId, reportId));
}

async function notices(reportId: string) {
  return db
    .select()
    .from(notifications)
    .where(sql`${notifications.id} in (
      select 'ntf_report_created_' || encode(sha256(convert_to(
        '[' || to_json(${reportId}::text)::text || ',' || to_json(id)::text || ']', 'UTF8')), 'hex')
      from users
    )`)
    .orderBy(asc(notifications.recipientId));
}

async function drain(reportId: string, limit = 20) {
  for (let page = 0; page < 20; page++) {
    if ((await source(reportId)).completedAt) return;
    await ready(reportId);
    const result = await delivery.processNext(limit);
    expect(["progress", "completed"]).toContain(result.state);
  }
  throw Error("Fixture delivery did not complete");
}

async function failInsert(
  table: "report_notification_deliveries" | "notifications" | "web_push_outbox",
  value: string,
) {
  const column =
    table === "notifications"
      ? "recipient_id"
      : table === "web_push_outbox"
        ? "notification_id"
        : "report_id";
  const name = `report_delivery_failure_${randomUUID().replaceAll("-", "")}`;
  if (!/^[A-Za-z0-9_]+$/u.test(value)) throw Error("Unsafe fixture ID");
  await db.execute(
    sql.raw(
      `create function ${name}() returns trigger language plpgsql as $$ begin raise exception 'PRIVATE_INSERT_FAILURE'; end $$`,
    ),
  );
  triggers.push({ table, name });
  await db.execute(
    sql.raw(
      `create trigger ${name} before insert on ${table} for each row when (new.${column} = '${value}') execute function ${name}()`,
    ),
  );
  return async () => {
    await db.execute(sql.raw(`drop trigger ${name} on ${table}`));
    await db.execute(sql.raw(`drop function ${name}()`));
    triggers.splice(
      triggers.findIndex((entry) => entry.name === name),
      1,
    );
  };
}

it.each([false, true])(
  "atomically creates the %s-community source, report and audit, including retries",
  async (community) => {
    const f = await command(community);
    const removeFailure = await failInsert("report_notification_deliveries", f.reportId);
    await expect(f.create()).rejects.toThrow();
    expect(await db.select().from(reports).where(eq(reports.id, f.reportId))).toEqual([]);
    expect(await db.select().from(auditEvents).where(eq(auditEvents.id, f.auditId))).toEqual([]);
    expect(await db.select().from(jobs).where(eq(jobs.reportId, f.reportId))).toEqual([]);
    await removeFailure();
    await f.create();
    await f.create();
    const timestamps = await db.execute(sql`
    select r.created_at = j.created_at and r.created_at = a.created_at as same_time
    from reports r join report_notification_deliveries j on j.report_id = r.id
    join audit_events a on a.target_id = r.id and a.action = 'report.created'
    where r.id = ${f.reportId}
  `);
    expect(timestamps).toHaveLength(1);
    expect(timestamps[0]?.same_time).toBe(true);
    expect(await source(f.reportId)).toMatchObject({
      community,
      attempts: 0,
      lastRecipientId: null,
    });
  },
);

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

it("keeps the completed inbox page and reports deferred push when optional admission fails", async () => {
  const recipient = await actor("moderator");
  const sessionId = id("ses");
  await sessionRepository.create({
    id: sessionId,
    userId: recipient,
    token: id("token"),
    expiresAt: new Date(Date.now() + 3600000),
  });
  const subscriptionId = id("wps");
  await webPushSubscriptionRepository.upsert({
    id: subscriptionId,
    userId: recipient,
    sessionId,
    endpoint: `https://push.example.invalid/${subscriptionId}`,
    p256dh: "fixture-key",
    auth: "fixture-auth",
    expirationAt: null,
  });
  const f = await job();
  const notificationId = noticeId(f.reportId, recipient);
  await failInsert("web_push_outbox", notificationId);
  expect(await delivery.processNext()).toEqual({
    state: "completed",
    recipients: 1,
    stored: 1,
    pushDeferred: 1,
  });
  expect(await notices(f.reportId)).toHaveLength(1);
  expect((await source(f.reportId)).completedAt).not.toBeNull();
  expect(
    await db.select().from(webPushOutbox).where(eq(webPushOutbox.notificationId, notificationId)),
  ).toEqual([]);
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
  await notificationRepository.updatePreferences(promoted, {
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

function deferred() {
  let resolve = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

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

it("validates batch bounds and keeps the default page at twenty recipients", async () => {
  for (const limit of [0, -1, 101, 1.5, Number.NaN, Number.POSITIVE_INFINITY])
    await expect(delivery.processNext(limit)).rejects.toThrow(RangeError);
  await Promise.all(Array.from({ length: 21 }, () => actor("moderator")));
  const f = await job();
  expect(await delivery.processNext()).toEqual({
    state: "progress",
    recipients: 20,
    stored: 20,
    pushDeferred: 0,
  });
  expect(await notices(f.reportId)).toHaveLength(20);
  await drain(f.reportId, 100);
  expect(await notices(f.reportId)).toHaveLength(21);
});
