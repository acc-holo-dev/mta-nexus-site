import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq, inArray, sql } from "drizzle-orm";
import { afterEach, expect, it } from "vitest";
import { db } from "../packages/db/src/client";
import { notificationRepository } from "../packages/db/src/repositories/notifications";
import { sessionRepository } from "../packages/db/src/repositories/sessions";
import { userRepository } from "../packages/db/src/repositories/users";
import {
  WebPushAdmissionRecoveryRepository,
  webPushAdmissionRecoveryRepository as recovery,
} from "../packages/db/src/repositories/web-push-admission-recovery";
import { webPushSubscriptionRepository } from "../packages/db/src/repositories/web-push-subscriptions";
import {
  notifications,
  users,
  webPushAdmissionRecovery as intents,
  webPushOutbox,
  webPushSubscriptions,
} from "../packages/db/src/schema";

const actors: string[] = [];
const triggers: { name: string; table: string }[] = [];
let originalCapacity: number | undefined;

function deferred() {
  let resolve = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

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

async function fixture() {
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

async function saturate() {
  const [gate] = await db.execute(sql`select capacity from web_push_queue_gate`);
  originalCapacity ??= Number(gate.capacity);
  // A two-device fixture cannot fit even if this database has no other jobs.
  await db.execute(sql`update web_push_queue_gate set capacity=1`);
}

async function pendingFixture() {
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

async function ready(notificationId: string) {
  await db
    .update(intents)
    .set({ availableAt: new Date(0) })
    .where(eq(intents.notificationId, notificationId));
}

async function freeCapacity() {
  await db.execute(sql`update web_push_queue_gate set capacity=50000`);
}

const intent = (id: string) => db.select().from(intents).where(eq(intents.notificationId, id));
const jobs = (id: string) =>
  db.select().from(webPushOutbox).where(eq(webPushOutbox.notificationId, id));

async function failInsert(
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

it("recovers saturation across worker instances using only original devices and the original deadline", async () => {
  const f = await pendingFixture();
  const newDevice = `${f.subscriptionId}_later`;
  await f.subscribe(newDevice);
  await db.execute(
    sql`update web_push_subscriptions set created_at=(select created_at + interval '1 second' from notifications where id=${f.notificationId}) where id=${newDevice}`,
  );
  await freeCapacity();
  expect(await new WebPushAdmissionRecoveryRepository().processNext()).toEqual({
    state: "completed",
    pushJobs: 2,
  });
  expect(await intent(f.notificationId)).toEqual([]);
  expect((await jobs(f.notificationId)).map((row) => row.subscriptionId).sort()).toEqual(
    [f.subscriptionId, `${f.subscriptionId}_second`].sort(),
  );
  const proof = await db.execute(
    sql`select bool_and(o.expires_at=n.created_at + interval '24 hours') as original_deadline from web_push_outbox o join notifications n on n.id=o.notification_id where n.id=${f.notificationId}`,
  );
  expect(proof[0].original_deadline).toBe(true);
  // Simulate acceptance/cleanup by the sender. Absence of a pending intent must
  // prevent another admission even when outbox deduplication rows are gone.
  await db.delete(webPushOutbox).where(eq(webPushOutbox.notificationId, f.notificationId));
  await db.transaction((tx) =>
    notificationRepository.createWithPushOutboxWithin(tx, f.notice, true),
  );
  await recovery.processNext();
  expect(await intent(f.notificationId)).toEqual([]);
  expect(await jobs(f.notificationId)).toEqual([]);
});

it("serializes concurrent recovery without duplicate jobs or inbox rows", async () => {
  const f = await pendingFixture();
  await freeCapacity();
  const results = await Promise.all([
    recovery.processNext(),
    new WebPushAdmissionRecoveryRepository().processNext(),
  ]);
  expect(results.reduce((sum, value) => sum + value.pushJobs, 0)).toBe(2);
  expect(await jobs(f.notificationId)).toHaveLength(2);
  expect(await intent(f.notificationId)).toEqual([]);
  expect(
    await db.select().from(notifications).where(eq(notifications.id, f.notificationId)),
  ).toHaveLength(1);
});

it("continues past a locked recipient without consuming its retry or losing its intent", async () => {
  const first = await pendingFixture();
  const second = await pendingFixture();
  await db
    .update(intents)
    .set({ availableAt: new Date(-1000) })
    .where(eq(intents.notificationId, first.notificationId));
  await freeCapacity();
  const locked = deferred();
  const release = deferred();
  const blocker = db.transaction(async (tx) => {
    await tx.select().from(users).where(eq(users.id, first.userId)).for("update");
    locked.resolve();
    await release.promise;
  });
  try {
    await Promise.race([locked.promise, blocker]);
    expect(await recovery.processNext()).toEqual({ state: "completed", pushJobs: 2 });
    expect(await intent(first.notificationId)).toEqual([expect.objectContaining({ attempts: 0 })]);
    expect(await jobs(first.notificationId)).toEqual([]);
    expect(await intent(second.notificationId)).toEqual([]);
  } finally {
    release.resolve();
    await blocker;
  }
  await ready(first.notificationId);
  expect(await recovery.processNext()).toEqual({ state: "completed", pushJobs: 2 });
});

it("defers a full page for a locked account so another recipient can advance", async () => {
  const blocked = await pendingFixture();
  const blockedIds = [blocked.notificationId];
  for (let index = 1; index < 20; index++) {
    const id = `${blocked.notificationId}_${index}`;
    expect(
      await notificationRepository.createWithPushOutbox({ ...blocked.notice, id }),
    ).toMatchObject({ pushQueueState: "saturated" });
    blockedIds.push(id);
  }
  const runnable = await pendingFixture();
  await db
    .update(intents)
    .set({ availableAt: new Date(-1000) })
    .where(inArray(intents.notificationId, blockedIds));
  await freeCapacity();
  const locked = deferred();
  const release = deferred();
  const blocker = db.transaction(async (tx) => {
    await tx.select().from(users).where(eq(users.id, blocked.userId)).for("update");
    locked.resolve();
    await release.promise;
  });
  try {
    await Promise.race([locked.promise, blocker]);
    expect(await recovery.processNext()).toEqual({ state: "skipped", pushJobs: 0 });
    expect(await recovery.processNext()).toEqual({ state: "completed", pushJobs: 2 });
    expect(await jobs(runnable.notificationId)).toHaveLength(2);
    const pending = await db
      .select()
      .from(intents)
      .where(inArray(intents.notificationId, blockedIds));
    expect(pending).toHaveLength(20);
    expect(pending.every((row) => row.attempts === 0 && row.availableAt > new Date(0))).toBe(true);
  } finally {
    release.resolve();
    await blocker;
  }
});

it("keeps the inbox and retry evidence on queue error, then recovers after the cause is removed", async () => {
  const f = await fixture();
  const removeFailure = await failInsert("web_push_outbox", f.notificationId);
  expect(await f.create()).toMatchObject({
    pushQueueState: "error",
    pushJobs: 0,
    notification: { id: f.notificationId },
  });
  expect(await intent(f.notificationId)).toHaveLength(1);
  expect(await jobs(f.notificationId)).toEqual([]);
  await removeFailure();
  await ready(f.notificationId);
  expect(await recovery.processNext()).toEqual({ state: "completed", pushJobs: 1 });
});

it("rolls back source inbox creation when durable recovery evidence cannot be stored", async () => {
  const f = await fixture();
  await failInsert("web_push_outbox", f.notificationId);
  await failInsert("web_push_admission_recovery", f.notificationId);
  await expect(f.create()).rejects.toThrow();
  expect(
    await db.select().from(notifications).where(eq(notifications.id, f.notificationId)),
  ).toEqual([]);
  expect(await jobs(f.notificationId)).toEqual([]);
});

it("rolls back optional jobs when the admission proof cannot be consumed", async () => {
  const f = await pendingFixture();
  await freeCapacity();
  const removeFailure = await failInsert("web_push_admission_recovery", f.notificationId, "delete");
  expect(await recovery.processNext()).toEqual({ state: "retry", pushJobs: 0 });
  expect(await intent(f.notificationId)).toEqual([expect.objectContaining({ attempts: 1 })]);
  expect(await jobs(f.notificationId)).toEqual([]);
  await removeFailure();
  await ready(f.notificationId);
  expect(await recovery.processNext()).toEqual({ state: "completed", pushJobs: 2 });
});

it("bounds retries, exposes exhaustion, and expires terminal evidence without renewing delivery", async () => {
  const f = await pendingFixture();
  for (let attempt = 1; attempt <= 5; attempt++) {
    await ready(f.notificationId);
    expect(await recovery.processNext()).toMatchObject({
      state: attempt === 5 ? "failed" : "retry",
      pushJobs: 0,
    });
    expect(await intent(f.notificationId)).toEqual([
      expect.objectContaining({ attempts: attempt }),
    ]);
  }
  const stats = await recovery.stats();
  expect(stats.failed).toBeGreaterThanOrEqual(1);
  await ready(f.notificationId);
  await freeCapacity();
  await recovery.processNext();
  expect(await jobs(f.notificationId)).toEqual([]);
  await db.execute(
    sql`update notifications set created_at=clock_timestamp()-interval '25 hours' where id=${f.notificationId}`,
  );
  await db.execute(
    sql`update web_push_admission_recovery set created_at=(select created_at from notifications where id=${f.notificationId}) where notification_id=${f.notificationId}`,
  );
  await recovery.processNext();
  expect(await intent(f.notificationId)).toEqual([]);
  expect(await jobs(f.notificationId)).toEqual([]);
});

it.each(["read", "preference", "revoked session", "expired", "deleted"] as const)(
  "does not recover push after the notice is %s",
  async (reason) => {
    const f = await pendingFixture();
    if (reason === "read") await notificationRepository.markAsRead(f.notificationId, f.userId);
    if (reason === "preference")
      await notificationRepository.updatePreferences(f.userId, { systemEnabled: false });
    if (reason === "revoked session") await sessionRepository.deleteById(f.sessionId, f.userId);
    if (reason === "expired") {
      await db.execute(
        sql`update notifications set created_at=clock_timestamp()-interval '25 hours' where id=${f.notificationId}`,
      );
      await db.execute(
        sql`update web_push_admission_recovery set created_at=(select created_at from notifications where id=${f.notificationId}) where notification_id=${f.notificationId}`,
      );
    }
    if (reason === "deleted")
      await db.delete(notifications).where(eq(notifications.id, f.notificationId));
    await freeCapacity();
    await recovery.processNext();
    expect(await intent(f.notificationId)).toEqual([]);
    expect(await jobs(f.notificationId)).toEqual([]);
    if (reason === "read")
      expect(await notificationRepository.findById(f.notificationId)).toMatchObject({
        isRead: true,
      });
  },
);

it("the real worker repairs admission without VAPID and logs only aggregate results", async () => {
  const f = await pendingFixture();
  await freeCapacity();
  const root = await mkdtemp(path.join(tmpdir(), "nexus-admission-worker-"));
  try {
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "packages/db/scripts/run-web-push-dispatcher.ts", "--once"],
      {
        cwd: path.resolve(import.meta.dirname, ".."),
        encoding: "utf8",
        timeout: 30000,
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
    expect(result.stdout).toContain('"status":"push-admission-recovery"');
    expect(result.stdout + result.stderr).not.toMatch(/PRIVATE_|usr_admission_|ntf_admission_/u);
    expect(await intent(f.notificationId)).toEqual([]);
    expect(await jobs(f.notificationId)).toHaveLength(2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 40000);
