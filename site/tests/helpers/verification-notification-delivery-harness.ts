import { createHash, randomUUID } from "node:crypto";
import { db, sessionRepository, verificationRepository } from "@nexus/db";
import { asc, eq, inArray, ne, sql } from "drizzle-orm";
import { afterEach, expect, vi } from "vitest";
import {
  verificationNotificationDeliveryRepository as delivery,
  VerificationNotificationDeliveryRepository,
} from "../../packages/db/src/repositories/verification-notification-delivery";
import {
  auditEvents,
  verificationNotificationDeliveries as jobs,
  notifications,
  users,
  verificationRequests,
} from "../../packages/db/src/schema";

export {
  auditEvents,
  db,
  delivery,
  eq,
  jobs,
  ne,
  notifications,
  sql,
  users,
  VerificationNotificationDeliveryRepository,
  verificationRequests,
};

const actors: string[] = [];
const requests: string[] = [];
const triggers: { table: string; name: string }[] = [];

const id = (prefix: string) => `${prefix}_ver_delivery_${randomUUID().replaceAll("-", "")}`;

export const noticeId = (requestId: string, recipientId: string) =>
  `ntf_verification_moderator_${createHash("sha256")
    .update(JSON.stringify([requestId, recipientId]))
    .digest("hex")}`;

export function pendingLink(verificationRequestId: string) {
  return `/admin?verificationView=pending&verificationId=${encodeURIComponent(verificationRequestId)}#verification-${encodeURIComponent(verificationRequestId)}`;
}

/** Register shared afterEach cleanup for verification notification delivery suites. */
export function setupVerificationNotificationDelivery() {
  afterEach(async () => {
    vi.restoreAllMocks();
    for (const { table, name } of triggers.splice(0)) {
      await db.execute(sql.raw(`drop trigger if exists ${name} on ${table}`));
      await db.execute(sql.raw(`drop function if exists ${name}()`));
    }
    if (requests.length) {
      await db.delete(jobs).where(inArray(jobs.verificationRequestId, requests));
      await db.delete(auditEvents).where(inArray(auditEvents.targetId, requests));
      await db.delete(verificationRequests).where(inArray(verificationRequests.id, requests));
    }
    if (actors.length) await db.delete(users).where(inArray(users.id, actors));
    actors.length = 0;
    requests.length = 0;
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
  await sessionRepository.create({
    id: `ses_${userId}`,
    userId,
    token: `tok_${userId}`,
    expiresAt: new Date("2099-01-01T00:00:00.000Z"),
  });
  actors.push(userId);
  return userId;
}

export async function apply(requesterId: string) {
  const request = await verificationRepository.createRequest(
    {
      requesterId,
      currentToken: `tok_${requesterId}`,
      targetType: "user",
      targetId: requesterId,
      notes: "PRIVATE_NOTES",
    },
    {
      id: id("aud"),
      actorId: requesterId,
      actorType: "user",
      action: "verification.requested",
      details: {
        targetType: "user",
        targetId: requesterId,
        privateMarker: "PRIVATE_TARGET",
      },
    },
  );
  requests.push(request.id);
  return request;
}

export async function source(requestId: string) {
  const [row] = await db.select().from(jobs).where(eq(jobs.verificationRequestId, requestId));
  if (!row) throw Error("Missing fixture source");
  return row;
}

export async function ready(requestId: string) {
  await db
    .update(jobs)
    .set({ availableAt: new Date(0) })
    .where(eq(jobs.verificationRequestId, requestId));
}

export async function isolated(requestId: string) {
  await db
    .update(jobs)
    .set({ createdAt: new Date("2001-01-01T00:00:00Z"), availableAt: new Date(0) })
    .where(eq(jobs.verificationRequestId, requestId));
}

export async function notices(requestId: string) {
  const ids = actors.map((userId) => noticeId(requestId, userId));
  return db
    .select()
    .from(notifications)
    .where(inArray(notifications.id, ids))
    .orderBy(asc(notifications.recipientId));
}

export async function drain(requestId: string, limit = 20) {
  for (let page = 0; page < 20; page++) {
    if ((await source(requestId)).completedAt) return;
    await ready(requestId);
    expect(["progress", "completed"]).toContain((await delivery.processNext(limit)).state);
  }
  throw Error("Fixture delivery did not complete");
}

export async function failInsert(
  table: "verification_notification_deliveries" | "notifications",
  value: string,
) {
  const column =
    table === "verification_notification_deliveries" ? "verification_request_id" : "recipient_id";
  const name = `verification_delivery_failure_${randomUUID().replaceAll("-", "")}`;
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

/** Track a trigger created inline by a suite so afterEach still cleans it up. */
export function trackTrigger(table: string, name: string) {
  triggers.push({ table, name });
}

export function untrackTrigger(name: string) {
  triggers.splice(
    triggers.findIndex((entry) => entry.name === name),
    1,
  );
}
