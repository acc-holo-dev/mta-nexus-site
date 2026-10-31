import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  resourceDownloadAuthorizationRepository as authorization,
  buildRepository,
  db,
  listExhaustedNotificationDeliveries,
  productRepository,
  resourceDeliveriesRepository as receipts,
  resetExhaustedNotificationDelivery,
  sessionRepository,
  userRepository,
} from "@nexus/db";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { afterEach, expect, it, vi } from "vitest";
import {
  BuildIncidentNotificationDeliveryRepository,
  buildIncidentNotificationDeliveryRepository as delivery,
} from "../packages/db/src/repositories/build-incident-notification-delivery";
import {
  auditEvents,
  builds,
  entitlements,
  buildIncidentNotificationDeliveries as jobs,
  notifications,
  products,
  sessions,
  users,
} from "../packages/db/src/schema";

const actors: string[] = [];
const productIds: string[] = [];
const buildIds: string[] = [];
const entitlementIds: string[] = [];
const triggers: { table: string; name: string }[] = [];
const id = (prefix: string) => `${prefix}_bi_delivery_${randomUUID().replaceAll("-", "")}`;
const noticeId = (buildId: string, recipientId: string) =>
  `ntf_build_incident_${createHash("sha256")
    .update(JSON.stringify([buildId, recipientId]))
    .digest("hex")}`;

afterEach(async () => {
  vi.restoreAllMocks();
  for (const { table, name } of triggers.splice(0)) {
    await db.execute(sql.raw(`drop trigger if exists ${name} on ${table}`));
    await db.execute(sql.raw(`drop function if exists ${name}()`));
  }
  // Receipts may only be removed with their account (delivery guard).
  if (actors.length) {
    const noticeIds = actors.flatMap((userId) =>
      buildIds.map((buildId) => noticeId(buildId, userId)),
    );
    if (noticeIds.length) {
      await db.delete(notifications).where(inArray(notifications.id, noticeIds));
    }
  }
  if (entitlementIds.length) {
    await db.delete(entitlements).where(inArray(entitlements.id, entitlementIds));
  }
  if (buildIds.length) {
    await db.delete(jobs).where(inArray(jobs.buildId, buildIds));
    await db.delete(auditEvents).where(inArray(auditEvents.targetId, buildIds));
    await db.delete(builds).where(inArray(builds.id, buildIds));
  }
  if (productIds.length) {
    await db.delete(auditEvents).where(inArray(auditEvents.targetId, productIds));
    await db.delete(products).where(inArray(products.id, productIds));
  }
  if (actors.length) {
    await db.delete(sessions).where(inArray(sessions.userId, actors));
    await db.delete(users).where(inArray(users.id, actors));
  }
  actors.length = 0;
  productIds.length = 0;
  buildIds.length = 0;
  entitlementIds.length = 0;
});

async function actor(role = "user", prefix = "usr") {
  const userId = id(prefix);
  await userRepository.create({
    id: userId,
    username: userId,
    email: `${userId}@nexus.test`,
    displayName: "Build incident delivery fixture",
    role,
  });
  actors.push(userId);
  return userId;
}

async function moderator() {
  const userId = await actor("admin", "mod");
  await sessionRepository.create({
    id: id("ses"),
    userId,
    token: `tok_${userId}`,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  return userId;
}

async function publishedBuild(authorId: string) {
  const productId = id("prd");
  const buildId = id("bld");
  productIds.push(productId);
  buildIds.push(buildId);
  await productRepository.create({
    id: productId,
    title: "Build incident fixture",
    slug: productId,
    description: "SEC-002 delivery fixture",
    type: "script",
    status: "published",
    authorId,
    price: 0,
    currency: "USD",
    licenseModel: "unlimited",
    tags: [],
    currentVersion: "1.0.0",
    ratingAverage: 0,
    ratingCount: 0,
    salesCount: 0,
    isFeatured: false,
    screenshots: [],
    compatibility: { dependencies: [] },
  });
  await buildRepository.create({
    id: buildId,
    productId,
    version: "1.0.0",
    releaseNotes: "fixture",
    status: "published",
    storageKey: `fixtures/${buildId}.zip`,
    sha256Hash: "a".repeat(64),
    fileSizeBytes: 7,
    fileName: "1.0.0.zip",
    mimeType: "application/zip",
    scanStatus: "clean",
    scanner: "test-scanner",
    scannedAt: new Date(),
    isSigned: false,
  });
  return { productId, buildId, version: "1.0.0" };
}

async function grantDownload(userId: string, productId: string) {
  const entitlementId = id("ent");
  entitlementIds.push(entitlementId);
  await db.insert(entitlements).values({
    id: entitlementId,
    subjectType: "user",
    subjectId: userId,
    permission: "product.download",
    resourceId: productId,
  });
}

async function startReceipt(userId: string, buildId: string) {
  const expected = await buildRepository.findById(buildId);
  if (!expected) throw Error("Missing fixture build");
  const receiptId = id("dlv");
  await authorization.authorize({
    actorId: userId,
    expected,
    pinned: true,
    receiptId,
    auditId: id("aud"),
  });
  return receiptId;
}

async function servedReceipt(userId: string, productId: string, buildId: string) {
  await grantDownload(userId, productId);
  const receiptId = await startReceipt(userId, buildId);
  const expected = await buildRepository.findById(buildId);
  if (!expected) throw Error("Missing fixture build");
  await receipts.finish({
    userId,
    receiptId,
    auditId: id("aud"),
    result: {
      status: "served",
      bytesSent: expected.fileSizeBytes,
      errorCode: null,
    },
  });
  return receiptId;
}

async function startedReceipt(userId: string, productId: string, buildId: string) {
  await grantDownload(userId, productId);
  return startReceipt(userId, buildId);
}

async function quarantine(
  buildId: string,
  moderatorId: string,
  notifyAffectedDownloaders: boolean,
) {
  return buildRepository.quarantinePublishedAndRefreshProduct(
    buildId,
    moderatorId,
    "PRIVATE_QUARANTINE_REASON",
    {
      id: id("aud"),
      actorId: moderatorId,
      actorType: "admin",
      action: "build.quarantined",
      targetId: buildId,
      targetType: "build",
      details: { reason: "PRIVATE_QUARANTINE_REASON" },
    },
    `tok_${moderatorId}`,
    { notifyAffectedDownloaders },
  );
}

async function source(buildId: string) {
  const [row] = await db.select().from(jobs).where(eq(jobs.buildId, buildId));
  if (!row) throw Error("Missing fixture source");
  return row;
}

async function ready(buildId: string) {
  await db
    .update(jobs)
    .set({ availableAt: new Date(0) })
    .where(eq(jobs.buildId, buildId));
}

async function isolated(buildId: string) {
  await db
    .update(jobs)
    .set({ createdAt: new Date("2001-01-01T00:00:00Z"), availableAt: new Date(0) })
    .where(eq(jobs.buildId, buildId));
}

async function notices(buildId: string, recipientIds: string[]) {
  return db
    .select()
    .from(notifications)
    .where(
      inArray(
        notifications.id,
        recipientIds.map((recipientId) => noticeId(buildId, recipientId)),
      ),
    )
    .orderBy(asc(notifications.recipientId));
}

async function drain(buildId: string, limit = 20) {
  for (let page = 0; page < 20; page++) {
    if ((await source(buildId)).completedAt) return;
    await ready(buildId);
    expect(["progress", "completed"]).toContain((await delivery.processNext(limit)).state);
  }
  throw Error("Fixture delivery did not complete");
}

async function failInsert(
  table: "build_incident_notification_deliveries" | "notifications",
  value: string,
) {
  const column = table === "notifications" ? "recipient_id" : "build_id";
  const name = `bi_fail_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
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

it("enqueues SEC-002 fanout only when quarantine explicitly requests downloader notice", async () => {
  const authorId = await actor("developer", "auth");
  const moderatorId = await moderator();
  const downloaderId = await actor("user", "dl");
  const { productId, buildId, version } = await publishedBuild(authorId);
  await servedReceipt(downloaderId, productId, buildId);

  await quarantine(buildId, moderatorId, false);
  expect(await db.select().from(jobs).where(eq(jobs.buildId, buildId))).toEqual([]);

  // Restore publish path for a second quarantine with notify.
  await db
    .update(builds)
    .set({
      status: "published",
      quarantinePreviousStatus: null,
      quarantineReason: null,
      quarantinedAt: null,
      quarantinedBy: null,
    })
    .where(eq(builds.id, buildId));
  await db
    .update(products)
    .set({ status: "published", currentVersion: version })
    .where(eq(products.id, productId));
  await quarantine(buildId, moderatorId, true);
  expect(await source(buildId)).toMatchObject({
    productId,
    version,
    attempts: 0,
    lastRecipientId: null,
    completedAt: null,
  });
});

it("delivers served-receipt recipients idempotently with generic security copy", async () => {
  const authorId = await actor("developer", "auth");
  const moderatorId = await moderator();
  const first = await actor("user", "aaa");
  const second = await actor("user", "bbb");
  const skipped = await actor("user", "ccc");
  const { productId, buildId } = await publishedBuild(authorId);
  await servedReceipt(first, productId, buildId);
  await servedReceipt(second, productId, buildId);
  await startedReceipt(skipped, productId, buildId);
  await quarantine(buildId, moderatorId, true);
  await isolated(buildId);

  const existingId = noticeId(buildId, first);
  const originalTime = new Date("2000-06-01T00:00:00Z");
  await db.insert(notifications).values({
    id: existingId,
    recipientId: first,
    type: "security",
    category: "security",
    title: "Security notice for a downloaded build",
    message:
      "A build you downloaded was quarantined after a security review. Stop using that version and check for an updated release in your library.",
    link: "/security",
    isRead: true,
    createdAt: originalTime,
  });

  expect(await delivery.processNext()).toEqual({
    state: "completed",
    recipients: 2,
    stored: 1,
    pushDeferred: 0,
  });
  const stored = await notices(buildId, [first, second, skipped]);
  expect(stored.map((row) => row.recipientId)).toEqual([first, second].sort());
  expect(stored.find((row) => row.id === existingId)).toMatchObject({
    isRead: true,
    createdAt: originalTime,
  });
  for (const row of stored) {
    expect(row).toMatchObject({
      title: "Security notice for a downloaded build",
      link: "/security",
      type: "security",
      category: "security",
    });
    expect(row.message).toContain("quarantined after a security review");
    expect(JSON.stringify(row)).not.toContain("PRIVATE_");
  }
  expect((await source(buildId)).completedAt).toBeInstanceOf(Date);

  const dispatcher = await readFile(
    path.resolve(import.meta.dirname, "../packages/db/scripts/run-web-push-dispatcher.ts"),
    "utf8",
  );
  expect(dispatcher).toContain("buildIncidentNotificationDeliveryRepository");
});

it("pages recipients across concurrent workers without skipping the cursor", async () => {
  const authorId = await actor("developer", "auth");
  const moderatorId = await moderator();
  const recipients = await Promise.all(Array.from({ length: 5 }, () => actor("user", "dl")));
  recipients.sort();
  const { productId, buildId } = await publishedBuild(authorId);
  for (const recipientId of recipients) {
    await servedReceipt(recipientId, productId, buildId);
  }
  await quarantine(buildId, moderatorId, true);
  await isolated(buildId);

  await Promise.all([
    delivery.processNext(2),
    new BuildIncidentNotificationDeliveryRepository().processNext(2),
  ]);
  const afterConcurrent = await source(buildId);
  expect([recipients[1], recipients[3]]).toContain(afterConcurrent.lastRecipientId);
  await drain(buildId, 2);
  expect((await notices(buildId, recipients)).map((row) => row.recipientId)).toEqual(recipients);
  expect((await source(buildId)).completedAt).not.toBeNull();
});

it("rolls back a failed page, exhausts attempts, then resumes after a single-id operator reset", async () => {
  const authorId = await actor("developer", "auth");
  const moderatorId = await moderator();
  const first = await actor("user", "aaa");
  const second = await actor("user", "bbb");
  const { productId, buildId } = await publishedBuild(authorId);
  await servedReceipt(first, productId, buildId);
  await servedReceipt(second, productId, buildId);
  await quarantine(buildId, moderatorId, true);
  await isolated(buildId);

  const removeFailure = await failInsert("notifications", second);
  for (let attempt = 1; attempt <= 5; attempt++) {
    await ready(buildId);
    expect(await delivery.processNext(2)).toEqual({
      state: attempt === 5 ? "failed" : "retry",
      recipients: 0,
      stored: 0,
      pushDeferred: 0,
    });
    expect(await source(buildId)).toMatchObject({
      attempts: attempt,
      lastRecipientId: null,
      completedAt: null,
    });
    expect((await source(buildId)).availableAt.getTime()).toBeGreaterThan(Date.now());
    expect(await notices(buildId, [first, second])).toEqual([]);
  }
  expect((await delivery.stats()).failed).toBeGreaterThanOrEqual(1);
  expect(await delivery.processNext(2)).toEqual({
    state: "idle",
    recipients: 0,
    stored: 0,
    pushDeferred: 0,
  });

  const listed = await listExhaustedNotificationDeliveries({
    channel: "build_incident",
    limit: 20,
  });
  expect(listed).toEqual([
    expect.objectContaining({
      channel: "build_incident",
      failed: expect.any(Number),
      items: expect.arrayContaining([
        expect.objectContaining({ channel: "build_incident", id: buildId, attempts: 5 }),
      ]),
    }),
  ]);

  await removeFailure();
  await ready(buildId);
  await delivery.processNext(2);
  expect(await notices(buildId, [first, second])).toEqual([]);

  expect(await resetExhaustedNotificationDelivery("build_incident", buildId)).toEqual({
    channel: "build_incident",
    id: buildId,
    reset: true,
  });
  expect(await resetExhaustedNotificationDelivery("build_incident", buildId)).toEqual({
    channel: "build_incident",
    id: buildId,
    reset: false,
  });
  await drain(buildId, 2);
  expect((await notices(buildId, [first, second])).map((row) => row.recipientId)).toEqual(
    [first, second].sort(),
  );
});

it("recovers a lost process before commit with no partial inbox or cursor", async () => {
  const authorId = await actor("developer", "auth");
  const moderatorId = await moderator();
  const recipientId = await actor("user", "dl");
  const { productId, buildId } = await publishedBuild(authorId);
  await servedReceipt(recipientId, productId, buildId);
  await quarantine(buildId, moderatorId, true);
  await isolated(buildId);

  const original = db.transaction.bind(db);
  vi.spyOn(db, "transaction").mockImplementationOnce((run) =>
    original(async (tx) => {
      await run(tx);
      throw Error("SIMULATED_PROCESS_EXIT");
    }),
  );
  await expect(delivery.processNext()).rejects.toThrow("SIMULATED_PROCESS_EXIT");
  vi.restoreAllMocks();
  expect(await notices(buildId, [recipientId])).toEqual([]);
  expect(await source(buildId)).toMatchObject({
    attempts: 0,
    lastRecipientId: null,
    completedAt: null,
  });
  await drain(buildId);
  expect(await notices(buildId, [recipientId])).toHaveLength(1);
});

it("validates batch bounds and keeps the default page at twenty recipients", async () => {
  for (const limit of [0, -1, 101, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    await expect(delivery.processNext(limit)).rejects.toThrow(RangeError);
  }
  const authorId = await actor("developer", "auth");
  const moderatorId = await moderator();
  const recipients = await Promise.all(Array.from({ length: 21 }, () => actor("user", "dl")));
  const { productId, buildId } = await publishedBuild(authorId);
  for (const recipientId of recipients) {
    await servedReceipt(recipientId, productId, buildId);
  }
  await quarantine(buildId, moderatorId, true);
  await isolated(buildId);
  expect(await delivery.processNext()).toEqual({
    state: "progress",
    recipients: 20,
    stored: 20,
    pushDeferred: 0,
  });
  expect(await notices(buildId, recipients)).toHaveLength(20);
  await drain(buildId, 100);
  expect(await notices(buildId, recipients)).toHaveLength(21);
});
