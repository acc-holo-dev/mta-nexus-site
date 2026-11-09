import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import {
  actor,
  auditEvents,
  db,
  delivery,
  eq,
  failInsert,
  fixture,
  id,
  isolated,
  jobs,
  noticeId,
  notices,
  reply,
  sessionRepository,
  setupSupportNotificationDelivery,
  source,
  supportCaseMessages,
  supportCaseRepository,
  supportCases,
  supportMutationRequests,
  webPushOutbox,
  webPushSubscriptionRepository,
} from "../helpers/support-notification-delivery-harness";

setupSupportNotificationDelivery();

it("the real worker delivers support inbox without VAPID or a request callback", async () => {
  const f = await fixture();
  const moderator = await actor("moderator");
  await f.create();
  await isolated(f.messageId);
  const root = await mkdtemp(path.join(tmpdir(), "nexus-support-worker-"));
  try {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "packages/db/scripts/run-web-push-dispatcher.ts", "--once"],
      {
        cwd: path.resolve(import.meta.dirname, "..", ".."),
        encoding: "utf8",
        timeout: 30_000,
        env: {
          ...process.env,
          WEB_PUSH_VAPID_PUBLIC_KEY: "",
          WEB_PUSH_VAPID_PRIVATE_KEY: "",
          WEB_PUSH_VAPID_SUBJECT: "",
          NEXUS_WEB_PUSH_HEALTH_FILE: path.join(root, "health.json"),
        },
      },
    );
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('"status":"support-delivery"');
    expect(result.stdout + result.stderr).not.toContain("PRIVATE_");
    expect((await source(f.messageId)).completedAt).toBeInstanceOf(Date);
    expect(await notices(f.messageId)).toEqual([
      expect.objectContaining({
        recipientId: moderator,
        link: `/admin/support/${encodeURIComponent(f.caseId)}`,
      }),
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 40_000);

it("atomically creates and replays case and requester-reply sources, rolling back queue failures", async () => {
  const f = await fixture();
  let removeFailure = await failInsert("support_notification_deliveries", f.messageId);
  await expect(f.create()).rejects.toThrow();
  expect(await db.select().from(supportCases).where(eq(supportCases.id, f.caseId))).toEqual([]);
  expect(
    await db.select().from(supportCaseMessages).where(eq(supportCaseMessages.id, f.messageId)),
  ).toEqual([]);
  expect(await db.select().from(auditEvents).where(eq(auditEvents.id, f.auditId))).toEqual([]);
  expect(await db.select().from(jobs).where(eq(jobs.messageId, f.messageId))).toEqual([]);
  expect(
    await db
      .select()
      .from(supportMutationRequests)
      .where(eq(supportMutationRequests.actorId, f.requesterId)),
  ).toEqual([]);
  await removeFailure();
  expect((await f.create()).kind).toBe("created");
  expect((await f.create()).kind).toBe("replayed");
  expect(await source(f.messageId)).toMatchObject({
    caseId: f.caseId,
    event: "case_created",
    excludedRecipientId: null,
  });

  const r = reply(f);
  const before = await supportCaseRepository.findById(f.caseId);
  removeFailure = await failInsert("support_notification_deliveries", r.messageId);
  await expect(r.send()).rejects.toThrow();
  expect(
    await db.select().from(supportCaseMessages).where(eq(supportCaseMessages.id, r.messageId)),
  ).toEqual([]);
  expect(await db.select().from(auditEvents).where(eq(auditEvents.id, r.auditId))).toEqual([]);
  expect(await db.select().from(jobs).where(eq(jobs.messageId, r.messageId))).toEqual([]);
  expect((await supportCaseRepository.findById(f.caseId))?.updatedAt).toEqual(before?.updatedAt);
  await removeFailure();
  expect((await r.send()).kind).toBe("created");
  expect((await r.send()).kind).toBe("replayed");
  expect(await source(r.messageId)).toMatchObject({
    caseId: f.caseId,
    event: "requester_reply",
    excludedRecipientId: f.requesterId,
  });
  expect(await db.select().from(jobs).where(eq(jobs.caseId, f.caseId))).toHaveLength(2);
  expect(
    await db.select().from(supportCaseMessages).where(eq(supportCaseMessages.caseId, f.caseId)),
  ).toHaveLength(2);
  expect(
    await db.select().from(auditEvents).where(eq(auditEvents.targetId, f.caseId)),
  ).toHaveLength(2);
  const staff = await actor("moderator");
  const staffMessageId = id("spm");
  await supportCaseRepository.addMessage(
    {
      id: staffMessageId,
      caseId: f.caseId,
      authorId: staff,
      authorRole: "staff",
      body: "Staff response",
      expectedStatus: "open",
    },
    {
      id: id("aud"),
      actorId: staff,
      actorType: "admin",
      action: "support.message.created",
      targetType: "support_case",
      targetId: f.caseId,
    },
  );
  expect(await db.select().from(jobs).where(eq(jobs.messageId, staffMessageId))).toEqual([]);
});

it("cascades source deletion with its message and preserves the inbox when optional push fails", async () => {
  const recipient = await actor("moderator");
  const sessionId = id("ses");
  await sessionRepository.create({
    id: sessionId,
    userId: recipient,
    token: randomUUID(),
    expiresAt: new Date(Date.now() + 3_600_000),
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
  const f = await fixture();
  await f.create();
  await isolated(f.messageId);
  const notificationId = noticeId(f.messageId, recipient);
  await failInsert("web_push_outbox", notificationId);
  expect(await delivery.processNext()).toEqual({
    state: "completed",
    recipients: 1,
    stored: 1,
    pushDeferred: 1,
  });
  expect(await notices(f.messageId)).toHaveLength(1);
  expect(
    await db.select().from(webPushOutbox).where(eq(webPushOutbox.notificationId, notificationId)),
  ).toEqual([]);
  await db.delete(supportCaseMessages).where(eq(supportCaseMessages.id, f.messageId));
  expect(await db.select().from(jobs).where(eq(jobs.messageId, f.messageId))).toEqual([]);
});
