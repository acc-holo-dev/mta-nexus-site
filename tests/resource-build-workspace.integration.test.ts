import { randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { expect, it } from "vitest";
import {
  auditEvents,
  builds,
  db,
  products,
  userRepository,
  productRepository,
  buildRepository,
  sessionRepository,
  resourceBuildWorkspaceRepository as repo,
} from "@nexus/db";
async function fixture(status: "pending_review" | "rejected" | "draft" = "pending_review") {
  const suffix = randomBytes(5).toString("hex"),
    actorId = `usr_bw_${suffix}`,
    staffId = `usr_bm_${suffix}`;
  const productId = `prd_bw_${suffix}`,
    buildId = `bld_bw_${suffix}`;
  for (const [id, role] of [
    [actorId, "developer"],
    [staffId, "moderator"],
  ] as const)
    await userRepository.create({
      id,
      role,
      email: `${id}@example.invalid`,
      username: id,
      displayName: id,
    });
  await sessionRepository.create({
    id: `ses_${staffId}`,
    userId: staffId,
    token: `tok_${staffId}`,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  await productRepository.create({
    id: productId,
    authorId: actorId,
    title: "Version workflow",
    slug: `versions-${suffix}`,
    description: "Version lifecycle PostgreSQL fixture.",
    type: "script",
    status: "pending_review",
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
    status,
    storageKey: `fixture/${buildId}.zip`,
    sha256Hash: "a".repeat(64),
    fileSizeBytes: 42,
    fileName: "archive.zip",
    mimeType: "application/zip",
    scanStatus: "clean",
    scanner: "fixture-scanner",
    scannedAt: new Date(),
    isSigned: false,
  });
  return { actorId, staffId, productId, buildId, auditId: `aud_bw_${suffix}` };
}
it("withdraws, edits and resubmits without allowing an ABA approval", async () => {
  const f = await fixture();
  expect(
    await repo.command({
      ...f,
      command: { action: "withdraw", expectedRevision: 1, reason: "Correct release notes" },
    }),
  ).toMatchObject({ status: "draft", revision: 2 });
  expect(
    await repo.command({
      ...f,
      auditId: `${f.auditId}_save`,
      command: {
        action: "save",
        expectedRevision: 2,
        releaseNotes: "Corrected notes",
        mtaVersionTarget: "1.6.0",
      },
    }),
  ).toMatchObject({ revision: 3 });
  expect(
    await repo.command({
      ...f,
      auditId: `${f.auditId}_submit`,
      command: { action: "submit", expectedRevision: 3, reason: "Corrections ready" },
    }),
  ).toMatchObject({ status: "pending_review", revision: 4 });
  const audit = {
    id: `${f.auditId}_old`,
    actorId: f.staffId,
    actorType: "user" as const,
    action: "build.approved",
    targetType: "build",
    targetId: f.buildId,
  };
  expect(
    await buildRepository.moderatePending(f.buildId, "approve", audit, 1, `tok_${f.staffId}`),
  ).toBeNull();
  expect(
    await buildRepository.moderatePending(
      f.buildId,
      "approve",
      { ...audit, id: `${f.auditId}_new` },
      4,
      `tok_${f.staffId}`,
    ),
  ).toMatchObject({ status: "published", revision: 5 });
  expect((await productRepository.findById(f.productId))?.status).toBe("published");
  const events = await db
    .select()
    .from(auditEvents)
    .where(and(eq(auditEvents.targetId, f.buildId), eq(auditEvents.id, `${f.auditId}_old`)));
  expect(events).toHaveLength(0);
});
it("commits one competing edit and rolls the losing edit back", async () => {
  const f = await fixture("draft");
  const results = await Promise.allSettled(
    ["First notes", "Second notes"].map((releaseNotes, index) =>
      repo.command({
        ...f,
        auditId: `${f.auditId}_${index}`,
        command: { action: "save", expectedRevision: 1, releaseNotes, mtaVersionTarget: "" },
      }),
    ),
  );
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(
    (results.find((r) => r.status === "rejected") as PromiseRejectedResult).reason,
  ).toMatchObject({ code: "BUILD_REVISION_CONFLICT" });
  expect((await buildRepository.findById(f.buildId))?.revision).toBe(2);
});
it("enforces uploaded identity and metadata state at the SQL boundary", async () => {
  const f = await fixture();
  await expect(
    db
      .update(builds)
      .set({ sha256Hash: "b".repeat(64) })
      .where(eq(builds.id, f.buildId)),
  ).rejects.toThrow();
  await expect(
    db.update(builds).set({ releaseNotes: "Unreviewed change" }).where(eq(builds.id, f.buildId)),
  ).rejects.toThrow();
  await db.update(builds).set({ revision: 55 }).where(eq(builds.id, f.buildId));
  expect((await buildRepository.findById(f.buildId))?.revision).toBe(1);
});
it("retirement keeps a newer pending version in the product review scope", async () => {
  const f = await fixture();
  await buildRepository.create({
    id: `${f.buildId}_next`,
    productId: f.productId,
    version: "2.0.0",
    status: "pending_review",
    storageKey: `fixture/${f.buildId}-next.zip`,
    sha256Hash: "b".repeat(64),
    fileSizeBytes: 43,
    fileName: "next.zip",
    mimeType: "application/zip",
    scanStatus: "clean",
    scanner: "fixture-scanner",
    scannedAt: new Date(),
    isSigned: false,
  });
  await repo.command({
    ...f,
    command: { action: "retire", expectedRevision: 1, reason: "Use the new version" },
  });
  expect(await productRepository.findById(f.productId)).toMatchObject({
    status: "pending_review",
    currentVersion: "2.0.0",
  });
  expect(await buildRepository.findPublishedByProductAndId(f.productId, f.buildId)).toBeNull();
});
it("rolls the build and product transition back when audit insertion fails", async () => {
  const f = await fixture();
  await db.insert(auditEvents).values({
    id: f.auditId,
    actorId: f.actorId,
    actorType: "user",
    action: "fixture",
    targetType: "build",
    targetId: f.buildId,
  });
  await expect(
    repo.command({
      ...f,
      command: { action: "withdraw", expectedRevision: 1, reason: "Correct notes" },
    }),
  ).rejects.toThrow();
  expect(await buildRepository.findById(f.buildId)).toMatchObject({
    status: "pending_review",
    revision: 1,
  });
  expect((await db.select().from(products).where(eq(products.id, f.productId)))[0]?.status).toBe(
    "pending_review",
  );
});

it("preserves only the exact known demo metadata-repair scope", async () => {
  await db.transaction(async (tx) => {
    await tx.execute(
      sql.raw("CREATE TEMP TABLE builds (LIKE public.builds INCLUDING ALL) ON COMMIT DROP"),
    );
    await tx.execute(
      sql.raw(
        "CREATE TRIGGER fixture_revision BEFORE UPDATE ON pg_temp.builds FOR EACH ROW EXECUTE FUNCTION public.nexus_build_workspace_revision()",
      ),
    );
    await tx.insert(builds).values({
      id: "bld_inv_320",
      productId: "prd_inv_pro",
      version: "3.2.0",
      storageKey: "builds/prd_inv_pro/v3.2.0.zip",
      status: "retired",
      sha256Hash: "a".repeat(64),
      fileSizeBytes: 999,
      scanner: "seed-manual-review",
      scanStatus: "clean",
      scannedAt: new Date(),
    });
    await tx
      .update(builds)
      .set({ sha256Hash: "b".repeat(64), fileSizeBytes: 512 })
      .where(eq(builds.id, "bld_inv_320"));
    const [result] = await tx.select().from(builds).where(eq(builds.id, "bld_inv_320"));
    expect(result).toMatchObject({ revision: 2, fileSizeBytes: 512, status: "retired" });
    await expect(
      tx.transaction(async (nested) => {
        await nested
          .update(builds)
          .set({ scanner: null, sha256Hash: "c".repeat(64) })
          .where(eq(builds.id, "bld_inv_320"));
      }),
    ).rejects.toThrow();
  });
});
