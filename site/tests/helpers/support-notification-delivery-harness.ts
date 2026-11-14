import { createHash, randomUUID } from "node:crypto";
import {
  db,
  sessionRepository,
  supportCaseRepository,
  webPushSubscriptionRepository,
} from "@nexus/db";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { afterEach, expect, vi } from "vitest";
import {
  supportNotificationDeliveryRepository as delivery,
  SupportNotificationDeliveryRepository,
} from "../../packages/db/src/repositories/support-notification-delivery";
import {
  auditEvents,
  supportNotificationDeliveries as jobs,
  notifications,
  supportCaseMessages,
  supportCases,
  supportMutationRequests,
  users,
  webPushOutbox,
} from "../../packages/db/src/schema";

export {
  auditEvents,
  db,
  delivery,
  eq,
  inArray,
  jobs,
  notifications,
  SupportNotificationDeliveryRepository,
  sessionRepository,
  supportCaseMessages,
  supportCaseRepository,
  supportCases,
  supportMutationRequests,
  users,
  webPushOutbox,
  webPushSubscriptionRepository,
};

const actors: string[] = [];
const cases: string[] = [];
const triggers: { table: string; name: string }[] = [];

export const id = (prefix: string) =>
  `${prefix}_support_delivery_${randomUUID().replaceAll("-", "")}`;

export const noticeId = (messageId: string, recipientId: string) =>
  `ntf_support_moderator_${createHash("sha256")
    .update(JSON.stringify([messageId, recipientId]))
    .digest("hex")}`;

export function staffCaseLink(caseId: string) {
  return `/admin/support/${encodeURIComponent(caseId)}`;
}

/** Register shared afterEach cleanup for support notification delivery suites. */
export function setupSupportNotificationDelivery() {
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
}

export async function actor(role = "user", prefix = "usr") {
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

export async function fixture() {
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

export function reply(f: Awaited<ReturnType<typeof fixture>>) {
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

export async function source(messageId: string) {
  const [row] = await db.select().from(jobs).where(eq(jobs.messageId, messageId));
  if (!row) throw Error("Missing fixture source");
  return row;
}

export async function ready(messageId: string) {
  await db
    .update(jobs)
    .set({ availableAt: new Date(0) })
    .where(eq(jobs.messageId, messageId));
}

export async function isolated(messageId: string) {
  // Other suites retain accounts; this horizon includes only this suite's fixtures.
  await db
    .update(jobs)
    .set({ createdAt: new Date("2001-01-01T00:00:00Z"), availableAt: new Date(0) })
    .where(eq(jobs.messageId, messageId));
}

export async function notices(messageId: string) {
  const ids = actors.map((userId) => noticeId(messageId, userId));
  return db
    .select()
    .from(notifications)
    .where(inArray(notifications.id, ids))
    .orderBy(asc(notifications.recipientId));
}

export async function drain(messageId: string, limit = 20) {
  for (let page = 0; page < 20; page++) {
    if ((await source(messageId)).completedAt) return;
    await ready(messageId);
    expect(["progress", "completed"]).toContain((await delivery.processNext(limit)).state);
  }
  throw Error("Fixture delivery did not complete");
}

export async function failInsert(
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

export function deferred() {
  let resolve = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
