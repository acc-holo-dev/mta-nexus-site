import { randomUUID } from "node:crypto";
import { db, productRepository, sessionRepository, userRepository } from "@nexus/db";
import { eq, sql } from "drizzle-orm";
import { expect, it } from "vitest";
import {
  auditEvents,
  organizationMembers,
  organizations,
  products,
  sessions,
  users,
} from "../packages/db/src/schema";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function waitBlocked(pid: number) {
  const deadline = Date.now() + 3_000;
  while (Date.now() < deadline) {
    const [row] = await db.execute<{ blocked: boolean }>(
      sql`select exists(select 1 from pg_stat_activity where datname=current_database() and ${pid}=any(pg_blocking_pids(pid))) as blocked`,
    );
    if (row?.blocked) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Product creation did not block");
}
async function fixture({ personal = false, lifetimeMs = 60_000, verified = false } = {}) {
  const key = randomUUID().replaceAll("-", "");
  const actorId = `usr_pcs_${key}`,
    ownerId = `usr_pco_${key}`,
    organizationId = `org_pcs_${key}`;
  const sessionId = `ses_pcs_${key}`,
    token = `tok_pcs_${key}`,
    productId = `prd_pcs_${key}`,
    auditId = `aud_pcs_${key}`;
  const membershipId = `mem_pcs_${key}`,
    expiresAt = new Date(Date.now() + lifetimeMs);
  await userRepository.create({
    id: actorId,
    email: `${actorId}@example.invalid`,
    username: actorId,
    displayName: "Creator",
    role: verified ? "user" : "developer",
    isVerified: verified,
  });
  await userRepository.create({
    id: ownerId,
    email: `${ownerId}@example.invalid`,
    username: ownerId,
    displayName: "Owner",
  });
  await sessionRepository.create({ id: sessionId, userId: actorId, token, expiresAt });
  await db
    .insert(organizations)
    .values({ id: organizationId, ownerId, name: "Fixture", slug: `org-${key}` });
  await db.insert(organizationMembers).values({
    id: membershipId,
    organizationId,
    userId: actorId,
    role: "member",
    permissions: ["manage_products"],
  });
  const data = {
    id: productId,
    title: "Product fixture",
    slug: `product-${key}`,
    description: "Fixture",
    type: "script" as const,
    status: "draft" as const,
    authorId: actorId,
    ...(personal ? {} : { organizationId }),
    price: 0,
    currency: "USD",
    licenseModel: "unlimited" as const,
    tags: [],
    currentVersion: "0.1.0",
    ratingAverage: 0,
    ratingCount: 0,
    salesCount: 0,
    isFeatured: false,
    screenshots: [],
    compatibility: {},
  };
  const audit = {
    id: auditId,
    actorId,
    actorType: "user" as const,
    action: "product.created",
    targetId: productId,
    targetType: "product",
  };
  const create = () => productRepository.createWithAudit(data, audit, token);
  const replay = () => productRepository.findCreatedDraftForReplay(data.slug, actorId, token);
  const unchanged = async () => {
    expect(await db.select().from(products).where(eq(products.id, productId))).toHaveLength(0);
    expect(await db.select().from(auditEvents).where(eq(auditEvents.id, auditId))).toHaveLength(0);
  };
  const cleanup = async () => {
    await db.delete(auditEvents).where(eq(auditEvents.id, auditId));
    await db.delete(products).where(eq(products.id, productId));
    await db.delete(organizations).where(eq(organizations.id, organizationId));
    for (const id of [actorId, ownerId]) await db.delete(users).where(eq(users.id, id));
  };
  return {
    actorId,
    organizationId,
    membershipId,
    sessionId,
    productId,
    auditId,
    expiresAt,
    create,
    replay,
    unchanged,
    cleanup,
  };
}

it.each(["revoke", "expire", "demote", "membership"] as const)(
  "rejects %s while waiting for organization authority",
  async (mode) => {
    const f = await fixture();
    const locked = deferred(),
      release = deferred();
    let pid = 0;
    const blocker = db.transaction(async (tx) => {
      const [row] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
      pid = Number(row.pid);
      await tx
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.id, f.organizationId))
        .for("update");
      locked.resolve();
      await release.promise;
      if (mode === "revoke") await tx.delete(sessions).where(eq(sessions.id, f.sessionId));
      else if (mode === "expire")
        await tx
          .update(sessions)
          .set({ expiresAt: new Date("2000-01-01T00:00:00Z") })
          .where(eq(sessions.id, f.sessionId));
      else if (mode === "demote")
        await tx
          .update(users)
          .set({ role: "user", isVerified: false })
          .where(eq(users.id, f.actorId));
      else
        await tx
          .update(organizationMembers)
          .set({ permissions: [] })
          .where(eq(organizationMembers.id, f.membershipId));
    });
    try {
      await Promise.race([locked.promise, blocker]);
      const pending = f.create().then(
        () => null,
        (error: unknown) => error,
      );
      try {
        await waitBlocked(pid);
      } finally {
        release.resolve();
      }
      await blocker;
      expect(await pending).toMatchObject({
        code: mode === "demote" || mode === "membership" ? "FORBIDDEN" : "UNAUTHORIZED",
      });
      await f.unchanged();
    } finally {
      release.resolve();
      await blocker.catch(() => {});
      await f.cleanup();
    }
  },
  15_000,
);

it("rolls back product and audit when the session expires during a late audit wait", async () => {
  const f = await fixture({ personal: true, lifetimeMs: 4_000 });
  const locked = deferred(),
    release = deferred();
  let pid = 0;
  const blocker = db.transaction(async (tx) => {
    const [row] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
    pid = Number(row.pid);
    await tx.insert(auditEvents).values({
      id: f.auditId,
      actorId: f.actorId,
      actorType: "user",
      action: "fixture",
      targetId: f.productId,
      targetType: "product",
    });
    locked.resolve();
    await release.promise;
    throw new Error("rollback fixture");
  });
  try {
    await Promise.race([locked.promise, blocker]);
    const pending = f.create().then(
      () => null,
      (error: unknown) => error,
    );
    await waitBlocked(pid);
    await new Promise((resolve) =>
      setTimeout(resolve, Math.max(0, f.expiresAt.getTime() - Date.now() + 150)),
    );
    release.resolve();
    await blocker.catch(() => {});
    expect(await pending).toMatchObject({ code: "UNAUTHORIZED" });
    await f.unchanged();
  } finally {
    release.resolve();
    await blocker.catch(() => {});
    await f.cleanup();
  }
}, 15_000);

it("allows a verified user to create a personal resource with a live session", async () => {
  const f = await fixture({ personal: true, verified: true });
  try {
    expect((await f.create()).id).toBe(f.productId);
    expect(await db.select().from(auditEvents).where(eq(auditEvents.id, f.auditId))).toHaveLength(
      1,
    );
  } finally {
    await f.cleanup();
  }
});

it("does not grant creation or replay from a stale owner membership", async () => {
  const f = await fixture();
  try {
    await db
      .update(organizationMembers)
      .set({ role: "owner", permissions: ["manage_products"] })
      .where(eq(organizationMembers.id, f.membershipId));
    await expect(f.create()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await f.unchanged();
    await db
      .update(organizationMembers)
      .set({ role: "member" })
      .where(eq(organizationMembers.id, f.membershipId));
    await f.create();
    expect((await f.replay())?.id).toBe(f.productId);
    await db
      .update(organizationMembers)
      .set({ role: "owner" })
      .where(eq(organizationMembers.id, f.membershipId));
    await expect(f.replay()).rejects.toMatchObject({ code: "NOT_FOUND" });
  } finally {
    await f.cleanup();
  }
});

it.each(["revoke", "membership"] as const)(
  "fails closed when %s changes while replay waits for the product lock",
  async (mode) => {
    const f = await fixture();
    const locked = deferred(),
      release = deferred();
    let pid = 0;
    try {
      await f.create();
      const blocker = db.transaction(async (tx) => {
        const [row] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
        pid = Number(row.pid);
        await tx
          .select({ id: products.id })
          .from(products)
          .where(eq(products.id, f.productId))
          .for("update");
        locked.resolve();
        await release.promise;
        if (mode === "revoke") await tx.delete(sessions).where(eq(sessions.id, f.sessionId));
        else await tx.delete(organizationMembers).where(eq(organizationMembers.id, f.membershipId));
      });
      try {
        await Promise.race([locked.promise, blocker]);
        const pending = f.replay().then(
          () => null,
          (error: unknown) => error,
        );
        try {
          await waitBlocked(pid);
        } finally {
          release.resolve();
        }
        await blocker;
        expect(await pending).toMatchObject({
          code: mode === "revoke" ? "UNAUTHORIZED" : "NOT_FOUND",
        });
      } finally {
        release.resolve();
        await blocker.catch(() => {});
      }
    } finally {
      await f.cleanup();
    }
  },
  15_000,
);
