import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { expect, it } from "vitest";
import {
  db,
  users,
  products,
  builds,
  entitlements,
  userRepository,
  libraryCollectionsRepository as collections,
  resourceLibrarySelections,
} from "@nexus/db";
import type { LibraryCollectionCommand } from "@nexus/domain";
import { readLibraryCollectionInventory } from "../packages/db/src/repositories/library-collection-inventory";
function present<T>(value: T | undefined): T {
  if (value === undefined) throw Error("Missing fixture value");
  return value;
}
// Disposable PostgreSQL migrated through 0078. Read-fixture preferences deliberately
// include a retained withdrawn build; setup does not simulate download delivery.
it("deduplicates own version drift, matches the existing release overview and masks lost-access choices", async () => {
  const key = randomUUID().replaceAll("-", ""),
    owner = `usr_inv_${key}`,
    other = `usr_inv_other_${key}`;
  for (const id of [owner, other])
    await userRepository.create({
      id,
      email: `${id}@example.invalid`,
      username: id,
      displayName: id,
      role: "user",
    });
  const ids = Object.fromEntries(
    ["update", "latest", "pinned", "missing", "lost"].map((name) => [
      name,
      `prd_inv_${name}_${key}`,
    ]),
  );
  const releases: Record<string, { old: string; latest: string }> = {};
  for (const [name, productId] of Object.entries(ids)) {
    await db.insert(products).values({
      id: productId,
      authorId: other,
      slug: productId,
      title: name === "update" ? "Literal%_release" : `Inventory ${name}`,
      description: "Read fixture",
      type: "script",
      status: "published",
      price: 0,
    });
    await db.insert(entitlements).values({
      id: `ent_inv_${name}_${key}`,
      subjectType: "user",
      subjectId: owner,
      permission: "product.download",
      resourceId: productId,
    });
    const latest = `bld_inv_${name}_new_${key}`,
      old = `bld_inv_${name}_old_${key}`;
    releases[name] = { old, latest };
    await db.insert(builds).values({
      id: latest,
      productId,
      version: "2.0.0",
      status: "published",
      scanStatus: "clean",
      scanner: "fixture-scanner",
      scannedAt: new Date(),
      storageKey: `fixtures/${latest}.zip`,
      sha256Hash: "a".repeat(64),
      fileSizeBytes: 12,
      createdAt: new Date("2026-10-13T00:00:00Z"),
    });
    if (["update", "missing"].includes(name))
      await db.insert(builds).values({
        id: old,
        productId,
        version: "1.0.0",
        status: name === "missing" ? "retired" : "published",
        scanStatus: "clean",
        scanner: "fixture-scanner",
        scannedAt: new Date(),
        storageKey: `fixtures/${old}.zip`,
        sha256Hash: "b".repeat(64),
        fileSizeBytes: 12,
        createdAt: new Date("2026-10-12T00:00:00Z"),
      });
    if (name !== "latest")
      await db.insert(resourceLibrarySelections).values({
        userId: owner,
        productId,
        mode: "fixed",
        revision: 1,
        buildId: ["update", "missing"].includes(name) ? old : latest,
      });
  }
  const command = (body: LibraryCollectionCommand, id?: string) =>
    collections.command({
      userId: owner,
      command: body,
      collectionId: id,
      newCollectionId: `lcol_inv_${randomUUID().replaceAll("-", "")}`,
      receiptId: `lcr_inv_${randomUUID().replaceAll("-", "")}`,
      auditId: `aud_inv_${randomUUID()}`,
    });
  const first = (
    await command({ requestId: randomUUID(), action: "create", name: "Active inventory" })
  ).receipt.collection.id;
  const second = (
    await command({ requestId: randomUUID(), action: "create", name: "Archived inventory" })
  ).receipt.collection.id;
  await command(
    {
      requestId: randomUUID(),
      action: "add-many",
      expectedRevision: 1,
      productIds: Object.values(ids),
    },
    first,
  );
  await command(
    { requestId: randomUUID(), action: "add", expectedRevision: 1, productId: present(ids.update) },
    second,
  );
  await command({ requestId: randomUUID(), action: "archive", expectedRevision: 2 }, second);
  await db
    .delete(entitlements)
    .where(and(eq(entitlements.subjectId, owner), eq(entitlements.resourceId, present(ids.lost))));
  // Another account's fixed selection must not replace the caller's own choice.
  await db.insert(resourceLibrarySelections).values({
    userId: other,
    productId: present(ids.update),
    mode: "fixed",
    revision: 7,
    buildId: present(releases.update).latest,
  });
  const query = { page: 1, status: "all" as const, filter: "all" as const, q: "" };
  const report = await readLibraryCollectionInventory(owner, query);
  expect(report.counts).toEqual({
    resources: 5,
    references: 6,
    available: 4,
    unavailable: 1,
    shared: 1,
  });
  expect(report.releaseCounts).toEqual({
    latest: 1,
    pinned: 3,
    updates: 1,
    selectionUnavailable: 1,
    attention: 3,
  });
  const update = report.items.find((item) => item.productId === ids.update);
  expect(update?.release).toMatchObject({
    state: "update_available",
    revision: 1,
    effective: { buildId: present(releases.update).old },
  });
  expect(update?.memberships.map((item) => item.id).sort()).toEqual([first, second].sort());
  const scoped = await readLibraryCollectionInventory(owner, {
    ...query,
    collectionId: first,
    status: "active",
    filter: "shared",
    release: "updates",
  });
  expect(scoped.items).toHaveLength(1);
  expect(scoped.items[0]?.memberships).toHaveLength(2);
  expect(scoped.releaseCounts).toEqual(report.releaseCounts);
  const missing = await readLibraryCollectionInventory(owner, {
    ...query,
    release: "selection-unavailable",
  });
  expect(missing.items).toHaveLength(1);
  expect(missing.items[0]?.release).toMatchObject({
    state: "selection_unavailable",
    effective: null,
    latest: { buildId: present(releases.missing).latest },
  });
  expect(
    (await readLibraryCollectionInventory(owner, { ...query, release: "attention" })).total,
  ).toBe(3);
  expect((await readLibraryCollectionInventory(owner, { ...query, release: "pinned" })).total).toBe(
    3,
  );
  expect((await readLibraryCollectionInventory(owner, { ...query, release: "latest" })).total).toBe(
    1,
  );
  expect((await readLibraryCollectionInventory(owner, { ...query, q: "%_" })).total).toBe(1);
  expect(
    (await readLibraryCollectionInventory(owner, { ...query, q: "Inventory lost" })).total,
  ).toBe(0);
  const lost = (await readLibraryCollectionInventory(owner, { ...query, q: present(ids.lost) }))
    .items[0];
  expect(lost).toMatchObject({ title: null, available: false, release: null });
  expect(JSON.stringify(lost)).not.toContain(present(releases.lost).latest);
  const legacy = await collections.releases(owner, first);
  for (const item of report.items)
    expect(legacy.items.find((row) => row.productId === item.productId)?.state).toBe(
      item.release?.state ?? "unavailable",
    );
  expect((await collections.detail(owner, first)).collection.revision).toBe(2);
  expect((await collections.detail(owner, second)).collection.revision).toBe(3);
  expect((await readLibraryCollectionInventory(other, query)).items).toEqual([]);
  await expect(
    readLibraryCollectionInventory(other, { ...query, collectionId: first }),
  ).rejects.toMatchObject({ statusCode: 404 });
  expect(await db.select({ id: users.id }).from(users).where(eq(users.id, owner))).toHaveLength(1);
});
