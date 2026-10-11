import { randomBytes } from "node:crypto";
import {
  buildRepository,
  builds,
  db,
  entitlements,
  products,
  resourceRequirementsRepository as repo,
  resourceLibrarySelections as selections,
  userRepository,
  users,
} from "@nexus/db";
import { eq, inArray } from "drizzle-orm";
import { expect, it } from "vitest";
import { inspectBuildPackage } from "../apps/web/src/lib/services/build-package-inspection";
import archives from "./fixtures/build-packages.json";

// Requires a disposable PostgreSQL database migrated through 0061. No storage writes.
async function fixture(privateDependency = false) {
  const key = randomBytes(8).toString("hex"),
    owner = `usr_req_owner_${key}`,
    buyer = `usr_req_buyer_${key}`,
    staff = `usr_req_staff_${key}`;
  for (const [id, role] of [
    [owner, "developer"],
    [buyer, "user"],
    [staff, "moderator"],
  ] as const)
    await userRepository.create({
      id,
      role,
      email: `${id}@example.invalid`,
      username: id,
      displayName: id,
    });
  const ids = [`prd_req_root_${key}`, `prd_req_dep_${key}`, `prd_req_hidden_${key}`],
    slugs = ids.map((id) => id.replaceAll("_", "-"));
  const evidence = await inspectBuildPackage({
    bytes: Buffer.from(archives.stored, "base64"),
    format: "zip",
  });
  for (let index = 0; index < 3; index++) {
    const id = ids[index] ?? "",
      slug = slugs[index] ?? "";
    await db.insert(products).values({
      id,
      slug,
      authorId: owner,
      title: index === 2 ? "Secret unpublished title" : `Requirements ${index}`,
      description: "Requirements fixture",
      type: "script",
      compatibility: {
        mtaMinVersion: "1.6.0",
        dependencies:
          index === 0 ? [slugs[1] ?? ""] : index === 1 && privateDependency ? [slugs[2] ?? ""] : [],
      },
    });
    const build = await buildRepository.submitForReview(
      {
        id: `bld_req_${key}_${index}`,
        productId: id,
        version: "1.0.0",
        status: "pending_review",
        storageKey: `fixture/req_${key}_${index}.zip`,
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
        id: `aud_req_${key}_${index}`,
        actorId: owner,
        actorType: "user",
        action: "build.submitted_for_review",
        targetType: "build",
        targetId: `bld_req_${key}_${index}`,
      },
    );
    if (index < 2)
      await buildRepository.moderatePending(
        build.id,
        "approve",
        {
          id: `aud_req_${key}_${index}_approve`,
          actorId: staff,
          actorType: "user",
          action: "build.approved",
          targetType: "build",
          targetId: build.id,
        },
        1,
      );
  }
  await db.insert(entitlements).values({
    id: `ent_req_${key}`,
    subjectType: "user",
    subjectId: buyer,
    permission: "product.download",
    resourceId: ids[0] ?? "",
  });
  async function publishReplacement() {
    const productId = ids[0] ?? "",
      id = `bld_req_${key}_replacement`;
    const build = await buildRepository.submitForReview(
      {
        id,
        productId,
        version: "2.0.0",
        status: "pending_review",
        storageKey: `fixture/req_${key}_replacement.zip`,
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
        id: `aud_req_${key}_replacement`,
        actorId: owner,
        actorType: "user",
        action: "build.submitted_for_review",
        targetType: "build",
        targetId: id,
      },
    );
    await buildRepository.moderatePending(
      build.id,
      "approve",
      {
        id: `aud_req_${key}_replacement_approve`,
        actorId: staff,
        actorType: "user",
        action: "build.approved",
        targetType: "build",
        targetId: build.id,
      },
      1,
    );
  }
  async function cleanup() {
    await db.delete(entitlements).where(eq(entitlements.subjectId, buyer));
    await db.delete(products).where(inArray(products.id, ids));
    await db.delete(users).where(inArray(users.id, [owner, buyer, staff]));
  }
  const query = {
    actorId: buyer,
    productId: ids[0] ?? "",
    scope: "library" as const,
    targetMta: "1.6.0",
  };
  return { key, ids, slugs, owner, buyer, staff, query, cleanup, publishReplacement };
}
it("reports transitive public declarations and effective root access without minting dependency grants", async () => {
  const f = await fixture();
  try {
    const result = await repo.report(f.query);
    expect(result.nodes).toHaveLength(2);
    expect(result.issues).toContainEqual({ code: "missing_access", slug: f.slugs[1] });
    expect(result.order).toEqual([f.slugs[1], f.slugs[0]]);
    const grants = await db.select().from(entitlements).where(eq(entitlements.subjectId, f.buyer));
    expect(grants).toHaveLength(1);
  } finally {
    await f.cleanup();
  }
});
it("does not leak private dependency titles, IDs, builds or further declarations", async () => {
  const f = await fixture(true);
  try {
    const result = await repo.report(f.query);
    expect(result.issues).toContainEqual({ code: "unavailable", slug: f.slugs[2] });
    expect(JSON.stringify(result)).not.toContain("Secret unpublished title");
    expect(result.nodes.some((node) => node.id === f.ids[2])).toBe(false);
  } finally {
    await f.cleanup();
  }
});
it("refuses inaccessible roots and separates publisher/moderator authority", async () => {
  const f = await fixture();
  try {
    await expect(repo.report({ ...f.query, actorId: f.owner })).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(repo.report({ ...f.query, scope: "publisher" })).rejects.toMatchObject({
      statusCode: 404,
    });
    expect((await repo.report({ ...f.query, actorId: f.owner, scope: "publisher" })).scope).toBe(
      "publisher",
    );
    expect((await repo.report({ ...f.query, actorId: f.staff, scope: "moderator" })).scope).toBe(
      "moderator",
    );
  } finally {
    await f.cleanup();
  }
});
it("keeps a withdrawn pinned release unavailable instead of selecting a replacement", async () => {
  const f = await fixture();
  try {
    const buildId = `bld_req_${f.key}_0`;
    await db
      .insert(selections)
      .values({ userId: f.buyer, productId: f.ids[0] ?? "", mode: "fixed", buildId, revision: 1 });
    await f.publishReplacement();
    await db.update(builds).set({ status: "deprecated" }).where(eq(builds.id, buildId));
    const report = await repo.report(f.query);
    expect(report.nodes.find((node) => node.id === f.ids[0])?.build).toBeNull();
    expect(report.issues).toContainEqual({ code: "selection_unavailable", slug: f.slugs[0] });
  } finally {
    await f.cleanup();
  }
});
it("previews an exact unpublished build only within its authorized product", async () => {
  const f = await fixture();
  try {
    const productId = f.ids[2] ?? "",
      buildId = `bld_req_${f.key}_2`;
    const result = await repo.report({
      ...f.query,
      actorId: f.owner,
      productId,
      scope: "publisher",
      buildId,
    });
    expect(result.nodes[0]?.build?.id).toBe(buildId);
    expect(result.issues).toContainEqual({ code: "unsafe_build", slug: f.slugs[2] });
    await expect(
      repo.report({ ...f.query, actorId: f.owner, scope: "publisher", buildId }),
    ).rejects.toMatchObject({ statusCode: 404 });
  } finally {
    await f.cleanup();
  }
});
