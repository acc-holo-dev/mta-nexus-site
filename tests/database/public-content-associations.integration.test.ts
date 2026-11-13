import { randomUUID } from "node:crypto";
import { authorContentRepository, contentRepository, db, userRepository } from "@nexus/db";
import { eq } from "drizzle-orm";
import { expect, it } from "vitest";
import { builds, content, products, servers, users } from "../../site/packages/db/src/schema";

it("hides private or unsafe associations from all public projections and preserves public links", async () => {
  const suffix = randomUUID().replaceAll("-", "");
  const userId = `usr_pubassoc_${suffix}`;
  const serverId = `srv_pubassoc_${suffix}`;
  const productId = `prd_pubassoc_${suffix}`;
  const buildId = `bld_pubassoc_${suffix}`;
  const slug = `pubassoc-${suffix}`;
  await userRepository.create({
    id: userId,
    email: `${userId}@example.invalid`,
    username: userId,
    displayName: "Author",
  });
  try {
    await db.insert(servers).values({
      id: serverId,
      name: "Server",
      slug: `s-${slug}`,
      ipAddress: `${suffix}.example.invalid`,
      port: 22003,
      visibility: "public",
      status: "active",
    });
    await db.insert(products).values({
      id: productId,
      authorId: userId,
      title: "Resource",
      slug: `p-${slug}`,
      description: "Resource",
      type: "script",
      status: "published",
    });
    await db.insert(builds).values({
      id: buildId,
      productId,
      version: "1.0.0",
      status: "published",
      storageKey: `fixture/${suffix}.zip`,
      sha256Hash: "a".repeat(64),
      fileSizeBytes: 100,
      scanStatus: "clean",
      scanner: "fixture",
      scannedAt: new Date(),
    });
    await db.insert(content).values({
      id: `cnt_pubassoc_${suffix}`,
      slug,
      title: slug,
      body: "Public article",
      type: "article",
      status: "published",
      authorId: userId,
      serverId,
      productId,
    });

    const publicRows = async () => {
      const detail = await contentRepository.findPublishedBySlug(slug, { incrementView: false });
      const catalog = await authorContentRepository.pagePublic(["article"], { query: slug });
      const list = await contentRepository.listPublished(100);
      return [
        detail,
        catalog.items.find((item) => item.slug === slug),
        list.find((item) => item.slug === slug),
      ];
    };
    for (const row of await publicRows()) expect(row).toMatchObject({ serverId, productId });

    await db.update(servers).set({ visibility: "private" }).where(eq(servers.id, serverId));
    await db.update(builds).set({ status: "retired" }).where(eq(builds.id, buildId));
    for (const row of await publicRows())
      expect(row).toMatchObject({ serverId: null, productId: null });
    expect(await contentRepository.findById(`cnt_pubassoc_${suffix}`)).toMatchObject({
      serverId,
      productId,
    });
  } finally {
    await db.delete(content).where(eq(content.slug, slug));
    await db.delete(products).where(eq(products.id, productId));
    await db.delete(servers).where(eq(servers.id, serverId));
    await db.delete(users).where(eq(users.id, userId));
  }
});
