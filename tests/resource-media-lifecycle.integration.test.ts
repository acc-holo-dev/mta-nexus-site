import { createHash, randomBytes } from "node:crypto";
import {
  auditEvents,
  buildRepository,
  builds,
  db,
  products,
  resourceMediaRepository as repo,
  resourceMedia,
  sessionRepository,
  userRepository,
  users,
} from "@nexus/db";
import { eq } from "drizzle-orm";
import { expect, it } from "vitest";
import { normalizeResourceImage } from "../apps/web/src/lib/services/resource-image-normalization";
import packages from "./fixtures/build-packages.json";
import fixtures from "./fixtures/resource-images.json";

// Requires a disposable PostgreSQL database migrated through 0060. No storage/provider writes.
async function fixture() {
  const key = randomBytes(8).toString("hex"),
    owner = `usr_img_${key}`,
    stranger = `usr_img_other_${key}`,
    moderator = `usr_img_mod_${key}`,
    productId = `prd_img_${key}`;
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
  await sessionRepository.create({
    id: `ses_${moderator}`,
    userId: moderator,
    token: `tok_${moderator}`,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  await db.insert(products).values({
    id: productId,
    authorId: owner,
    slug: productId,
    title: "Gallery test",
    description: "Canonical scanned images",
    type: "script",
  });
  for (const [index, format] of (["png", "jpeg"] as const).entries()) {
    const image = await normalizeResourceImage(Buffer.from(fixtures[format], "base64"));
    const before = await repo.managed(productId, owner);
    await repo.add({
      productId,
      actorId: owner,
      expectedUpdatedAt: before.product.updatedAt,
      auditId: `aud_img_${key}_${index}`,
      image: {
        id: `rmi_${key}_${index}`,
        productId,
        storageKey: `assets/${owner}/ast_${key}_${index}.png`,
        sha256Hash: createHash("sha256").update(image.bytes).digest("hex"),
        fileSizeBytes: image.bytes.length,
        width: image.width,
        height: image.height,
        position: index,
        scanner: "integration",
        scannedAt: new Date(),
        caption: `Image ${index}`,
      },
    });
  }
  const data = Buffer.from(packages.stored, "base64"),
    buildId = `bld_img_${key}`;
  await buildRepository.submitForReview(
    {
      id: buildId,
      productId,
      version: "1.0.0",
      status: "pending_review",
      storageKey: `fixture/${key}.zip`,
      fileName: "resource.zip",
      mimeType: "application/zip",
      sha256Hash: createHash("sha256").update(data).digest("hex"),
      fileSizeBytes: data.length,
      scanStatus: "clean",
      scanner: "integration",
      scannedAt: new Date(),
      isSigned: false,
    },
    {
      id: `aud_img_${key}_submit`,
      actorId: owner,
      actorType: "user",
      action: "build.submitted_for_review",
      targetType: "build",
      targetId: buildId,
    },
  );
  async function publish() {
    await buildRepository.moderatePending(
      buildId,
      "approve",
      {
        id: `aud_img_${key}_approve`,
        actorId: moderator,
        actorType: "user",
        action: "build.approved",
        targetType: "build",
        targetId: buildId,
      },
      1,
    `tok_${moderator}`);
  }
  async function cleanup() {
    await db.delete(products).where(eq(products.id, productId));
    for (const id of [owner, stranger, moderator]) await db.delete(users).where(eq(users.id, id));
  }
  return { key, owner, stranger, moderator, productId, buildId, publish, cleanup };
}
it("atomically swaps the cover, updates public projections and withdraws earlier pending observations", async () => {
  const f = await fixture();
  try {
    const before = await repo.managed(f.productId, f.owner);
    const result = await repo.command({
      productId: f.productId,
      actorId: f.owner,
      auditId: `aud_img_${f.key}_swap`,
      command: {
        action: "save",
        expectedUpdatedAt: before.product.updatedAt,
        items: [...before.items].reverse().map((v) => ({ id: v.id, caption: v.caption })),
      },
    });
    expect(result.items.map((v) => v.id)).toEqual([...before.items].reverse().map((v) => v.id));
    const [product] = await db.select().from(products).where(eq(products.id, f.productId));
    expect(product?.thumbnailUrl).toBe(result.items[0]?.url);
    expect(product?.screenshots).toEqual(result.items.map((v) => v.url));
    expect(product?.metadataReviewRequired).toBe(true);
    expect(product?.status).toBe("draft");
    expect((await db.select().from(builds).where(eq(builds.id, f.buildId)))[0]?.status).toBe(
      "draft",
    );
    expect(await repo.publicItems(f.productId)).toEqual([]);
    await expect(repo.authorizeImage(result.items[0]?.id ?? "")).rejects.toMatchObject({
      statusCode: 404,
    });
  } finally {
    await f.cleanup();
  }
});
it("serves only reviewed public gallery projections and requires live owner/moderator rights after withdrawal", async () => {
  const f = await fixture();
  try {
    await f.publish();
    const publicItems = await repo.publicItems(f.productId);
    expect(publicItems).toHaveLength(2);
    expect(JSON.stringify(publicItems)).not.toMatch(/storageKey|sha256Hash|scanner/u);
    await expect(repo.authorizeImage(publicItems[0]?.id ?? "")).resolves.toHaveProperty(
      "storageKey",
    );
    const before = await repo.managed(f.productId, f.owner);
    await repo.command({
      productId: f.productId,
      actorId: f.owner,
      auditId: `aud_img_${f.key}_caption`,
      command: {
        action: "save",
        expectedUpdatedAt: before.product.updatedAt,
        items: before.items.map((v) => ({ id: v.id, caption: "Updated caption" })),
      },
    });
    expect(await repo.publicItems(f.productId)).toEqual([]);
    await expect(repo.authorizeImage(publicItems[0]?.id ?? "", f.stranger)).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(
      repo.authorizeImage(publicItems[0]?.id ?? "", f.moderator),
    ).resolves.toHaveProperty("storageKey");
    await expect(repo.managed(f.productId, f.stranger)).rejects.toMatchObject({ statusCode: 404 });
  } finally {
    await f.cleanup();
  }
});
it("rolls gallery, publication and pending build changes back when audit insertion fails", async () => {
  const f = await fixture();
  try {
    const before = await repo.managed(f.productId, f.owner),
      auditId = `aud_img_${f.key}_collision`;
    await db.insert(auditEvents).values({
      id: auditId,
      actorId: f.owner,
      actorType: "user",
      action: "test",
      targetType: "product",
      targetId: f.productId,
    });
    await expect(
      repo.command({
        productId: f.productId,
        actorId: f.owner,
        auditId,
        command: {
          action: "remove",
          expectedUpdatedAt: before.product.updatedAt,
          mediaId: before.items[0]?.id ?? "",
        },
      }),
    ).rejects.toThrow();
    expect(await repo.managed(f.productId, f.owner)).toEqual(before);
    expect((await db.select().from(builds).where(eq(builds.id, f.buildId)))[0]?.status).toBe(
      "pending_review",
    );
  } finally {
    await f.cleanup();
  }
});
it("rejects immutable image replacement and stale concurrent commands while deletion revokes old IDs", async () => {
  const f = await fixture();
  try {
    const before = await repo.managed(f.productId, f.owner),
      first = before.items[0]?.id ?? "";
    await expect(
      db
        .update(resourceMedia)
        .set({ sha256Hash: "0".repeat(64) })
        .where(eq(resourceMedia.id, first)),
    ).rejects.toThrow();
    const results = await Promise.allSettled(
      [0, 1].map((index) =>
        repo.command({
          productId: f.productId,
          actorId: f.owner,
          auditId: `aud_img_${f.key}_race_${index}`,
          command: {
            action: "save",
            expectedUpdatedAt: before.product.updatedAt,
            items: before.items.map((v) => ({ id: v.id, caption: `Concurrent ${index}` })),
          },
        }),
      ),
    );
    expect(results.filter((v) => v.status === "fulfilled")).toHaveLength(1);
    const current = await repo.managed(f.productId, f.owner);
    await repo.command({
      productId: f.productId,
      actorId: f.owner,
      auditId: `aud_img_${f.key}_remove`,
      command: { action: "remove", expectedUpdatedAt: current.product.updatedAt, mediaId: first },
    });
    await expect(repo.authorizeImage(first, f.owner)).rejects.toMatchObject({ statusCode: 404 });
    expect((await repo.managed(f.productId, f.owner)).items[0]?.position).toBe(0);
  } finally {
    await f.cleanup();
  }
});
