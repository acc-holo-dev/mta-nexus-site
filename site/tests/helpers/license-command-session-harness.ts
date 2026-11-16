import { randomBytes, randomUUID } from "node:crypto";
import {
  auditEvents,
  licenseRuntimeBindings as bindings,
  builds,
  db,
  entitlements,
  licenses,
  products,
  serverRepository,
  servers,
  sessionRepository,
  userRepository,
  users,
} from "@nexus/db";
import { eq, inArray, sql } from "drizzle-orm";
import { afterEach, expect } from "vitest";

export const id = (prefix: string) => `${prefix}_${randomUUID().replaceAll("-", "")}`;

const fixtureUsers: string[] = [];
const fixtureProducts: string[] = [];
const fixtureServers: string[] = [];
const fixtureLicenses: string[] = [];

/** Register shared afterEach cleanup for license-command-session suites. */
export function setupLicenseCommandSession() {
  afterEach(async () => {
    if (fixtureUsers.length) {
      await db.delete(auditEvents).where(inArray(auditEvents.actorId, fixtureUsers));
      await db.delete(entitlements).where(inArray(entitlements.subjectId, fixtureUsers));
    }
    // Bindings cascade with their parent license; their guard disallows deleting them first.
    if (fixtureLicenses.length)
      await db.delete(licenses).where(inArray(licenses.id, fixtureLicenses));
    if (fixtureProducts.length)
      await db.delete(products).where(inArray(products.id, fixtureProducts));
    if (fixtureServers.length) await db.delete(servers).where(inArray(servers.id, fixtureServers));
    // Sessions, cart receipts and acquisition events cascade with the account.
    if (fixtureUsers.length) await db.delete(users).where(inArray(users.id, fixtureUsers));
    fixtureUsers.length = 0;
    fixtureProducts.length = 0;
    fixtureServers.length = 0;
    fixtureLicenses.length = 0;
  });
}

export async function account(role: "user" | "moderator" = "moderator") {
  const userId = id("usr_license_session");
  fixtureUsers.push(userId);
  const token = id("token");
  const sessionId = id("ses");
  await userRepository.create({
    id: userId,
    username: userId,
    email: `${userId}@nexus.test`,
    displayName: "License initiating session fixture",
    role,
  });
  await sessionRepository.create({
    id: sessionId,
    userId,
    token,
    expiresAt: new Date(Date.now() + 3600000),
  });
  // Another live session must never substitute for the initiating session.
  await sessionRepository.create({
    id: id("ses_other"),
    userId,
    token: id("other-token"),
    expiresAt: new Date(Date.now() + 3600000),
  });
  return { userId, token, sessionId };
}

let fixturePort = 22003;

export async function fixture() {
  const actor = await account();
  const productId = id("prd_z_license");
  const serverId = id("srv_license");
  const licenseId = id("lic_session");
  fixtureProducts.push(productId);
  fixtureServers.push(serverId);
  fixtureLicenses.push(licenseId);
  const expiresAt = new Date(Date.now() + 86400000);
  await db.insert(products).values({
    id: productId,
    authorId: actor.userId,
    title: "Recorded free resource",
    description: "Safe fixture",
    slug: productId,
    type: "script",
    status: "published",
  });
  await db.insert(builds).values({
    id: id("bld"),
    productId,
    version: "1.0.0",
    status: "published",
    storageKey: `fixture/${productId}.zip`,
    sha256Hash: "a".repeat(64),
    fileSizeBytes: 7,
    scanStatus: "clean",
    scanner: "integration-test",
    scannedAt: new Date(),
  });
  await serverRepository.create({
    id: serverId,
    ownerId: actor.userId,
    name: "Recorded server",
    slug: serverId,
    ipAddress: "198.51.100.181",
    port: fixturePort++,
    status: "active",
    visibility: "public",
    isVerified: true,
    mediaUrls: [],
    gameplayTags: [],
  });
  await db.insert(licenses).values({
    id: licenseId,
    key: id("private_key"),
    userId: actor.userId,
    productId,
    serverId,
    model: "single_server",
    status: "active",
    expiresAt,
  });
  await db.insert(bindings).values({
    licenseId,
    serverId,
    serverOwnerId: actor.userId,
    endpointRevision: 0,
  });
  await db
    .update(bindings)
    .set({
      tokenDigest: randomBytes(32).toString("hex"),
      tokenIssuedAt: new Date(),
      tokenExpiresAt: expiresAt,
    })
    .where(eq(bindings.licenseId, licenseId));
  const [license] = await db.select().from(licenses).where(eq(licenses.id, licenseId));
  return {
    ...actor,
    productId,
    serverId,
    licenseId,
    expiresAt,
    input: {
      licenseId,
      actorId: actor.userId,
      currentToken: actor.token,
      auditId: id("aud"),
      command: {
        action: "revoke_token" as const,
        reason: "Invalidate recorded credential",
        expectedUpdatedAt: license.updatedAt.toISOString(),
      },
    },
  };
}

export type LicenseCommandSessionFixture = Awaited<ReturnType<typeof fixture>>;

export async function snapshot(f: LicenseCommandSessionFixture) {
  return {
    license: await db.select().from(licenses).where(eq(licenses.id, f.licenseId)),
    binding: await db.select().from(bindings).where(eq(bindings.licenseId, f.licenseId)),
    audit: await db.select().from(auditEvents).where(eq(auditEvents.targetId, f.licenseId)),
  };
}

export function moderation(f: LicenseCommandSessionFixture) {
  return { ...f.input, command: { ...f.input.command, action: "suspend" as const } };
}

/** Track an extra product for afterEach cleanup (cart competition suite). */
export function trackProduct(productId: string) {
  fixtureProducts.push(productId);
}

function deferred() {
  let resolve = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

export async function waitForLock(table: string, mode = "") {
  await expect
    .poll(
      async () => {
        const [row] = await db.execute<{ waiting: boolean }>(sql`select exists (
      select 1 from pg_stat_activity where datname = current_database()
      and pid <> pg_backend_pid() and wait_event_type = 'Lock'
      and query like ${`%"${table}"%for ${mode}%`}
    ) as waiting`);
        return row.waiting;
      },
      { timeout: 10000, interval: 10 },
    )
    .toBe(true);
}

export async function block(
  f: LicenseCommandSessionFixture,
  table: "licenses" | "license_runtime_bindings" | "sessions",
) {
  const locked = deferred(),
    release = deferred();
  const column = table === "license_runtime_bindings" ? "license_id" : "id";
  const value = table === "sessions" ? f.sessionId : f.licenseId;
  const pending = db.transaction(async (tx) => {
    await tx.execute(sql`select ${sql.identifier(column)} from ${sql.identifier(table)}
      where ${sql.identifier(column)} = ${value} for update`);
    locked.resolve();
    await release.promise;
  });
  await Promise.race([locked.promise, pending]);
  return {
    release: async () => {
      release.resolve();
      await pending;
    },
  };
}
