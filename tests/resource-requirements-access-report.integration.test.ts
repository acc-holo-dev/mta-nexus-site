import { expect, it } from "vitest";
import {
  auditEvents,
  batchFixture,
  builds,
  db,
  entitlements,
  eq,
  fixture,
  repo,
  selections,
} from "./helpers/resource-requirements-access-harness";

// Requires a disposable PostgreSQL database migrated through 0061. No storage writes.
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
it("previews a candidate release while preserving root and dependency selections and audits", async () => {
  const f = await batchFixture();
  try {
    await f.apply();
    await f.publishReplacement();
    const before = await db
      .select()
      .from(selections)
      .where(eq(selections.userId, f.buyer))
      .orderBy(selections.productId);
    const audits = await db
      .select({ id: auditEvents.id })
      .from(auditEvents)
      .where(eq(auditEvents.actorId, f.buyer))
      .orderBy(auditEvents.id);
    const productId = f.ids[0] ?? "",
      previewBuildId = `bld_req_${f.key}_replacement`;
    const current = await repo.report({
      actorId: f.buyer,
      productId,
      scope: "library",
      targetMta: "1.6.0",
    });
    expect(current.nodes.find((node) => node.id === productId)?.build?.id).toBe(
      `bld_req_${f.key}_0`,
    );
    const preview = await repo.report({
      actorId: f.buyer,
      productId,
      scope: "library",
      targetMta: "1.6.0",
      previewBuildId,
    });
    expect(preview.previewBuildId).toBe(previewBuildId);
    expect(preview.nodes.find((node) => node.id === productId)).toMatchObject({
      selection: "preview",
      build: { id: previewBuildId },
    });
    expect(preview.nodes.find((node) => node.id === f.ids[1])).toMatchObject({
      selection: "fixed",
      build: { id: `bld_req_${f.key}_1` },
    });
    expect(
      await db
        .select()
        .from(selections)
        .where(eq(selections.userId, f.buyer))
        .orderBy(selections.productId),
    ).toEqual(before);
    expect(
      await db
        .select({ id: auditEvents.id })
        .from(auditEvents)
        .where(eq(auditEvents.actorId, f.buyer))
        .orderBy(auditEvents.id),
    ).toEqual(audits);
    expect(JSON.stringify(preview)).not.toContain("fixture/req_");
  } finally {
    await f.cleanup();
  }
});
it("does not preview a foreign or withdrawn release or reuse a revoked buyer grant", async () => {
  const f = await fixture();
  try {
    await f.publishReplacement();
    const query = {
      actorId: f.buyer,
      productId: f.ids[0] ?? "",
      scope: "library" as const,
      targetMta: "1.6.0",
      previewBuildId: `bld_req_${f.key}_replacement`,
    };
    await expect(
      repo.report({ ...query, previewBuildId: `bld_req_${f.key}_1` }),
    ).rejects.toMatchObject({ statusCode: 404 });
    await db
      .update(builds)
      .set({ status: "deprecated" })
      .where(eq(builds.id, query.previewBuildId));
    await expect(repo.report(query)).rejects.toMatchObject({ statusCode: 404 });
    await db.delete(entitlements).where(eq(entitlements.subjectId, f.buyer));
    await expect(
      repo.report({ ...query, previewBuildId: `bld_req_${f.key}_0` }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(await db.select().from(selections).where(eq(selections.userId, f.buyer))).toHaveLength(
      0,
    );
  } finally {
    await f.cleanup();
  }
});
