import { randomBytes } from "node:crypto";
import {
  buildRepository,
  db,
  productLifecycleRepository,
  productRepository,
  sessionRepository,
  userRepository,
  resourceReleaseWatchesRepository as watches,
} from "@nexus/db";
import { and, count, eq, or, sql } from "drizzle-orm";
import { resourceReleaseWorkerRepository as worker } from "../../packages/db/src/repositories/resource-release-worker";
import {
  auditEvents,
  builds,
  entitlements,
  notificationPreferences,
  notifications,
  products,
  resourceReleaseEvents,
  resourceReleaseWatches,
  users,
} from "../../packages/db/src/schema";

// Isolated disposable PostgreSQL migrated through 0057. No purchase/provider,
// license issuance, subscription activation or browser delivery is simulated.

export {
  and,
  auditEvents,
  buildRepository,
  builds,
  count,
  db,
  entitlements,
  eq,
  notificationPreferences,
  productLifecycleRepository,
  productRepository,
  resourceReleaseEvents,
  resourceReleaseWatches,
  watches,
  worker,
};

/** Require a non-null fixture value. */
export function present<T>(value: T | null | undefined): T {
  if (value == null) throw new Error("Missing fixture");
  return value;
}

/** Seed owner/buyer/staff, entitled product, release helper, watch enroll and inbox. */
export async function fixture() {
  const key = randomBytes(8).toString("hex"),
    owner = `usr_rw_owner_${key}`,
    buyer = `usr_rw_buyer_${key}`,
    staff = `usr_rw_staff_${key}`,
    id = `prd_rw_${key}`;
  for (const [userId, role] of [
    [owner, "developer"],
    [buyer, "user"],
    [staff, "moderator"],
  ] as const)
    await userRepository.create({
      id: userId,
      email: `${userId}@example.invalid`,
      username: userId,
      displayName: userId,
      role,
    });
  await sessionRepository.create({
    id: `ses_${buyer}`,
    userId: buyer,
    token: `tok_${buyer}`,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  await sessionRepository.create({
    id: `ses_${staff}`,
    userId: staff,
    token: `tok_${staff}`,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  await db.insert(products).values({
    id,
    authorId: owner,
    title: "Release fixture",
    description: "Release fixture description",
    slug: id,
    type: "script",
    status: "draft",
  });
  await db.insert(entitlements).values({
    id: `ent_rw_${key}`,
    subjectType: "user",
    subjectId: buyer,
    resourceId: id,
    permission: "product.download",
  });
  async function release(version: string) {
    const buildId = `bld_rw_${key}_${version.replaceAll(".", "_")}`;
    await db.insert(builds).values({
      id: buildId,
      productId: id,
      version,
      status: "pending_review",
      scanStatus: "clean",
      scanner: "integration-scanner",
      scannedAt: new Date(),
      storageKey: `fixtures/${key}.zip`,
      sha256Hash: "a".repeat(64),
      fileSizeBytes: 7,
    });
    const audit = {
      id: `aud_rw_${randomBytes(8).toString("hex")}`,
      actorId: staff,
      actorType: "user" as const,
      action: "build.approved",
      targetId: buildId,
      targetType: "build",
      details: { notes: "Reviewed release" },
    };
    present(await buildRepository.moderatePending(buildId, "approve", audit, 1, `tok_${staff}`));
    return { buildId, audit };
  }
  const start = () =>
    watches.command({
      userId: buyer,
      currentToken: `tok_${buyer}`,
      productId: id,
      command: { enabled: true, expectedRevision: 0 },
      auditId: `aud_rw_enroll_${key}`,
    });
  const inbox = () =>
    db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientId, buyer),
          sql`${notifications.data}->>'kind' = 'resource_release'`,
        ),
      );
  const cleanup = async () => {
    await db
      .delete(auditEvents)
      .where(
        or(
          eq(auditEvents.targetId, id),
          eq(auditEvents.targetId, `${buyer}:${id}`),
          eq(auditEvents.actorId, staff),
        ),
      );
    await db.delete(entitlements).where(eq(entitlements.resourceId, id));
    await db.delete(products).where(eq(products.id, id));
    for (const userId of [owner, buyer, staff]) await db.delete(users).where(eq(users.id, userId));
  };
  return { key, owner, buyer, staff, id, release, start, inbox, cleanup };
}
