import { expect, it } from "vitest";
import {
  actor,
  auditEvents,
  command,
  db,
  delivery,
  drain,
  eq,
  failInsert,
  id,
  job,
  jobs,
  noticeId,
  notices,
  reports,
  sessionRepository,
  setupReportNotificationDelivery,
  source,
  sql,
  webPushOutbox,
  webPushSubscriptionRepository,
} from "./helpers/report-notification-delivery-harness";

setupReportNotificationDelivery();

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
