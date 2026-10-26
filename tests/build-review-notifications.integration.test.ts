import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { expect, it } from "vitest";
import {
  buildRepository,
  productRepository,
  userRepository,
  notificationRepository,
  sessionRepository,
  webPushOutbox,
  webPushSubscriptionRepository,
} from "@nexus/db";
import { db } from "../packages/db/src/client";
import { auditEvents, builds, organizationMembers, organizations } from "../packages/db/src/schema";

async function fixture() {
  const suffix = randomBytes(6).toString("hex");
  const authorId = `usr_review_${suffix}`;
  const moderatorId = `usr_review_mod_${suffix}`;
  const productId = `prd_review_${suffix}`;
  const buildId = `bld_review_${suffix}`;
  const sessionId = `ses_review_${suffix}`;
  const subscriptionId = `wps_review_${suffix}`;
  await userRepository.create({
    id: authorId,
    email: `${suffix}@example.invalid`,
    username: `review_${suffix}`,
    displayName: "Review Author",
    role: "developer",
  });
  await userRepository.create({
    id: moderatorId,
    email: `mod_${suffix}@example.invalid`,
    username: `review_mod_${suffix}`,
    displayName: "Review Moderator",
    role: "moderator",
  });
  await sessionRepository.create({
    id: sessionId,
    userId: authorId,
    token: `review-session-${suffix}`,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  await webPushSubscriptionRepository.upsert({
    id: subscriptionId,
    userId: authorId,
    sessionId,
    endpoint: `https://push.example.invalid/review-${suffix}`,
    p256dh: "review-key",
    auth: "review-auth",
    expirationAt: null,
  });
  await productRepository.create({
    id: productId,
    authorId,
    title: "Review resource",
    slug: `review-${suffix}`,
    description: "Review notification integration resource.",
    type: "script",
    status: "draft",
    price: 0,
    currency: "USD",
    licenseModel: "unlimited",
    tags: [],
    currentVersion: "0.1.0",
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
    releaseNotes: "First version",
    status: "pending_review",
    storageKey: `test/${buildId}.lua`,
    sha256Hash: "a".repeat(64),
    fileSizeBytes: 10,
    fileName: "test.lua",
    mimeType: "text/plain",
    scanStatus: "clean",
    scanner: "test-scanner",
    scannedAt: new Date(),
    isSigned: false,
  });
  const audit = (suffix = "decision") => ({
    id: `aud_${buildId}_${suffix}`,
    actorId: moderatorId,
    actorType: "admin" as const,
    action: "build.approved",
    targetId: buildId,
    targetType: "build",
    details: { notes: "Review comment <script>literal</script>" },
  });
  return {
    authorId,
    moderatorId,
    productId,
    buildId,
    subscriptionId,
    audit,
  };
}

it("commits approval and one author notification atomically, even with simultaneous replay", async () => {
  const f = await fixture();
  const results = await Promise.all([
    buildRepository.moderatePending(f.buildId, "approve", f.audit("a"), 1),
    buildRepository.moderatePending(f.buildId, "approve", f.audit("b"), 1),
  ]);
  expect(results.filter(Boolean)).toHaveLength(1);
  const notices = await notificationRepository.listByUser(f.authorId);
  expect(notices).toHaveLength(1);
  await expect(notificationRepository.listBuildReviewByBuildId(f.buildId)).resolves.toEqual([
    expect.objectContaining({
      id: notices[0]?.id,
      recipientId: f.authorId,
    }),
  ]);
  expect(notices[0]).toMatchObject({
    link: `/workspace/resources/${f.productId}`,
    category: "system",
    isRead: false,
    data: {
      kind: "build_review",
      decision: "approve",
      resourceTitle: "Review resource",
      version: "1.0.0",
      notes: "Review comment <script>literal</script>",
    },
  });
  expect(await notificationRepository.countUnread(f.authorId)).toBe(1);
  await expect(
    db
      .select()
      .from(webPushOutbox)
      .where(eq(webPushOutbox.notificationId, String(notices[0]?.id))),
  ).resolves.toEqual([
    expect.objectContaining({
      subscriptionId: f.subscriptionId,
      attempts: 0,
    }),
  ]);
  expect(
    await db.select().from(auditEvents).where(eq(auditEvents.targetId, f.buildId)),
  ).toHaveLength(1);
});

it("keeps a rejection successful when system notifications are disabled", async () => {
  const f = await fixture();
  await notificationRepository.updatePreferences(f.authorId, { systemEnabled: false });
  expect(
    await buildRepository.moderatePending(
      f.buildId,
      "reject",
      {
        ...f.audit(),
        action: "build.rejected",
      },
      1,
    ),
  ).toMatchObject({ status: "rejected" });
  expect(await notificationRepository.listByUser(f.authorId)).toEqual([]);
  expect(
    await db.select().from(auditEvents).where(eq(auditEvents.targetId, f.buildId)),
  ).toHaveLength(1);
});

it("rolls back build, product and audit when notification storage fails, then permits retry", async () => {
  const f = await fixture();
  const id = `ntf_build_review_${f.buildId}_r2_${f.authorId}`;
  await notificationRepository.create({
    id,
    recipientId: f.authorId,
    title: "Conflict fixture",
    message: "Existing ID",
    type: "system",
  });
  await expect(
    buildRepository.moderatePending(f.buildId, "approve", f.audit(), 1),
  ).rejects.toThrow();
  expect(await buildRepository.findById(f.buildId)).toMatchObject({ status: "pending_review" });
  expect(await productRepository.findById(f.productId)).toMatchObject({
    status: "draft",
    currentVersion: "0.1.0",
  });
  expect(await db.select().from(auditEvents).where(eq(auditEvents.targetId, f.buildId))).toEqual(
    [],
  );
  const { notifications } = await import("../packages/db/src/schema");
  await db.delete(notifications).where(eq(notifications.id, id));
  expect(await buildRepository.moderatePending(f.buildId, "approve", f.audit(), 1)).toMatchObject({
    status: "published",
  });
  expect(await notificationRepository.listByUser(f.authorId)).toHaveLength(1);
});

it("notifies current organization managers once, respecting revocation and preferences", async () => {
  const f = await fixture();
  const orgId = `org_${f.productId}`;
  const roles = ["owner", "manager", "admin", "reader"] as const;
  for (const role of roles)
    await userRepository.create({
      id: `${f.authorId}_${role}`,
      email: `${f.buildId}_${role}@example.invalid`,
      username: `${f.buildId}_${role}`,
      displayName: role,
      role: "developer",
    });
  await db
    .insert(organizations)
    .values({ id: orgId, name: "Review team", slug: orgId, ownerId: `${f.authorId}_owner` });
  await db.insert(organizationMembers).values(
    roles.map((role) => ({
      id: `mem_${f.buildId}_${role}`,
      organizationId: orgId,
      userId: `${f.authorId}_${role}`,
      role: role === "admin" ? "admin" : "member",
      permissions: role === "manager" || role === "reader" ? ["manage_products"] : [],
    })),
  );
  const { products } = await import("../packages/db/src/schema");
  await db.update(products).set({ organizationId: orgId }).where(eq(products.id, f.productId));
  await db
    .update(organizationMembers)
    .set({ permissions: [] })
    .where(
      and(
        eq(organizationMembers.organizationId, orgId),
        eq(organizationMembers.userId, `${f.authorId}_reader`),
      ),
    );
  await notificationRepository.updatePreferences(`${f.authorId}_admin`, { systemEnabled: false });
  await buildRepository.moderatePending(
    f.buildId,
    "reject",
    {
      ...f.audit(),
      action: "build.rejected",
    },
    1,
  );
  expect(await notificationRepository.listByUser(f.authorId)).toEqual([]);
  for (const role of roles)
    expect(await notificationRepository.listByUser(`${f.authorId}_${role}`)).toHaveLength(
      role === "owner" || role === "manager" ? 1 : 0,
    );
  expect(await db.select().from(builds).where(eq(builds.id, f.buildId))).toMatchObject([
    { status: "rejected" },
  ]);
});
