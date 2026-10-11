import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { expect, it } from "vitest";
import {
  db,
  userRepository,
  buildRepository,
  builds,
  products,
  users,
  auditEvents,
  buildPackageComparisonRepository as comparison,
} from "@nexus/db";
import fixtures from "./fixtures/build-packages.json";
import { inspectBuildPackage } from "../apps/web/src/lib/services/build-package-inspection";

// Requires a disposable PostgreSQL database migrated through 0059; no payment or entitlement mutation.
async function fixture() {
  const key = randomBytes(8).toString("hex"),
    owner = `usr_pkg_${key}`,
    stranger = `usr_pkg_other_${key}`,
    moderator = `usr_pkg_staff_${key}`,
    productId = `prd_pkg_${key}`;
  for (const [id, role] of [
    [owner, "developer"],
    [stranger, "user"],
    [moderator, "moderator"],
  ] as const)
    await userRepository.create({
      id,
      role,
      email: `${id}@example.invalid`,
      username: id,
      displayName: id,
    });
  await db.insert(products).values({
    id: productId,
    authorId: owner,
    slug: productId,
    title: "Package evidence",
    description: "Actual independently generated ZIP fixtures",
    type: "script",
  });
  async function submit(
    suffix: string,
    name: "stored" | "updated",
    version: string,
    auditId = `aud_pkg_${key}_${suffix}`,
  ) {
    const evidence = await inspectBuildPackage({
      bytes: Buffer.from(fixtures[name], "base64"),
      format: "zip",
    });
    const build = await buildRepository.submitForReview(
      {
        id: `bld_pkg_${key}_${suffix}`,
        productId,
        version,
        status: "pending_review",
        storageKey: `fixture/${key}_${suffix}.zip`,
        sha256Hash: evidence.sha256Hash,
        fileSizeBytes: evidence.fileSizeBytes,
        fileName: "resource.zip",
        mimeType: "application/zip",
        scanStatus: "clean",
        scanner: "integration",
        scannedAt: new Date(),
        isSigned: false,
        packageEvidence: evidence,
      },
      {
        id: auditId,
        actorId: owner,
        actorType: "user",
        action: "build.submitted_for_review",
        targetType: "build",
        targetId: `bld_pkg_${key}_${suffix}`,
      },
    );
    return { build, evidence };
  }
  const old = await submit("old", "stored", "1.0.0");
  await buildRepository.moderatePending(
    old.build.id,
    "approve",
    {
      id: `aud_pkg_${key}_approve`,
      actorId: moderator,
      actorType: "user",
      action: "build.approved",
      targetType: "build",
      targetId: old.build.id,
    },
    1,
  );
  const current = await submit("current", "updated", "2.0.0");
  const query = { actorId: owner, productId, buildId: current.build.id, baselineId: old.build.id };
  async function cleanup() {
    await db.delete(products).where(eq(products.id, productId));
    for (const id of [owner, stranger, moderator]) await db.delete(users).where(eq(users.id, id));
  }
  return { key, owner, stranger, moderator, productId, old, current, query, submit, cleanup };
}
it("persists actual file inventories and compares exact added/removed/changed/unchanged contents", async () => {
  const f = await fixture();
  try {
    const page = await comparison.page(f.query);
    expect(page.comparisonAvailable).toBe(true);
    expect(Object.fromEntries(page.counts.map((v) => [v.status, v.total]))).toEqual({
      added: 1,
      removed: 1,
      changed: 1,
      unchanged: 2,
    });
    expect(page.files.find((v) => v.path === "demo/client.lua")).toMatchObject({
      status: "removed",
      afterHash: null,
    });
    expect(page.files.find((v) => v.path === "demo/server.lua")).toMatchObject({
      status: "changed",
    });
    const only = await comparison.page({ ...f.query, filter: "changed" });
    expect(only.files.map((v) => v.path)).toEqual(["demo/server.lua"]);
    const defaultPage = await comparison.page({ ...f.query, baselineId: undefined });
    expect(defaultPage.baseline?.id).toBe(f.old.build.id);
    const publicHistory = await buildRepository.pagePublishedReleases(f.productId);
    expect(publicHistory.releases[0]?.packageSummary?.status).toBe("checked");
    expect(JSON.stringify(publicHistory)).not.toContain("demo/server.lua");
  } finally {
    await f.cleanup();
  }
});
it("retains immutable byte evidence across metadata edits and rejects report/hash changes", async () => {
  const f = await fixture();
  try {
    await expect(
      db
        .update(builds)
        .set({ packageEvidence: { ...f.current.evidence, inspectedAt: new Date(0).toISOString() } })
        .where(eq(builds.id, f.current.build.id)),
    ).rejects.toThrow();
    await expect(
      db
        .update(builds)
        .set({ sha256Hash: "0".repeat(64) })
        .where(eq(builds.id, f.current.build.id)),
    ).rejects.toThrow();
    await db
      .update(builds)
      .set({ status: "draft", releaseNotes: "Editorial correction" })
      .where(eq(builds.id, f.current.build.id));
    expect(
      (await db.select().from(builds).where(eq(builds.id, f.current.build.id)))[0]?.packageEvidence,
    ).toEqual(f.current.evidence);
  } finally {
    await f.cleanup();
  }
});
it("hides private files after permission revocation and keeps legacy missing evidence unknown", async () => {
  const f = await fixture();
  try {
    await expect(comparison.page({ ...f.query, actorId: f.stranger })).rejects.toMatchObject({
      statusCode: 404,
    });
    await db.update(users).set({ role: "user" }).where(eq(users.id, f.moderator));
    await expect(
      comparison.page({ ...f.query, actorId: f.moderator, staff: true }),
    ).rejects.toMatchObject({ statusCode: 403 });
    const legacyId = `bld_pkg_${f.key}_legacy`;
    await db.insert(builds).values({
      id: legacyId,
      productId: f.productId,
      version: "0.1.0",
      storageKey: "fixture/legacy.zip",
      sha256Hash: "a".repeat(64),
      fileSizeBytes: 7,
    });
    const page = await comparison.page({ ...f.query, baselineId: legacyId, filter: "removed" });
    expect(page.comparisonAvailable).toBe(false);
    expect(page.files.every((v) => v.status === "recorded" && v.beforeHash === null)).toBe(true);
    await expect(
      db.update(builds).set({ packageEvidence: f.old.evidence }).where(eq(builds.id, legacyId)),
    ).rejects.toThrow();
  } finally {
    await f.cleanup();
  }
});
it("rolls back build/evidence and product state when the atomic audit insert fails", async () => {
  const f = await fixture();
  try {
    const [before] = await db.select().from(products).where(eq(products.id, f.productId));
    await expect(
      f.submit("rollback", "updated", "3.0.0", `aud_pkg_${f.key}_current`),
    ).rejects.toThrow();
    expect(
      await db
        .select()
        .from(builds)
        .where(eq(builds.id, `bld_pkg_${f.key}_rollback`)),
    ).toHaveLength(0);
    expect((await db.select().from(products).where(eq(products.id, f.productId)))[0]).toEqual(
      before,
    );
    expect(
      await db
        .select()
        .from(auditEvents)
        .where(eq(auditEvents.id, `aud_pkg_${f.key}_current`)),
    ).toHaveLength(1);
  } finally {
    await f.cleanup();
  }
});
