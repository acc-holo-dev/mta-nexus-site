import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  db,
  webPushAdmissionRecovery as intents,
  notificationRepository,
  notifications,
  webPushAdmissionRecoveryRepository as recovery,
  sessionRepository,
  userRepository,
  users,
  WebPushAdmissionRecoveryRepository,
  webPushOutbox,
  webPushSubscriptionRepository,
  webPushSubscriptions,
} from "@nexus/db";
import { eq, inArray, sql } from "drizzle-orm";
import { afterEach, expect } from "vitest";
import { setNotificationPreferencesForTest } from "./notification-preferences-fixture";

export {
  db,
  eq,
  inArray,
  intents,
  mkdtemp,
  notificationRepository,
  notifications,
  path,
  randomUUID,
  recovery,
  rm,
  sessionRepository,
  setNotificationPreferencesForTest,
  spawnSync,
  sql,
  tmpdir,
  users,
  WebPushAdmissionRecoveryRepository,
  webPushOutbox,
};

const actors: string[] = [];
const triggers: { name: string; table: string }[] = [];
let originalCapacity: number | undefined;

/** Build a deferred promise used by lock-skip concurrency fixtures. */
export function deferred() {
  let resolve = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/** Register shared afterEach cleanup for web-push admission recovery suites. */
export function setupWebPushAdmissionRecovery() {
  afterEach(async () => {
    for (const { name, table } of triggers.splice(0)) {
      await db.execute(sql.raw(`drop trigger if exists ${name} on ${table}`));
      await db.execute(sql.raw(`drop function if exists ${name}()`));
    }
    if (actors.length) await db.delete(users).where(inArray(users.id, actors.splice(0)));
    if (originalCapacity !== undefined) {
      await db.execute(sql`update web_push_queue_gate set capacity=${originalCapacity}`);
      originalCapacity = undefined;
    }
  });
}

/** Seed user, session, subscription, and a create-with-outbox helper. */
export async function fixture() {
  const suffix = randomUUID().replaceAll("-", "");
  const userId = `usr_admission_${suffix}`;
  const sessionId = `ses_admission_${suffix}`;
  const subscriptionId = `wps_admission_${suffix}`;
  const notificationId = `ntf_admission_${suffix}`;
  await userRepository.create({
    id: userId,
    username: userId,
    email: `${userId}@nexus.test`,
    displayName: "Admission fixture",
    role: "user",
  });
  actors.push(userId);
  await sessionRepository.create({
    id: sessionId,
    userId,
    token: `tok_${suffix}`,
    expiresAt: new Date("2099-01-01T00:00:00Z"),
  });
  const subscribe = (id: string) =>
    webPushSubscriptionRepository.upsert({
      id,
      userId,
      sessionId,
      endpoint: `https://push.example.invalid/${id}`,
      p256dh: "PRIVATE_DEVICE_KEY",
      auth: "PRIVATE_DEVICE_AUTH",
      expirationAt: null,
    });
  await subscribe(subscriptionId);
  // Ensure device enrollment predates the event without wall-clock sleeps.
  await db
    .update(webPushSubscriptions)
    .set({ createdAt: new Date(0) })
    .where(eq(webPushSubscriptions.id, subscriptionId));
  const notice = {
    id: notificationId,
    recipientId: userId,
    title: "Admission fixture",
    message: "PRIVATE_NOTICE_BODY",
    type: "system" as const,
    category: "system" as const,
  };
  return {
    userId,
    sessionId,
    subscriptionId,
    notificationId,
    notice,
    subscribe,
    create: () => notificationRepository.createWithPushOutbox(notice),
  };
}

/** Shrink queue capacity so a two-device fixture saturates admission. */
export async function saturate() {
  const [gate] = await db.execute(sql`select capacity from web_push_queue_gate`);
  originalCapacity ??= Number(gate.capacity);
  // A two-device fixture cannot fit even if this database has no other jobs.
  await db.execute(sql`update web_push_queue_gate set capacity=1`);
}

/** Build a saturated pending-recovery fixture with two enrolled devices. */
export async function pendingFixture() {
  const f = await fixture();
  await f.subscribe(`${f.subscriptionId}_second`);
  await db
    .update(webPushSubscriptions)
    .set({ createdAt: new Date(0) })
    .where(eq(webPushSubscriptions.id, `${f.subscriptionId}_second`));
  await saturate();
  expect(await f.create()).toMatchObject({ pushQueueState: "saturated", pushJobs: 0 });
  await ready(f.notificationId);
  return f;
}

/** Make a recovery intent immediately claimable. */
export async function ready(notificationId: string) {
  await db
    .update(intents)
    .set({ availableAt: new Date(0) })
    .where(eq(intents.notificationId, notificationId));
}

/** Restore a large queue capacity so recovery can admit jobs. */
export async function freeCapacity() {
  await db.execute(sql`update web_push_queue_gate set capacity=50000`);
}

/** Read recovery intents for a notification. */
export const intent = (id: string) =>
  db.select().from(intents).where(eq(intents.notificationId, id));

/** Read outbox jobs for a notification. */
export const jobs = (id: string) =>
  db.select().from(webPushOutbox).where(eq(webPushOutbox.notificationId, id));

/**
 * Install a transient trigger that fails insert/delete for one notification id.
 * Returns a disposer that removes the trigger early when recovery should succeed.
 */
export async function failInsert(
  table: "web_push_outbox" | "web_push_admission_recovery",
  id: string,
  operation: "insert" | "delete" = "insert",
) {
  const name = `admission_failure_${randomUUID().replaceAll("-", "")}`;
  if (!/^[a-zA-Z0-9_]+$/u.test(id)) throw Error("Unsafe fixture ID");
  await db.execute(
    sql.raw(
      `create function ${name}() returns trigger language plpgsql as $$ begin raise exception 'PRIVATE_QUEUE_FAILURE'; end $$`,
    ),
  );
  triggers.push({ name, table });
  await db.execute(
    sql.raw(
      `create trigger ${name} before ${operation} on ${table} for each row when (${operation === "insert" ? "new" : "old"}.notification_id = '${id}') execute function ${name}()`,
    ),
  );
  return async () => {
    await db.execute(sql.raw(`drop trigger ${name} on ${table}`));
    await db.execute(sql.raw(`drop function ${name}()`));
    triggers.splice(
      triggers.findIndex((value) => value.name === name),
      1,
    );
  };
}
