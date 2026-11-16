import { createHash, randomUUID } from "node:crypto";
import {
  auditEvents,
  resourceCopiesRepository as copies,
  db,
  organizationMembers,
  organizations,
  products,
  resourceDraftCopies,
  userRepository,
} from "@nexus/db";
import { and, eq } from "drizzle-orm";
import { expect, it } from "vitest";

// Requires disposable PostgreSQL migrated through 0065. Immutable receipts are
// retained until that database is discarded; never disable guards for cleanup.
async function fixture(organization = false) {
  const key = randomUUID().replaceAll("-", ""),
    actor = `usr_copy_${key}`,
    owner = `usr_copy_owner_${key}`,
    sourceId = `prd_copy_source_${key}`,
    org = `org_copy_${key}`;
  for (const id of [actor, owner])
    await userRepository.create({
      id,
      email: `${id}@example.invalid`,
      username: id,
      displayName: id,
      role: "developer",
    });
  if (organization) {
    await db
      .insert(organizations)
      .values({ id: org, ownerId: owner, name: "Copy fixture organization", slug: org });
    await db.insert(organizationMembers).values({
      id: `member_copy_${key}`,
      organizationId: org,
      userId: actor,
      role: "developer",
      permissions: ["manage_products"],
    });
  }
  await db.insert(products).values({
    id: sourceId,
    title: "Original resource",
    slug: `source-${key}`,
    description: "Original resource description",
    shortDescription: "Original summary",
    type: "script",
    authorId: organization ? owner : actor,
    organizationId: organization ? org : null,
    status: "draft",
    price: 0,
    licenseModel: "unlimited",
    tags: ["roleplay"],
    compatibility: { dependencies: ["core"] },
  });
  const preview = await copies.preview(actor, sourceId);
  const command = {
    requestId: randomUUID(),
    reviewDigest: preview.reviewDigest,
    title: "Copied resource",
    slug: `target-${key}`,
  };
  return { key, actor, owner, sourceId, org, command };
}
it("concurrent retries create one independent unreviewed target and two atomic audits", async () => {
  const f = await fixture(),
    results = await Promise.all(
      Array.from({ length: 4 }, () => copies.create(f.actor, f.sourceId, f.command)),
    );
  expect(results.filter((r) => !r.replayed)).toHaveLength(1);
  expect(new Set(results.map((r) => r.receipt.target.id)).size).toBe(1);
  const saved = results[0];
  if (!saved) throw new Error("Missing copy fixture result");
  const [target] = await db.select().from(products).where(eq(products.id, saved.receipt.target.id));
  expect(target).toMatchObject({
    status: "draft",
    metadataReviewRequired: true,
    authorId: f.actor,
    price: 0,
    currency: "USD",
    licenseModel: "unlimited",
    currentVersion: "1.0.0",
    ratingCount: 0,
    salesCount: 0,
    thumbnailUrl: null,
    screenshots: [],
  });
  expect(
    await db
      .select()
      .from(resourceDraftCopies)
      .where(eq(resourceDraftCopies.targetProductId, saved.receipt.target.id)),
  ).toHaveLength(1);
  expect(
    await db
      .select()
      .from(auditEvents)
      .where(and(eq(auditEvents.actorId, f.actor), eq(auditEvents.action, "product.draft_copied"))),
  ).toHaveLength(1);
  expect(
    await db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.targetId, saved.receipt.target.id),
          eq(auditEvents.action, "product.created"),
        ),
      ),
  ).toHaveLength(1);
});
it("receipts stay immutable after source/target edits and cannot be supplied by callers", async () => {
  const f = await fixture(),
    saved = await copies.create(f.actor, f.sourceId, f.command);
  await expect(
    db
      .update(resourceDraftCopies)
      .set({ snapshot: {} })
      .where(eq(resourceDraftCopies.id, saved.receipt.id)),
  ).rejects.toThrow();
  await expect(
    db.delete(resourceDraftCopies).where(eq(resourceDraftCopies.id, saved.receipt.id)),
  ).rejects.toThrow();
  await expect(
    db.insert(resourceDraftCopies).values({
      id: `rcopy_forged_${f.key}`,
      actorId: f.actor,
      requestId: randomUUID(),
      sourceProductId: f.sourceId,
      targetProductId: saved.receipt.target.id,
      commandDigest: "a".repeat(64),
      snapshot: saved.receipt,
    }),
  ).rejects.toThrow();
  await db
    .update(products)
    .set({ description: "Later changed source description", updatedAt: new Date() })
    .where(eq(products.id, f.sourceId));
  // Title edits force draft via metadata-review trigger; archive status alone afterward.
  await db
    .update(products)
    .set({ title: "Later target title" })
    .where(eq(products.id, saved.receipt.target.id));
  await db
    .update(products)
    .set({ status: "archived" })
    .where(eq(products.id, saved.receipt.target.id));
  const [liveTarget] = await db
    .select({ status: products.status })
    .from(products)
    .where(eq(products.id, saved.receipt.target.id));
  expect(await copies.detail(f.actor, f.sourceId, saved.receipt.id)).toMatchObject({
    receipt: {
      target: { title: f.command.title },
      metadata: { description: "Original resource description" },
    },
    targetStatus: liveTarget?.status,
  });
  expect(liveTarget?.status).toBe("archived");
  expect((await copies.create(f.actor, f.sourceId, f.command)).replayed).toBe(true);
  await expect(
    copies.create(f.actor, f.sourceId, {
      ...f.command,
      requestId: randomUUID(),
      slug: `other-${f.key}`,
    }),
  ).rejects.toMatchObject({ code: "RESOURCE_COPY_SOURCE_CHANGED" });
});
it("delegated organization management preserves publisher and revoked grants mask reads/retries", async () => {
  const f = await fixture(true),
    saved = await copies.create(f.actor, f.sourceId, f.command);
  expect(
    (await db.select().from(products).where(eq(products.id, saved.receipt.target.id)))[0],
  ).toMatchObject({ organizationId: f.org, authorId: f.owner });
  expect((await copies.detail(f.owner, f.sourceId, saved.receipt.id)).receipt.id).toBe(
    saved.receipt.id,
  );
  await db
    .update(organizationMembers)
    .set({ permissions: [] })
    .where(
      and(eq(organizationMembers.organizationId, f.org), eq(organizationMembers.userId, f.actor)),
    );
  await expect(copies.create(f.actor, f.sourceId, f.command)).rejects.toMatchObject({
    statusCode: 404,
  });
  await expect(copies.detail(f.actor, f.sourceId, saved.receipt.id)).rejects.toMatchObject({
    statusCode: 404,
  });
});
it("audit failure rolls back target and receipt without consuming the request", async () => {
  const f = await fixture(),
    key = createHash("sha256")
      .update(JSON.stringify({ actorId: f.actor, requestId: f.command.requestId.toLowerCase() }))
      .digest("hex");
  await db.insert(auditEvents).values({
    id: `aud_copy_target_${key}`,
    actorId: f.actor,
    actorType: "user",
    action: "fixture.audit_collision",
    targetId: f.sourceId,
    targetType: "product",
    details: {},
  });
  await expect(copies.create(f.actor, f.sourceId, f.command)).rejects.toThrow();
  expect(
    await db
      .select()
      .from(products)
      .where(eq(products.id, `prd_copy_${key}`)),
  ).toHaveLength(0);
  expect(
    await db
      .select()
      .from(resourceDraftCopies)
      .where(eq(resourceDraftCopies.requestId, f.command.requestId)),
  ).toHaveLength(0);
});
it("a global slug race commits exactly one copy and leaves no partial losing receipt", async () => {
  const first = await fixture(),
    second = await fixture(),
    slug = `shared-copy-${first.key}`;
  const results = await Promise.allSettled([
    copies.create(first.actor, first.sourceId, { ...first.command, slug }),
    copies.create(second.actor, second.sourceId, { ...second.command, slug }),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const failed = results.find((r) => r.status === "rejected");
  expect(failed).toMatchObject({
    status: "rejected",
    reason: { code: "RESOURCE_COPY_SLUG_TAKEN" },
  });
  expect(await db.select().from(products).where(eq(products.slug, slug))).toHaveLength(1);
});
