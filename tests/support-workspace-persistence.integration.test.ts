import { createHash, randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { afterEach, expect, it } from "vitest";
import {
  auditEvents,
  db,
  notifications,
  notificationPreferences,
  sessionRepository,
  supportActivityRepository,
  supportCaseMessages,
  supportCaseRepository as cases,
  supportCases,
  userRepository,
  users,
  webPushOutbox,
  webPushSubscriptionRepository,
} from "@nexus/db";
const userIds: string[] = [],
  caseIds: string[] = [];
function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error("Missing persisted fixture result");
  return value;
}
const id = (prefix: string) => `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 24)}`;
afterEach(async () => {
  if (caseIds.length) {
    await db.delete(auditEvents).where(inArray(auditEvents.targetId, caseIds));
    await db.delete(supportCases).where(inArray(supportCases.id, caseIds));
  }
  if (userIds.length) await db.delete(users).where(inArray(users.id, userIds));
  caseIds.length = 0;
  userIds.length = 0;
});
async function actor(role: "user" | "moderator" = "user") {
  const userId = id("usr");
  userIds.push(userId);
  return userRepository.create({
    id: userId,
    username: userId,
    email: `${userId}@nexus.test`,
    displayName: "Support fixture",
    role,
  });
}
async function fixture() {
  const owner = await actor(),
    staff = await actor("moderator"),
    other = await actor(),
    caseId = id("sup");
  caseIds.push(caseId);
  const supportCase = await cases.createWithInitialMessage(
    {
      id: caseId,
      requesterId: owner.id,
      category: "account",
      subject: "Private support subject",
      status: "open",
    },
    {
      id: id("spm"),
      caseId,
      authorId: owner.id,
      authorRole: "requester",
      body: "Private support context",
    },
    {
      id: id("aud"),
      actorId: owner.id,
      actorType: "user",
      action: "support.case.created",
      targetId: caseId,
      targetType: "support_case",
    },
  );
  return { owner, staff, other, supportCase };
}
const audit = (
  caseId: string,
  actorId: string,
  action = "support.case.status_changed",
  auditId = id("aud"),
) => ({
  id: auditId,
  actorId,
  actorType: "user" as const,
  action,
  targetId: caseId,
  targetType: "support_case",
});
it("persists requester resolution/reopening, private status history and generic receipts", async () => {
  const f = await fixture();
  const resolved = await cases.updateStatus(
    f.supportCase.id,
    "resolved",
    audit(f.supportCase.id, f.owner.id),
    "open",
    f.supportCase.updatedAt,
  );
  const opened = await cases.updateStatus(
    f.supportCase.id,
    "open",
    audit(f.supportCase.id, f.owner.id),
    "resolved",
    required(resolved).updatedAt,
  );
  expect(required(opened).updatedAt.getTime()).toBeGreaterThan(
    required(resolved).updatedAt.getTime(),
  );
  expect(
    (await supportActivityRepository.history(f.supportCase.id, f.owner.id)).items.map(
      (item) => item.to,
    ),
  ).toEqual(["open", "resolved"]);
  await expect(
    supportActivityRepository.history(f.supportCase.id, f.other.id),
  ).rejects.toMatchObject({ statusCode: 404 });
  const inbox = await db
    .select()
    .from(notifications)
    .where(eq(notifications.recipientId, f.owner.id));
  expect(inbox).toHaveLength(2);
  expect(inbox.every((item) => !item.message.includes("Private support"))).toBe(true);
});
it("respects staff closure and live role revocation for status, history and replies", async () => {
  const f = await fixture();
  const closed = await cases.updateStatus(
    f.supportCase.id,
    "closed",
    audit(f.supportCase.id, f.staff.id),
    "open",
    f.supportCase.updatedAt,
  );
  await expect(
    cases.updateStatus(
      f.supportCase.id,
      "open",
      audit(f.supportCase.id, f.owner.id),
      "closed",
      required(closed).updatedAt,
    ),
  ).rejects.toMatchObject({ statusCode: 403 });
  await db.update(users).set({ role: "user" }).where(eq(users.id, f.staff.id));
  await expect(
    cases.updateStatus(
      f.supportCase.id,
      "open",
      audit(f.supportCase.id, f.staff.id),
      "closed",
      required(closed).updatedAt,
    ),
  ).rejects.toMatchObject({ statusCode: 404 });
  await expect(
    supportActivityRepository.history(f.supportCase.id, f.staff.id),
  ).rejects.toMatchObject({ statusCode: 404 });
});
it("serializes competing requester transitions and refuses same-status revision reuse after an ABA change", async () => {
  const f = await fixture();
  const results = await Promise.all([
    cases.updateStatus(
      f.supportCase.id,
      "resolved",
      audit(f.supportCase.id, f.owner.id),
      "open",
      f.supportCase.updatedAt,
    ),
    cases.updateStatus(
      f.supportCase.id,
      "resolved",
      audit(f.supportCase.id, f.owner.id),
      "open",
      f.supportCase.updatedAt,
    ),
  ]);
  expect(results.filter(Boolean)).toHaveLength(1);
  const current = required(results.find(Boolean));
  await cases.updateStatus(
    f.supportCase.id,
    "open",
    audit(f.supportCase.id, f.staff.id),
    "resolved",
    current.updatedAt,
  );
  expect(
    await cases.updateStatus(
      f.supportCase.id,
      "closed",
      audit(f.supportCase.id, f.staff.id),
      "open",
      f.supportCase.updatedAt,
    ),
  ).toBeNull();
});
it("replays an authorized committed reply after closure without duplicating messages or receipts", async () => {
  const f = await fixture(),
    messageId = id("spm"),
    requestKey = randomUUID();
  const input = {
    id: messageId,
    caseId: f.supportCase.id,
    authorId: f.staff.id,
    authorRole: "staff" as const,
    body: "Sensitive staff answer",
    expectedStatus: "open" as const,
    expectedUpdatedAt: f.supportCase.updatedAt,
  };
  const request = {
    actorId: f.staff.id,
    requestKey,
    operation: "reply" as const,
    fingerprint: "a".repeat(64),
    caseId: f.supportCase.id,
    messageId,
  };
  const first = await cases.addIdempotentMessage(
    input,
    audit(f.supportCase.id, f.staff.id, "support.message.created"),
    request,
  );
  expect(first.kind).toBe("created");
  if (first.kind !== "created") throw new Error("Reply did not persist");
  await cases.updateStatus(
    f.supportCase.id,
    "closed",
    audit(f.supportCase.id, f.staff.id),
    "open",
    first.supportCase.updatedAt,
  );
  const replay = await cases.addIdempotentMessage(
    input,
    audit(f.supportCase.id, f.staff.id, "support.message.created"),
    request,
  );
  expect(replay.kind).toBe("replayed");
  expect(
    await db.select().from(supportCaseMessages).where(eq(supportCaseMessages.id, messageId)),
  ).toHaveLength(1);
  const notices = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientId, f.owner.id),
        eq(notifications.message, `Support case ${f.supportCase.id}: reply.`),
      ),
    );
  expect(notices).toHaveLength(1);
  await db.update(users).set({ role: "user" }).where(eq(users.id, f.staff.id));
  await expect(cases.findMutationReplay(request)).rejects.toMatchObject({ statusCode: 404 });
});
it("rolls back the case and audit when authoritative inbox storage fails", async () => {
  const f = await fixture(),
    auditId = id("aud"),
    noticeId = `ntf_support_${createHash("sha256")
      .update(JSON.stringify([auditId, f.owner.id]))
      .digest("hex")}`;
  await db.insert(notifications).values({
    id: noticeId,
    recipientId: f.owner.id,
    title: "Fixture collision",
    message: "Fixture",
    type: "system",
    category: "system",
    isRead: false,
  });
  await expect(
    cases.updateStatus(
      f.supportCase.id,
      "resolved",
      audit(f.supportCase.id, f.owner.id, "support.case.status_changed", auditId),
      "open",
      f.supportCase.updatedAt,
    ),
  ).rejects.toThrow();
  expect(required(await cases.findById(f.supportCase.id)).status).toBe("open");
  expect(await db.select().from(auditEvents).where(eq(auditEvents.id, auditId))).toEqual([]);
});
it("paginates tied microsecond status events once and excludes raw private details", async () => {
  const f = await fixture(),
    events = Array.from({ length: 43 }, () => ({
      ...audit(f.supportCase.id, f.staff.id),
      actorType: "admin" as const,
      details: { from: "open", to: "resolved", body: "Private audit context" },
      createdAt: sql`'2026-10-11T00:00:00.123456Z'::timestamptz`,
    }));
  await db.insert(auditEvents).values(events);
  const seen: string[] = [];
  let before: string | undefined;
  do {
    const page = await supportActivityRepository.history(f.supportCase.id, f.owner.id, before);
    seen.push(...page.items.map((item) => item.id));
    expect(JSON.stringify(page)).not.toContain("Private audit context");
    before = page.nextCursor ?? undefined;
  } while (before);
  expect(new Set(seen).size).toBe(43);
  expect(seen).toHaveLength(43);
});
it("queues status push delivery in the same transaction as the receipt", async () => {
  const f = await fixture(),
    sessionId = id("ses"),
    subscriptionId = id("wps");
  await sessionRepository.create({
    id: sessionId,
    userId: f.owner.id,
    token: randomUUID(),
    expiresAt: new Date(Date.now() + 3_600_000),
  });
  await webPushSubscriptionRepository.upsert({
    id: subscriptionId,
    userId: f.owner.id,
    sessionId,
    endpoint: `https://push.example.invalid/${randomUUID()}`,
    p256dh: "fixture-key",
    auth: "fixture-auth",
    expirationAt: null,
  });
  await cases.updateStatus(
    f.supportCase.id,
    "resolved",
    audit(f.supportCase.id, f.owner.id),
    "open",
    f.supportCase.updatedAt,
  );
  const [notice] = await db
    .select()
    .from(notifications)
    .where(eq(notifications.recipientId, f.owner.id));
  expect(
    await db.select().from(webPushOutbox).where(eq(webPushOutbox.notificationId, notice.id)),
  ).toEqual([expect.objectContaining({ subscriptionId, attempts: 0 })]);
});

it("honors persisted system-notification opt-out while keeping the authoritative transition", async () => {
  const f = await fixture();
  await db
    .insert(notificationPreferences)
    .values({ id: id("npr"), userId: f.owner.id, systemEnabled: false });
  expect(
    (
      await cases.updateStatus(
        f.supportCase.id,
        "resolved",
        audit(f.supportCase.id, f.owner.id),
        "open",
        f.supportCase.updatedAt,
      )
    )?.status,
  ).toBe("resolved");
  expect(
    await db.select().from(notifications).where(eq(notifications.recipientId, f.owner.id)),
  ).toEqual([]);
});
