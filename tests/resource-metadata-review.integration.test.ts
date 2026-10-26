import { randomBytes } from "node:crypto";
import { and, count, eq } from "drizzle-orm";
import { expect, it } from "vitest";
import {
  db,
  productRepository,
  buildRepository,
  productLifecycleRepository,
  resourceBuildWorkspaceRepository,
  sessionRepository,
  userRepository,
} from "@nexus/db";
import {
  auditEvents,
  builds,
  entitlements,
  notifications,
  products,
} from "../packages/db/src/schema";
// Disposable PostgreSQL migrated through 0055. These fixtures issue no payments,
// resource licenses or subscriptions and are excluded from the local unit run.
function present<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("Missing persisted fixture");
  return value;
}
async function fixture() {
  const key = randomBytes(8).toString("hex"),
    owner = `usr_mr_${key}`,
    staff = `mod_mr_${key}`,
    id = `prd_mr_${key}`;
  for (const [userId, role] of [
    [owner, "developer"],
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
    id: `ses_${staff}`,
    userId: staff,
    token: `tok_${staff}`,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  await db.insert(products).values({
    id,
    authorId: owner,
    title: "Reviewed title",
    description: "Reviewed resource description",
    type: "script",
    slug: id.replaceAll("_", "-"),
    status: "published",
    currentVersion: "1.0.0",
  });
  const release = `bld_mr_${key}`;
  await db.insert(builds).values({
    id: release,
    productId: id,
    version: "1.0.0",
    status: "published",
    storageKey: "fixtures/review.zip",
    sha256Hash: "a".repeat(64),
    fileSizeBytes: 123,
    scanStatus: "clean",
    scanner: "integration-fixture",
    scannedAt: new Date(),
  });
  await db.insert(entitlements).values({
    id: `ent_mr_${key}`,
    subjectType: "user",
    subjectId: owner,
    permission: "product.download",
    resourceId: id,
  });
  return { owner, staff, id, release, key };
}
const audit = (f: Awaited<ReturnType<typeof fixture>>, suffix: string) => ({
  id: `aud_mr_${f.key}_${suffix}`,
  actorId: f.staff,
  actorType: "user" as const,
  targetId: f.release,
  targetType: "build",
  action: "build.approved",
  details: { notes: "Reviewed exact resource context" },
});
async function edit(f: Awaited<ReturnType<typeof fixture>>, title: string, suffix: string) {
  const product = await productRepository.findById(f.id);
  return productRepository.updateManagedDetails(
    f.id,
    { id: f.owner, role: "developer" },
    { title, shortDescription: "", description: "New resource description", tags: ["lua"] },
    {
      id: `aud_mr_${f.key}_${suffix}`,
      actorId: f.owner,
      actorType: "user",
      targetId: f.id,
      targetType: "product",
      action: "product.details_updated",
    },
    present(product).updatedAt,
  );
}
async function submit(f: Awaited<ReturnType<typeof fixture>>, suffix: string) {
  const product = await productRepository.findById(f.id);
  await productLifecycleRepository.transition({
    productId: f.id,
    actorId: f.owner,
    action: "submit",
    expectedUpdatedAt: present(product).updatedAt,
    reason: "Review changed resource description",
    auditId: `aud_mr_${f.key}_${suffix}`,
  });
  return present(await buildRepository.findById(f.release));
}
it("withdraws edited publication and stale pending evidence while retaining files and grants", async () => {
  const f = await fixture(),
    pending = `bld_pending_${f.key}`;
  await db.insert(builds).values({
    id: pending,
    productId: f.id,
    version: "2.0.0",
    status: "pending_review",
    storageKey: "fixtures/pending.zip",
    sha256Hash: "b".repeat(64),
    fileSizeBytes: 321,
    scanStatus: "clean",
    scanner: "integration-fixture",
    scannedAt: new Date(),
  });
  const observed = present(await buildRepository.findById(pending));
  expect(await edit(f, "Changed title", "edit")).toMatchObject({
    status: "draft",
    metadataReviewRequired: true,
    isFeatured: false,
  });
  const stale = present(await buildRepository.findById(pending));
  expect(stale.status).toBe("draft");
  expect(stale.revision).toBe(present(observed.revision) + 1);
  expect(
    await buildRepository.moderatePending(
      pending,
      "approve",
      { ...audit(f, "stale"), targetId: pending },
      present(observed.revision),
    `tok_${f.staff}`),
  ).toBeNull();
  expect(await buildRepository.findById(f.release)).toMatchObject({
    status: "published",
    storageKey: "fixtures/review.zip",
    sha256Hash: "a".repeat(64),
  });
  expect(
    await db.select().from(entitlements).where(eq(entitlements.resourceId, f.id)),
  ).toHaveLength(1);
});
it("resubmits the saved published archive and notifies each subsequent reviewed revision once", async () => {
  const f = await fixture();
  for (let round = 1; round <= 2; round++) {
    await edit(f, `Changed title ${round}`, `edit${round}`);
    const pending = await submit(f, `submit${round}`);
    expect(pending).toMatchObject({
      status: "pending_review",
      version: "1.0.0",
      storageKey: "fixtures/review.zip",
    });
    expect(
      await buildRepository.moderatePending(
        f.release,
        "approve",
        audit(f, `approve${round}`),
        present(pending.revision),
      `tok_${f.staff}`),
    ).toMatchObject({ status: "published" });
    expect(await productRepository.findById(f.id)).toMatchObject({
      status: "published",
      metadataReviewRequired: false,
      title: `Changed title ${round}`,
    });
    expect(
      await buildRepository.moderatePending(
        f.release,
        "approve",
        audit(f, `replay${round}`),
        present(pending.revision),
      `tok_${f.staff}`),
    ).toBeNull();
  }
  expect(await db.select().from(builds).where(eq(builds.productId, f.id))).toHaveLength(1);
  const notices = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.recipientId, f.owner), eq(notifications.type, "system")));
  expect(notices).toHaveLength(2);
  expect(new Set(notices.map((row) => row.id)).size).toBe(2);
});
it("keeps a changed description withdrawn after build retirement even with another safe release", async () => {
  const f = await fixture(),
    second = `bld_old_${f.key}`;
  await db.insert(builds).values({
    id: second,
    productId: f.id,
    version: "0.9.0",
    status: "published",
    storageKey: "fixtures/old.zip",
    sha256Hash: "c".repeat(64),
    fileSizeBytes: 100,
    scanStatus: "clean",
    scanner: "integration-fixture",
    scannedAt: new Date(),
  });
  await edit(f, "Needs review", "edit");
  const build = present(await buildRepository.findById(f.release));
  await resourceBuildWorkspaceRepository.command({
    productId: f.id,
    buildId: f.release,
    actorId: f.owner,
    auditId: `aud_mr_${f.key}_retire`,
    command: {
      action: "retire",
      expectedRevision: present(build.revision),
      reason: "Retire old resource version",
    },
  });
  expect(await productRepository.findById(f.id)).toMatchObject({
    status: "draft",
    metadataReviewRequired: true,
  });
});
it("rolls back editorial withdrawal and pending revisions if the required audit fails", async () => {
  const f = await fixture(),
    pending = `bld_pending_${f.key}`;
  await db.insert(builds).values({
    id: pending,
    productId: f.id,
    version: "2.0.0",
    status: "pending_review",
    storageKey: "fixtures/pending.zip",
    sha256Hash: "b".repeat(64),
    fileSizeBytes: 321,
    scanStatus: "clean",
    scanner: "integration-fixture",
    scannedAt: new Date(),
  });
  const duplicate = `aud_mr_${f.key}_duplicate`;
  await db.insert(auditEvents).values({ ...audit(f, "duplicate"), id: duplicate });
  const before = await productRepository.findById(f.id),
    revision = present(await buildRepository.findById(pending)).revision;
  await expect(edit(f, "Uncommitted title", "duplicate")).rejects.toThrow();
  expect(await productRepository.findById(f.id)).toMatchObject({
    status: "published",
    title: "Reviewed title",
    metadataReviewRequired: false,
    updatedAt: present(before).updatedAt,
  });
  expect(await buildRepository.findById(pending)).toMatchObject({
    status: "pending_review",
    revision,
  });
  const [events] = await db
    .select({ total: count() })
    .from(auditEvents)
    .where(eq(auditEvents.id, duplicate));
  expect(events.total).toBe(1);
});
