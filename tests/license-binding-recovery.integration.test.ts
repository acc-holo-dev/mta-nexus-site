import { randomBytes, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { expect, it } from "vitest";
import {
  db,
  licenseControlsRepository as repo,
  serverClaimChallengeRepository,
  serverRepository,
  userRepository,
  verificationRepository,
} from "@nexus/db";
import { createLicenseRuntimeToken } from "@nexus/security";
import {
  auditEvents,
  builds,
  licenseRuntimeBindings as bindings,
  licenses,
  products,
  serverClaimChallenges,
  servers,
} from "../packages/db/src/schema";

// Requires disposable PostgreSQL migrated through 0053. Licenses and scanned
// builds below are explicit recorded fixtures; no payment or scanner is invoked.
const id = (prefix: string) => `${prefix}_${randomBytes(10).toString("hex")}`;
async function prove(serverId: string, actorId: string, reviewerId: string) {
  const challenge = await serverClaimChallengeRepository.issue({
    serverId,
    requesterId: actorId,
    auditId: id("aud"),
  });
  const [saved] = await db
    .select()
    .from(serverClaimChallenges)
    .where(eq(serverClaimChallenges.id, challenge.id));
  const completed = await serverClaimChallengeRepository.consumeVerifiedProof({
    id: challenge.id,
    serverId,
    requesterId: actorId,
    token: challenge.token,
    expectedEndpoint: { ipAddress: challenge.server.ipAddress, port: challenge.server.port },
    sourceFetchedAt: new Date(Math.max(Date.now(), saved.createdAt.getTime())),
    verificationRequestId: id("ver"),
    auditId: id("aud"),
  });
  await verificationRepository.resolveRequest({
    id: completed.verificationRequest.id,
    reviewerId,
    decision: "approved",
  });
}
async function fixture() {
  const actorId = id("usr"),
    reviewerId = id("usr"),
    serverId = id("srv"),
    productId = id("prd"),
    buildId = id("bld"),
    licenseId = id("lic");
  for (const [userId, role] of [
    [actorId, "user"],
    [reviewerId, "moderator"],
  ] as const)
    await userRepository.create({
      id: userId,
      role,
      email: `${userId}@example.invalid`,
      username: userId,
      displayName: "License recovery fixture",
    });
  await serverRepository.create({
    id: serverId,
    name: "Recovery server",
    slug: serverId.replace(/_/gu, "-"),
    ipAddress: "198.51.100.189",
    port: 15000 + Math.floor(Math.random() * 35000),
    status: "active",
    visibility: "public",
    isVerified: false,
    mediaUrls: [],
    gameplayTags: [],
  });
  await prove(serverId, actorId, reviewerId);
  const sha256Hash = "a".repeat(64),
    expiresAt = new Date(Date.now() + 30 * 86400000);
  await db.insert(products).values({
    id: productId,
    authorId: reviewerId,
    slug: productId.replace(/_/gu, "-"),
    title: "Recorded licensed resource",
    description: "Explicit license fixture",
    type: "script",
    status: "published",
    price: 1500,
  });
  await db.insert(builds).values({
    id: buildId,
    productId,
    version: "1.0",
    status: "published",
    storageKey: `fixture/${buildId}.zip`,
    sha256Hash,
    fileSizeBytes: 100,
    scanStatus: "clean",
    scanner: "fixture-scanner",
    scannedAt: new Date(),
  });
  await db.insert(licenses).values({
    id: licenseId,
    key: randomUUID(),
    productId,
    userId: actorId,
    model: "single_server",
    status: "active",
    expiresAt,
  });
  const f = { actorId, reviewerId, serverId, productId, buildId, licenseId, sha256Hash, expiresAt };
  await repo.ownerCommand({
    ...input(f),
    command: {
      action: "bind",
      serverId,
      expectedUpdatedAt: await revision(f),
      reason: "Bind recorded fixture",
    },
  });
  return { ...f, token: await rotate(f) };
}
function input(f: { licenseId: string; actorId: string }) {
  return { licenseId: f.licenseId, actorId: f.actorId, auditId: id("aud") };
}
async function revision(f: { licenseId: string }) {
  const [license] = await db.select().from(licenses).where(eq(licenses.id, f.licenseId));
  return license.updatedAt.toISOString();
}
async function rotate(f: { licenseId: string; actorId: string }) {
  const token = createLicenseRuntimeToken();
  await repo.ownerCommand({
    ...input(f),
    tokenDigest: token.digest,
    command: {
      action: "rotate_token",
      expectedUpdatedAt: await revision(f),
      reason: "Rotate recorded credential",
    },
  });
  return token;
}
function release(f: Awaited<ReturnType<typeof fixture>>) {
  return {
    serverId: f.serverId,
    productId: f.productId,
    buildId: f.buildId,
    sha256Hash: f.sha256Hash,
    nonce: randomUUID(),
  };
}

it("requires fresh control proof and allows exactly one concurrent same-server recovery", async () => {
  const f = await fixture(),
    server = await serverRepository.findById(f.serverId);
  if (!server) throw new Error("Missing fixture server");
  expect(await repo.verifyRelease(f.token.digest, release(f))).toMatchObject({ valid: true });
  await serverRepository.update(f.serverId, { port: server.port + 1 });
  expect(await repo.verifyRelease(f.token.digest, release(f))).toBeNull();
  const command = {
    action: "refresh_binding" as const,
    expectedUpdatedAt: await revision(f),
    expectedEndpointRevision: 1,
    reason: "Current endpoint approved",
  };
  await expect(repo.ownerCommand({ ...input(f), command })).rejects.toMatchObject({
    code: "LICENSE_SERVER_UNAVAILABLE",
  });
  await prove(f.serverId, f.actorId, f.reviewerId);
  const results = await Promise.allSettled([
    repo.ownerCommand({ ...input(f), command }),
    repo.ownerCommand({ ...input(f), command }),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(results.find((r) => r.status === "rejected")).toMatchObject({
    reason: { code: "LICENSE_CONFLICT" },
  });
  const [saved] = await db.select().from(bindings).where(eq(bindings.licenseId, f.licenseId));
  expect(saved).toMatchObject({
    serverId: f.serverId,
    serverOwnerId: f.actorId,
    endpointRevision: 1,
    tokenDigest: null,
    tokenIssuedAt: null,
    tokenExpiresAt: null,
  });
  const [license] = await db.select().from(licenses).where(eq(licenses.id, f.licenseId));
  expect(license.expiresAt?.getTime()).toBe(f.expiresAt.getTime());
  expect(await repo.verifyRelease(f.token.digest, release(f))).toBeNull();
  const newToken = await rotate(f),
    command2 = release(f),
    confirmation = await repo.verifyRelease(newToken.digest, command2);
  expect(confirmation?.nonce).toBe(command2.nonce);
  if (!confirmation) throw new Error("Missing release confirmation");
  expect(
    Date.parse(confirmation.leaseExpiresAt) - Date.parse(confirmation.checkedAt),
  ).toBeLessThanOrEqual(60000);
  expect(
    await repo.verifyRelease(newToken.digest, { ...command2, sha256Hash: "b".repeat(64) }),
  ).toBeNull();
  await db.update(builds).set({ status: "retired" }).where(eq(builds.id, f.buildId));
  expect(await repo.verifyRelease(newToken.digest, command2)).toBeNull();
});
it("guards original term, server identity and terminal states even for direct SQL writes", async () => {
  const f = await fixture();
  await expect(
    db
      .update(licenses)
      .set({ expiresAt: new Date(f.expiresAt.getTime() + 86400000) })
      .where(eq(licenses.id, f.licenseId)),
  ).rejects.toThrow();
  await expect(
    db.update(licenses).set({ serverId: null }).where(eq(licenses.id, f.licenseId)),
  ).rejects.toThrow();
  await expect(db.delete(bindings).where(eq(bindings.licenseId, f.licenseId))).rejects.toThrow();
  await expect(
    db
      .update(bindings)
      .set({ serverOwnerId: f.reviewerId })
      .where(eq(bindings.licenseId, f.licenseId)),
  ).rejects.toThrow();
  await db.update(licenses).set({ status: "suspended" }).where(eq(licenses.id, f.licenseId));
  await db.update(licenses).set({ status: "active" }).where(eq(licenses.id, f.licenseId));
  expect(await repo.verifyRelease(f.token.digest, release(f))).toBeNull();
  const [binding] = await db.select().from(bindings).where(eq(bindings.licenseId, f.licenseId));
  expect(binding.tokenDigest).toBeNull();
  await db.update(licenses).set({ status: "revoked" }).where(eq(licenses.id, f.licenseId));
  await expect(
    db.update(licenses).set({ status: "active" }).where(eq(licenses.id, f.licenseId)),
  ).rejects.toThrow();
});
it("retains the saved binding after server deletion and permits parent-license cascade deletion", async () => {
  const f = await fixture();
  await db.delete(servers).where(eq(servers.id, f.serverId));
  const [license] = await db.select().from(licenses).where(eq(licenses.id, f.licenseId));
  expect(license.serverId).toBeNull();
  const [binding] = await db.select().from(bindings).where(eq(bindings.licenseId, f.licenseId));
  expect(binding.serverId).toBe(f.serverId);
  expect(await repo.verifyRelease(f.token.digest, release(f))).toBeNull();
  await expect(db.delete(bindings).where(eq(bindings.licenseId, f.licenseId))).rejects.toThrow();
  await db.delete(licenses).where(eq(licenses.id, f.licenseId));
  expect(await db.select().from(bindings).where(eq(bindings.licenseId, f.licenseId))).toHaveLength(
    0,
  );
});
it("rolls back binding recovery and credential invalidation if its audit cannot be persisted", async () => {
  const f = await fixture(),
    server = await serverRepository.findById(f.serverId),
    auditId = id("aud");
  if (!server) throw new Error("Missing fixture server");
  await serverRepository.update(f.serverId, { port: server.port + 1 });
  await prove(f.serverId, f.actorId, f.reviewerId);
  await db.insert(auditEvents).values({
    id: auditId,
    actorId: f.actorId,
    actorType: "user",
    action: "fixture.duplicate",
    targetId: f.licenseId,
    targetType: "license",
  });
  const before = await revision(f);
  await expect(
    repo.ownerCommand({
      ...input(f),
      auditId,
      command: {
        action: "refresh_binding",
        expectedUpdatedAt: before,
        expectedEndpointRevision: 1,
        reason: "Current endpoint approved",
      },
    }),
  ).rejects.toThrow();
  const [binding] = await db.select().from(bindings).where(eq(bindings.licenseId, f.licenseId));
  expect(binding).toMatchObject({ endpointRevision: 0, tokenDigest: f.token.digest });
  expect(await revision(f)).toBe(before);
});
