import { createHash, randomUUID } from "node:crypto";
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
import { afterEach, expect, vi } from "vitest";
import {
  BuildIncidentNotificationDeliveryRepository,
  buildIncidentNotificationDeliveryRepository as delivery,
} from "../../packages/db/src/repositories/build-incident-notification-delivery";
import {
  auditEvents,
  builds,
  entitlements,
  buildIncidentNotificationDeliveries as jobs,
  notifications,
  products,
  sessions,
  users,
} from "../../packages/db/src/schema";

export {
  BuildIncidentNotificationDeliveryRepository,
  builds,
  db,
  delivery,
  eq,
  jobs,
  listExhaustedNotificationDeliveries,
  notifications,
  products,
  resetExhaustedNotificationDelivery,
};

const actors: string[] = [];
const productIds: string[] = [];
const buildIds: string[] = [];
const entitlementIds: string[] = [];
const triggers: { table: string; name: string }[] = [];

const id = (prefix: string) => `${prefix}_bi_delivery_${randomUUID().replaceAll("-", "")}`;

export const noticeId = (buildId: string, recipientId: string) =>
  `ntf_build_incident_${createHash("sha256")
    .update(JSON.stringify([buildId, recipientId]))
    .digest("hex")}`;

/** Register shared afterEach cleanup for build-incident notification delivery suites. */
export function setupBuildIncidentNotificationDelivery() {
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
}

export async function actor(role = "user", prefix = "usr") {
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

export async function moderator() {
  const userId = await actor("admin", "mod");
  await sessionRepository.create({
    id: id("ses"),
    userId,
    token: `tok_${userId}`,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  return userId;
}

export async function publishedBuild(authorId: string) {
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
  const token = `tok_dlv_${userId}`;
  try {
    await sessionRepository.create({
      id: id("ses"),
      userId,
      token,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
  } catch {
    // Actor may already hold a download session from an earlier receipt.
  }
  await authorization.authorize({
    actorId: userId,
    currentToken: token,
    expected,
    pinned: true,
    receiptId,
    auditId: id("aud"),
  });
  return receiptId;
}

export async function servedReceipt(userId: string, productId: string, buildId: string) {
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

export async function startedReceipt(userId: string, productId: string, buildId: string) {
  await grantDownload(userId, productId);
  return startReceipt(userId, buildId);
}

export async function quarantine(
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

export async function source(buildId: string) {
  const [row] = await db.select().from(jobs).where(eq(jobs.buildId, buildId));
  if (!row) throw Error("Missing fixture source");
  return row;
}

export async function ready(buildId: string) {
  await db
    .update(jobs)
    .set({ availableAt: new Date(0) })
    .where(eq(jobs.buildId, buildId));
}

export async function isolated(buildId: string) {
  await db
    .update(jobs)
    .set({ createdAt: new Date("2001-01-01T00:00:00Z"), availableAt: new Date(0) })
    .where(eq(jobs.buildId, buildId));
}

export async function notices(buildId: string, recipientIds: string[]) {
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

export async function drain(buildId: string, limit = 20) {
  for (let page = 0; page < 20; page++) {
    if ((await source(buildId)).completedAt) return;
    await ready(buildId);
    expect(["progress", "completed"]).toContain((await delivery.processNext(limit)).state);
  }
  throw Error("Fixture delivery did not complete");
}

export async function failInsert(
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
