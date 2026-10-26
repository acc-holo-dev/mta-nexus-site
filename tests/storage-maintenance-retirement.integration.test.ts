import { randomBytes } from "node:crypto";
import {
  assets,
  auditEvents,
  db,
  storageMaintenanceObjects as objects,
  sessionRepository,
  storageMaintenanceRepository as repo,
  userRepository,
  users,
} from "@nexus/db";
import { generateId } from "@nexus/security";
import { eq } from "drizzle-orm";
import { expect, it, vi } from "vitest";

// Requires a disposable PostgreSQL database migrated through 0061. Never touches storage.
async function fixture() {
  const suffix = randomBytes(8).toString("hex"),
    actor = `usr_smo_${suffix}`,
    token = `tok_${suffix}`,
    key = `assets/${actor}/ast_${suffix}.zip`;
  await userRepository.create({
    id: actor,
    role: "admin",
    username: actor,
    email: `${actor}@example.invalid`,
    displayName: actor,
  });
  await sessionRepository.create({
    id: `ses_${suffix}`,
    userId: actor,
    token,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  const modifiedAt = new Date(Date.now() - 8 * 86400000).toISOString();
  await repo.observe(actor, token, [
    {
      key,
      modifiedAt,
      sizeBytes: 16,
      sha256Hash: "a".repeat(64),
      device: "1",
      inode: "2",
      mtimeNs: "1",
      ctimeNs: "2",
    },
  ]);
  const [object] = await db.select().from(objects).where(eq(objects.storageKey, key));
  const asset = {
    id: generateId("ast"),
    ownerId: actor,
    storageKey: key,
    fileName: "private.zip",
    mimeType: "application/zip",
    fileSizeBytes: 16,
    sha256Hash: "a".repeat(64),
    status: "error",
    isPrivate: true,
  };
  if (!object) throw new Error("Expected observation");
  return { actor, token, key, object, asset };
}
async function cleanup(f: Awaited<ReturnType<typeof fixture>>) {
  await db.delete(assets).where(eq(assets.ownerId, f.actor));
  await db.delete(auditEvents).where(eq(auditEvents.actorId, f.actor));
  // Permanent tombstones intentionally remain in the disposable test DB.
  await db.delete(users).where(eq(users.id, f.actor));
}
it("protects any asset reference, including error/private records, and refuses stale revisions", async () => {
  const f = await fixture();
  try {
    await db.insert(assets).values(f.asset);
    await expect(repo.retire(f.actor, f.token, f.object.id, 1)).rejects.toMatchObject({
      code: "STORAGE_REFERENCED",
    });
    await db.delete(assets).where(eq(assets.id, f.asset.id));
    await expect(repo.retire(f.actor, f.token, f.object.id, 2)).rejects.toMatchObject({
      code: "STORAGE_REVISION_CONFLICT",
    });
    expect((await repo.detail(f.actor, f.object.id)).state).toBe("observed");
  } finally {
    await cleanup(f);
  }
});
it("makes a retired key permanent and serializes concurrent cleanup leases", async () => {
  const f = await fixture();
  try {
    const attempts = await Promise.allSettled([
      repo.retire(f.actor, f.token, f.object.id, 1),
      repo.retire(f.actor, f.token, f.object.id, 1),
    ]);
    expect(attempts.filter((v) => v.status === "fulfilled")).toHaveLength(1);
    const result = attempts.find((v) => v.status === "fulfilled");
    if (result?.status !== "fulfilled" || result.value.terminal) throw new Error("Expected lease");
    await expect(db.insert(assets).values(f.asset)).rejects.toThrow();
    await repo.finish(f.actor, f.object.id, result.value.leaseToken, "deleted");
    await expect(db.delete(objects).where(eq(objects.id, f.object.id))).rejects.toThrow();
    await expect(
      db
        .update(objects)
        .set({ retiredAt: null, state: "observed" })
        .where(eq(objects.id, f.object.id)),
    ).rejects.toThrow();
    expect(await repo.retire(f.actor, f.token, f.object.id, 1)).toMatchObject({
      terminal: true,
      state: "deleted",
    });
  } finally {
    await cleanup(f);
  }
});
it("waits for an in-flight reference commit and then refuses retirement", async () => {
  const f = await fixture();
  let release: () => void = () => {};
  let entered: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
      release = resolve;
    }),
    ready = new Promise<void>((resolve) => {
      entered = resolve;
    });
  try {
    const insert = db.transaction(async (tx) => {
      await tx.insert(assets).values(f.asset);
      entered();
      await gate;
    });
    await ready;
    const retirement = repo.retire(f.actor, f.token, f.object.id, 1);
    release();
    await insert;
    await expect(retirement).rejects.toMatchObject({ code: "STORAGE_REFERENCED" });
    expect((await repo.detail(f.actor, f.object.id)).retiredAt).toBeNull();
  } finally {
    release();
    await cleanup(f);
  }
});
it("rolls retirement and its barrier back when audit insertion fails", async () => {
  const f = await fixture();
  const collision = generateId("aud");
  try {
    await db.insert(auditEvents).values({
      id: collision,
      actorId: f.actor,
      actorType: "user",
      action: "fixture",
      targetType: "storage_object",
      targetId: f.object.id,
    });
    const spy = vi
      .spyOn(await import("@nexus/security"), "generateId")
      .mockImplementation((prefix) =>
        prefix === "aud" ? collision : `${prefix}_${randomBytes(12).toString("hex")}`,
      );
    try {
      await expect(repo.retire(f.actor, f.token, f.object.id, 1)).rejects.toThrow();
    } finally {
      spy.mockRestore();
    }
    const current = await repo.detail(f.actor, f.object.id);
    expect(current.state).toBe("observed");
    expect(current.retiredAt).toBeNull();
    await db.insert(assets).values(f.asset);
  } finally {
    await cleanup(f);
  }
});
it("uses a live admin role and protects the seven day grace", async () => {
  const f = await fixture();
  try {
    const now = new Date();
    await db
      .update(objects)
      .set({ modifiedAt: now, identity: { ...f.object.identity, modifiedAt: now.toISOString() } })
      .where(eq(objects.id, f.object.id));
    await expect(repo.retire(f.actor, f.token, f.object.id, 1)).rejects.toMatchObject({
      code: "STORAGE_RECENT",
    });
    await db.update(users).set({ role: "moderator" }).where(eq(users.id, f.actor));
    await expect(repo.list(f.actor)).rejects.toMatchObject({ statusCode: 403 });
  } finally {
    await cleanup(f);
  }
});

it("rejects new references from stale repeatable-read snapshots", async () => {
  const f = await fixture();
  try {
    await expect(
      db.transaction(
        async (tx) => {
          await tx.select().from(objects).where(eq(objects.id, f.object.id));
          const job = await repo.retire(f.actor, f.token, f.object.id, 1);
          if (job.terminal) throw new Error("Expected retirement");
          await tx.insert(assets).values(f.asset);
        },
        { isolationLevel: "repeatable read" },
      ),
    ).rejects.toThrow();
    expect((await repo.detail(f.actor, f.object.id)).state).toBe("retired");
  } finally {
    await cleanup(f);
  }
});
