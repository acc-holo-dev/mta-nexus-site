import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  db,
  sessionRepository,
  supportCaseRepository,
  webPushSubscriptionRepository,
} from "@nexus/db";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { afterEach, expect, it, vi } from "vitest";
import {
  supportNotificationDeliveryRepository as delivery,
  SupportNotificationDeliveryRepository,
} from "../packages/db/src/repositories/support-notification-delivery";
import {
  auditEvents,
  supportNotificationDeliveries as jobs,
  notifications,
  supportCaseMessages,
  supportCases,
  supportMutationRequests,
  users,
  webPushOutbox,
} from "../packages/db/src/schema";

const actors: string[] = [];
const cases: string[] = [];
const triggers: { table: string; name: string }[] = [];
const id = (prefix: string) => `${prefix}_support_delivery_${randomUUID().replaceAll("-", "")}`;
const noticeId = (messageId: string, recipientId: string) =>
  `ntf_support_moderator_${createHash("sha256")
    .update(JSON.stringify([messageId, recipientId]))
    .digest("hex")}`;

afterEach(async () => {
  vi.restoreAllMocks();
  for (const { table, name } of triggers.splice(0)) {
    await db.execute(sql.raw(`drop trigger if exists ${name} on ${table}`));
    await db.execute(sql.raw(`drop function if exists ${name}()`));
  }
  if (cases.length) {
    await db.delete(auditEvents).where(inArray(auditEvents.targetId, cases));
    await db.delete(supportCases).where(inArray(supportCases.id, cases));
  }
  if (actors.length) await db.delete(users).where(inArray(users.id, actors));
  actors.length = 0;
  cases.length = 0;
});

async function actor(role = "user", prefix = "usr") {
  const userId = id(prefix);
  await db.insert(users).values({
    id: userId,
    username: userId,
    email: `${userId}@nexus.test`,
    displayName: "PRIVATE_REQUESTER_NAME",
    role,
    createdAt: new Date("2000-01-01T00:00:00Z"),
  });
  actors.push(userId);
  return userId;
}

async function fixture() {
  const requesterId = await actor();
  const caseId = id("sup");
  const messageId = id("spm");
  const auditId = id("aud");
  const token = randomUUID();
  cases.push(caseId);
  await sessionRepository.create({
    id: id("ses"),
    userId: requesterId,
    token,
    expiresAt: new Date(Date.now() + 3_600_000),
  });
  const caseInput = {
    id: caseId,
    requesterId,
    category: "account" as const,
    subject: "PRIVATE_SUBJECT",
    status: "open" as const,
  };
  const initial = {
    id: messageId,
    caseId,
    authorId: requesterId,
    authorRole: "requester" as const,
    body: "PRIVATE_INITIAL_BODY",
  };
  const audit = {
    id: auditId,
    actorId: requesterId,
    actorType: "user" as const,
    action: "support.case.created",
    targetType: "support_case",
    targetId: caseId,
  };
  const request = {
    actorId: requesterId,
    requestKey: randomUUID(),
    operation: "case" as const,
    fingerprint: "a".repeat(64),
    caseId,
    messageId,
  };
  return {
    requesterId,
    caseId,
    messageId,
    auditId,
    token,
    create: () =>
      supportCaseRepository.createIdempotentCase(caseInput, initial, audit, request, token),
  };
}

function reply(f: Awaited<ReturnType<typeof fixture>>) {
  const messageId = id("spm");
  const auditId = id("aud");
  const request = {
    actorId: f.requesterId,
    requestKey: randomUUID(),
    operation: "reply" as const,
    fingerprint: "b".repeat(64),
    caseId: f.caseId,
    messageId,
  };
  return {
    messageId,
    auditId,
    send: () =>
      supportCaseRepository.addIdempotentMessage(
        {
          id: messageId,
          caseId: f.caseId,
          authorId: f.requesterId,
          authorRole: "requester",
          body: "PRIVATE_REPLY_BODY",
          expectedStatus: "open",
        },
        {
          id: auditId,
          actorId: f.requesterId,
          actorType: "user",
          action: "support.message.created",
          targetType: "support_case",
          targetId: f.caseId,
        },
        request,
        f.token,
      ),
  };
}

async function source(messageId: string) {
  const [row] = await db.select().from(jobs).where(eq(jobs.messageId, messageId));
  if (!row) throw Error("Missing fixture source");
  return row;
}

async function ready(messageId: string) {
  await db
    .update(jobs)
    .set({ availableAt: new Date(0) })
    .where(eq(jobs.messageId, messageId));
}

async function isolated(messageId: string) {
  // Other suites retain accounts; this horizon includes only this suite's fixtures.
  await db
    .update(jobs)
    .set({ createdAt: new Date("2001-01-01T00:00:00Z"), availableAt: new Date(0) })
    .where(eq(jobs.messageId, messageId));
}

async function notices(messageId: string) {
  const ids = actors.map((userId) => noticeId(messageId, userId));
  return db
    .select()
    .from(notifications)
    .where(inArray(notifications.id, ids))
    .orderBy(asc(notifications.recipientId));
}

async function drain(messageId: string, limit = 20) {
  for (let page = 0; page < 20; page++) {
    if ((await source(messageId)).completedAt) return;
    await ready(messageId);
    expect(["progress", "completed"]).toContain((await delivery.processNext(limit)).state);
  }
  throw Error("Fixture delivery did not complete");
}

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
        cwd: path.resolve(import.meta.dirname, ".."),
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
      expect.objectContaining({ recipientId: moderator, link: "/admin/support" }),
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 40_000);

async function failInsert(
  table: "support_notification_deliveries" | "notifications" | "web_push_outbox",
  value: string,
) {
  const column =
    table === "support_notification_deliveries"
      ? "message_id"
      : table === "notifications"
        ? "recipient_id"
        : "notification_id";
  const name = `support_delivery_failure_${randomUUID().replaceAll("-", "")}`;
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
      link: "/admin/support",
      category: "system",
    });
    expect(JSON.stringify(row)).not.toContain("PRIVATE_");
    expect(JSON.stringify(row)).not.toContain(f.requesterId);
    expect(JSON.stringify(row)).not.toContain(f.messageId);
    expect(JSON.stringify(row)).not.toContain(f.caseId);
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
      link: "/admin/support",
    },
  ]);
  expect(await notices(r.messageId)).toHaveLength(1);
  expect(JSON.stringify(await notices(r.messageId))).not.toContain("PRIVATE_");
  expect(JSON.stringify(await notices(r.messageId))).not.toContain(f.caseId);
});

function deferred() {
  let resolve = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

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
