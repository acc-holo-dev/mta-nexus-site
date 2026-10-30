import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db, verificationRepository } from "@nexus/db";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { afterEach, expect, it, vi } from "vitest";
import {
  verificationNotificationDeliveryRepository as delivery,
  VerificationNotificationDeliveryRepository,
} from "../packages/db/src/repositories/verification-notification-delivery";
import {
  auditEvents,
  notifications,
  users,
  verificationNotificationDeliveries as jobs,
  verificationRequests,
} from "../packages/db/src/schema";

const actors: string[] = [];
const requests: string[] = [];
const triggers: { table: string; name: string }[] = [];
const id = (prefix: string) => `${prefix}_ver_delivery_${randomUUID().replaceAll("-", "")}`;
const noticeId = (requestId: string, recipientId: string) =>
  `ntf_verification_moderator_${createHash("sha256")
    .update(JSON.stringify([requestId, recipientId]))
    .digest("hex")}`;
const PENDING_LINK = "/admin?verificationView=pending&verificationPage=1";

afterEach(async () => {
  vi.restoreAllMocks();
  for (const { table, name } of triggers.splice(0)) {
    await db.execute(sql.raw(`drop trigger if exists ${name} on ${table}`));
    await db.execute(sql.raw(`drop function if exists ${name}()`));
  }
  if (requests.length) {
    await db.delete(auditEvents).where(inArray(auditEvents.targetId, requests));
    await db.delete(verificationRequests).where(inArray(verificationRequests.id, requests));
  }
  if (actors.length) await db.delete(users).where(inArray(users.id, actors));
  actors.length = 0;
  requests.length = 0;
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

async function apply(requesterId: string) {
  const request = await verificationRepository.createRequest(
    {
      requesterId,
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

async function source(requestId: string) {
  const [row] = await db.select().from(jobs).where(eq(jobs.verificationRequestId, requestId));
  if (!row) throw Error("Missing fixture source");
  return row;
}

async function ready(requestId: string) {
  await db
    .update(jobs)
    .set({ availableAt: new Date(0) })
    .where(eq(jobs.verificationRequestId, requestId));
}

async function isolated(requestId: string) {
  await db
    .update(jobs)
    .set({ createdAt: new Date("2001-01-01T00:00:00Z"), availableAt: new Date(0) })
    .where(eq(jobs.verificationRequestId, requestId));
}

async function notices(requestId: string) {
  const ids = actors.map((userId) => noticeId(requestId, userId));
  return db
    .select()
    .from(notifications)
    .where(inArray(notifications.id, ids))
    .orderBy(asc(notifications.recipientId));
}

async function drain(requestId: string, limit = 20) {
  for (let page = 0; page < 20; page++) {
    if ((await source(requestId)).completedAt) return;
    await ready(requestId);
    expect(["progress", "completed"]).toContain((await delivery.processNext(limit)).state);
  }
  throw Error("Fixture delivery did not complete");
}

async function failInsert(table: "verification_notification_deliveries" | "notifications", value: string) {
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

it("delivers verification inbox through the shared worker repository without leaking private fields", async () => {
  const requesterId = await actor();
  const moderator = await actor("moderator");
  const request = await apply(requesterId);
  await isolated(request.id);
  expect(await delivery.processNext()).toEqual({
    state: "completed",
    recipients: 1,
    stored: 1,
    pushDeferred: 0,
  });
  expect((await source(request.id)).completedAt).toBeInstanceOf(Date);
  const stored = await notices(request.id);
  expect(stored).toEqual([
    expect.objectContaining({
      recipientId: moderator,
      title: "New verification request",
      message: "A verification request is awaiting review.",
      link: PENDING_LINK,
      type: "security",
      category: "security",
    }),
  ]);
  expect(JSON.stringify(stored)).not.toContain("PRIVATE_");
  expect(JSON.stringify(stored)).not.toContain(requesterId);
  expect(JSON.stringify(stored)).not.toContain(request.id);
  const dispatcher = await readFile(
    path.resolve(import.meta.dirname, "../packages/db/scripts/run-web-push-dispatcher.ts"),
    "utf8",
  );
  expect(dispatcher).toContain("verificationNotificationDeliveryRepository");
  expect(dispatcher).toContain("verification-delivery");
});

it("atomically creates the request with its delivery source", async () => {
  const requesterId = await actor();
  const name = `verification_delivery_block_${randomUUID().replaceAll("-", "")}`;
  await db.execute(
    sql.raw(
      `create function ${name}() returns trigger language plpgsql as $$ begin raise exception 'PRIVATE_INSERT_FAILURE'; end $$`,
    ),
  );
  triggers.push({ table: "verification_notification_deliveries", name });
  await db.execute(
    sql.raw(
      `create trigger ${name} before insert on verification_notification_deliveries for each row execute function ${name}()`,
    ),
  );
  await expect(apply(requesterId)).rejects.toThrow();
  expect(
    await db.select().from(verificationRequests).where(eq(verificationRequests.requesterId, requesterId)),
  ).toEqual([]);
  expect(
    await db.select().from(auditEvents).where(eq(auditEvents.actorId, requesterId)),
  ).toEqual([]);
  expect(await db.select().from(jobs)).toEqual([]);
  await db.execute(sql.raw(`drop trigger ${name} on verification_notification_deliveries`));
  await db.execute(sql.raw(`drop function ${name}()`));
  triggers.splice(
    triggers.findIndex((entry) => entry.name === name),
    1,
  );
  const request = await apply(requesterId);
  expect(await source(request.id)).toMatchObject({
    event: "application",
    lastRecipientId: null,
    completedAt: null,
  });
});

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

it("uses current roles and the fixed account horizon", async () => {
  const demoted = await actor("moderator");
  const promoted = await actor();
  const late = await actor("admin");
  const requesterId = await actor();
  const request = await apply(requesterId);
  await isolated(request.id);
  await db.update(users).set({ role: "user" }).where(eq(users.id, demoted));
  await db.update(users).set({ role: "admin" }).where(eq(users.id, promoted));
  await db
    .update(users)
    .set({ createdAt: new Date("2002-01-01T00:00:00Z") })
    .where(eq(users.id, late));
  await drain(request.id);
  expect(await notices(request.id)).toMatchObject([
    {
      recipientId: promoted,
      title: "New verification request",
      message: "A verification request is awaiting review.",
      link: PENDING_LINK,
    },
  ]);
  expect(await notices(request.id)).toHaveLength(1);
  expect(JSON.stringify(await notices(request.id))).not.toContain("PRIVATE_");
  expect(JSON.stringify(await notices(request.id))).not.toContain(requesterId);
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
  // Exhausted jobs stay unclaimed until an operator reset.
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

it("keeps stable notice IDs across restart so completed delivery is idempotent", async () => {
  const moderator = await actor("moderator");
  const requesterId = await actor();
  const request = await apply(requesterId);
  await isolated(request.id);
  await drain(request.id);
  const first = await notices(request.id);
  expect(first).toEqual([
    expect.objectContaining({
      id: noticeId(request.id, moderator),
      recipientId: moderator,
      isRead: false,
    }),
  ]);
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(eq(notifications.id, noticeId(request.id, moderator)));
  expect(await delivery.processNext()).toEqual({
    state: "idle",
    recipients: 0,
    stored: 0,
    pushDeferred: 0,
  });
  expect(await notices(request.id)).toEqual([
    expect.objectContaining({
      id: noticeId(request.id, moderator),
      isRead: true,
    }),
  ]);
});
