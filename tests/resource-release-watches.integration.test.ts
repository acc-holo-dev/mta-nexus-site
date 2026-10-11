import { randomBytes } from "node:crypto";
import { and, count, eq, or, sql } from "drizzle-orm";
import { expect, it } from "vitest";
import {
  db,
  userRepository,
  buildRepository,
  productRepository,
  productLifecycleRepository,
  resourceReleaseWatchesRepository as watches,
} from "@nexus/db";
import { resourceReleaseWorkerRepository as worker } from "../packages/db/src/repositories/resource-release-worker";
import {
  auditEvents,
  builds,
  entitlements,
  notifications,
  notificationPreferences,
  products,
  resourceReleaseEvents,
  resourceReleaseWatches,
  users,
} from "../packages/db/src/schema";
// Isolated disposable PostgreSQL migrated through 0057. No purchase/provider,
// license issuance, subscription activation or browser delivery is simulated.
function present<T>(value: T | null | undefined): T {
  if (value == null) throw new Error("Missing fixture");
  return value;
}
async function fixture() {
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
  await db
    .insert(products)
    .values({
      id,
      authorId: owner,
      title: "Release fixture",
      description: "Release fixture description",
      slug: id,
      type: "script",
      status: "draft",
    });
  await db
    .insert(entitlements)
    .values({
      id: `ent_rw_${key}`,
      subjectType: "user",
      subjectId: buyer,
      resourceId: id,
      permission: "product.download",
    });
  async function release(version: string) {
    const buildId = `bld_rw_${key}_${version.replaceAll(".", "_")}`;
    await db
      .insert(builds)
      .values({
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
    present(await buildRepository.moderatePending(buildId, "approve", audit, 1));
    return { buildId, audit };
  }
  const start = () =>
    watches.command({
      userId: buyer,
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
it("enrollment skips old events, and concurrent workers create one exact-release notice", async () => {
  const f = await fixture();
  try {
    await f.release("1.0.0");
    await f.start();
    await worker.runBatch(100);
    expect(await f.inbox()).toHaveLength(0);
    const release = await f.release("2.0.0");
    await Promise.all([worker.runBatch(100), worker.runBatch(100)]);
    const notices = await f.inbox();
    expect(notices).toHaveLength(1);
    expect(notices[0].data).toMatchObject({ kind: "resource_release", version: "2.0.0" });
    expect(
      await buildRepository.moderatePending(
        release.buildId,
        "approve",
        { ...release.audit, id: `aud_rw_replay_${f.key}` },
        1,
      ),
    ).toBeNull();
    const product = present(await productRepository.findById(f.id));
    await productRepository.updateManagedDetails(
      f.id,
      { id: f.owner, role: "developer" },
      {
        title: "Reviewed updated title",
        shortDescription: "",
        description: "Reviewed updated description",
        tags: [],
      },
      {
        id: `aud_rw_edit_${f.key}`,
        actorId: f.owner,
        actorType: "user",
        action: "product.details_updated",
        targetId: f.id,
        targetType: "product",
      },
      product.updatedAt,
    );
    const changed = present(await productRepository.findById(f.id));
    await productLifecycleRepository.transition({
      actorId: f.owner,
      productId: f.id,
      action: "submit",
      expectedUpdatedAt: changed.updatedAt,
      reason: "Review changed resource description",
      auditId: `aud_rw_submit_${f.key}`,
    });
    const pending = present(await buildRepository.findById(release.buildId));
    present(
      await buildRepository.moderatePending(
        release.buildId,
        "approve",
        { ...release.audit, id: `aud_rw_reapprove_${f.key}` },
        pending.revision ?? 1,
      ),
    );
    await worker.runBatch(100);
    expect(await f.inbox()).toHaveLength(1);
    await expect(
      db
        .update(resourceReleaseWatches)
        .set({ lastSequence: 0n })
        .where(eq(resourceReleaseWatches.productId, f.id)),
    ).rejects.toThrow();
  } finally {
    await f.cleanup();
  }
});
it("disabled commerce preferences consume release work without replay after preferences change", async () => {
  const f = await fixture();
  try {
    await f.release("1.0.0");
    await f.start();
    await db
      .insert(notificationPreferences)
      .values({ id: `npr_rw_${f.key}`, userId: f.buyer, commerceEnabled: false });
    await f.release("2.0.0");
    await worker.runBatch(100);
    expect(await f.inbox()).toHaveLength(0);
    await db
      .update(notificationPreferences)
      .set({ commerceEnabled: true })
      .where(eq(notificationPreferences.userId, f.buyer));
    await worker.runBatch(100);
    expect(await f.inbox()).toHaveLength(0);
    await f.release("3.0.0");
    await worker.runBatch(100);
    expect(await f.inbox()).toHaveLength(1);
  } finally {
    await f.cleanup();
  }
});
it("revoked grants disable the watch without notification or changes to commercial state", async () => {
  const f = await fixture();
  try {
    await f.release("1.0.0");
    await f.start();
    await f.release("2.0.0");
    await db.delete(entitlements).where(eq(entitlements.resourceId, f.id));
    await worker.runBatch(100);
    expect(await f.inbox()).toHaveLength(0);
    expect(await watches.detail(f.buyer, f.id)).toMatchObject({ enabled: false, revision: 2 });
  } finally {
    await f.cleanup();
  }
});
it("publication events require exact safe evidence, are immutable and roll back with a failed approval audit", async () => {
  const f = await fixture();
  try {
    const release = await f.release("1.0.0");
    const [event] = await db
      .select()
      .from(resourceReleaseEvents)
      .where(eq(resourceReleaseEvents.buildId, release.buildId));
    await expect(
      db
        .update(resourceReleaseEvents)
        .set({ version: "9.0.0" })
        .where(eq(resourceReleaseEvents.buildId, release.buildId)),
    ).rejects.toThrow();
    await expect(
      db.delete(resourceReleaseEvents).where(eq(resourceReleaseEvents.buildId, release.buildId)),
    ).rejects.toThrow();
    await expect(
      db
        .insert(resourceReleaseEvents)
        .values({
          productId: f.id,
          buildId: release.buildId,
          version: "9.0.0",
          sha256Hash: present(event).sha256Hash,
          fileSizeBytes: 7,
        }),
    ).rejects.toThrow();
    const buildId = `bld_rw_rollback_${f.key}`;
    await db
      .insert(builds)
      .values({
        id: buildId,
        productId: f.id,
        version: "2.0.0",
        status: "pending_review",
        scanStatus: "clean",
        scanner: "integration-scanner",
        scannedAt: new Date(),
        storageKey: "fixtures/rollback.zip",
        sha256Hash: "a".repeat(64),
        fileSizeBytes: 7,
      });
    await expect(
      buildRepository.moderatePending(
        buildId,
        "approve",
        { ...release.audit, targetId: buildId },
        1,
      ),
    ).rejects.toThrow();
    const [total] = await db
      .select({ total: count() })
      .from(resourceReleaseEvents)
      .where(eq(resourceReleaseEvents.buildId, buildId));
    expect(total.total).toBe(0);
    expect(present(await buildRepository.findById(buildId)).status).toBe("pending_review");
  } finally {
    await f.cleanup();
  }
});
