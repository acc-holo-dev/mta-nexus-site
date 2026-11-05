import { randomUUID } from "node:crypto";
import { db, serverRepository, sessionRepository, userRepository } from "@nexus/db";
import { eq, sql } from "drizzle-orm";
import { expect, it } from "vitest";
import { auditEvents, organizations, servers, sessions, users } from "../packages/db/src/schema";

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
  throw new Error("Server creation did not block");
}
async function fixture({ role = "user", lifetimeMs = 60_000, personal = false } = {}) {
  const key = randomUUID().replaceAll("-", "");
  const actorId = `usr_scs_${key}`,
    ownerId = `usr_sco_${key}`,
    organizationId = `org_scs_${key}`;
  const sessionId = `ses_scs_${key}`,
    token = `tok_scs_${key}`,
    serverId = `srv_scs_${key}`,
    auditId = `aud_scs_${key}`;
  const expiresAt = new Date(Date.now() + lifetimeMs);
  for (const [id, userRole] of [
    [actorId, role],
    [ownerId, "user"],
  ]) {
    await userRepository.create({
      id,
      email: `${id}@example.invalid`,
      username: id,
      displayName: "User",
      role: userRole,
    });
  }
  await sessionRepository.create({ id: sessionId, userId: actorId, token, expiresAt });
  await db
    .insert(organizations)
    .values({ id: organizationId, ownerId, name: "Fixture", slug: `org-${key}` });
  const server = {
    id: serverId,
    name: "Server fixture",
    slug: `server-${key}`,
    ipAddress: "198.51.100.77",
    port: 10_000 + (parseInt(key.slice(0, 6), 16) % 40_000),
    ...(personal ? { ownerId: actorId } : { organizationId }),
    status: "active" as const,
    visibility: "private" as const,
    isVerified: false,
    gameplayTags: [],
    mediaUrls: [],
  };
  const audit = {
    id: auditId,
    actorId,
    actorType: "user" as const,
    action: "server.created",
    targetId: serverId,
    targetType: "server",
    details: { creationNonce: key },
  };
  const create = () => serverRepository.createWithAudit(server, audit, token);
  const unchanged = async () => {
    expect(await db.select().from(servers).where(eq(servers.id, serverId))).toHaveLength(0);
    expect(await db.select().from(auditEvents).where(eq(auditEvents.id, auditId))).toHaveLength(0);
  };
  const cleanup = async () => {
    await db.delete(auditEvents).where(eq(auditEvents.id, auditId));
    await db.delete(servers).where(eq(servers.id, serverId));
    await db.delete(organizations).where(eq(organizations.id, organizationId));
    for (const id of [actorId, ownerId]) await db.delete(users).where(eq(users.id, id));
  };
  return {
    actorId,
    organizationId,
    sessionId,
    serverId,
    auditId,
    expiresAt,
    create,
    unchanged,
    cleanup,
  };
}

it.each(["revoke", "expire", "demote"] as const)(
  "rejects %s while waiting for organization authority",
  async (mode) => {
    const f = await fixture({ role: "admin" });
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
      else await tx.update(users).set({ role: "user" }).where(eq(users.id, f.actorId));
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
        code: mode === "demote" ? "FORBIDDEN" : "UNAUTHORIZED",
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

it("rolls back server and audit when the initiating session expires during a late write wait", async () => {
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
      targetId: f.serverId,
      targetType: "server",
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

it("commits a valid personal registration together with its recovery nonce", async () => {
  const f = await fixture({ personal: true });
  try {
    expect((await f.create()).id).toBe(f.serverId);
    const [row] = await db.select().from(auditEvents).where(eq(auditEvents.id, f.auditId));
    expect(row.details).toMatchObject({ creationNonce: f.serverId.slice("srv_scs_".length) });
  } finally {
    await f.cleanup();
  }
});
