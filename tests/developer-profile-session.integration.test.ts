import { randomUUID } from "node:crypto";
import { db, developerProfileRepository, sessionRepository, userRepository } from "@nexus/db";
import { eq, sql } from "drizzle-orm";
import { expect, it } from "vitest";
import { auditEvents, developerProfiles, sessions, users } from "../packages/db/src/schema";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

it.each(["revoke", "expire"] as const)(
  "does not update the profile if the session is %s-d while waiting for the actor lock",
  async (mode) => {
    const suffix = randomUUID().replaceAll("-", ""),
      actorId = `usr_dps_${suffix}`,
      sessionId = `ses_dps_${suffix}`,
      token = `tok_dps_${suffix}`,
      auditId = `aud_dps_${suffix}`;
    const user = await userRepository.create({
      id: actorId,
      email: `${actorId}@example.invalid`,
      username: actorId,
      displayName: "Developer",
      role: "developer",
    });
    await sessionRepository.create({
      id: sessionId,
      userId: actorId,
      token,
      expiresAt: new Date(Date.now() + 60_000),
    });
    await db
      .insert(developerProfiles)
      .values({
        id: `dev_dps_${suffix}`,
        userId: actorId,
        specialties: ["Lua"],
        githubUrl: "https://example.test/old",
        verifiedDeveloper: true,
      });
    const locked = deferred(),
      release = deferred();
    let pid = 0;
    const blocker = db.transaction(async (tx) => {
      const [row] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
      pid = Number(row.pid);
      await tx.select({ id: users.id }).from(users).where(eq(users.id, actorId)).for("update");
      locked.resolve();
      await release.promise;
      if (mode === "revoke") await tx.delete(sessions).where(eq(sessions.id, sessionId));
      else
        await tx
          .update(sessions)
          .set({ expiresAt: new Date("2000-01-01T00:00:00.000Z") })
          .where(eq(sessions.id, sessionId));
    });
    try {
      await Promise.race([locked.promise, blocker]);
      const pending = developerProfileRepository
        .update({
          actorId,
          currentToken: token,
          expectedUpdatedAt: user.updatedAt,
          specialties: ["TypeScript"],
          githubUrl: "https://example.test/new",
          discordTag: "new",
          profileId: `dev_new_${suffix}`,
          auditId,
        })
        .then(
          () => null,
          (error: unknown) => error,
        );
      let blocked = false;
      const deadline = Date.now() + 10_000;
      try {
        while (Date.now() < deadline) {
          const [row] = await db.execute<{ blocked: boolean }>(
            sql`select exists(select 1 from pg_stat_activity where datname=current_database() and ${pid}=any(pg_blocking_pids(pid))) as blocked`,
          );
          if (row?.blocked) {
            blocked = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      } finally {
        release.resolve();
      }
      await blocker;
      expect(blocked).toBe(true);
      expect(await pending).toMatchObject({ code: "UNAUTHORIZED" });
      const [profile] = await db
        .select()
        .from(developerProfiles)
        .where(eq(developerProfiles.userId, actorId));
      expect(profile).toMatchObject({
        specialties: ["Lua"],
        githubUrl: "https://example.test/old",
        verifiedDeveloper: true,
      });
      expect(await db.select().from(auditEvents).where(eq(auditEvents.id, auditId))).toHaveLength(
        0,
      );
    } finally {
      release.resolve();
      await blocker.catch(() => {});
      await db.delete(auditEvents).where(eq(auditEvents.actorId, actorId));
      await db.delete(users).where(eq(users.id, actorId));
    }
  },
  15_000,
);

it("rolls back profile changes if the session expires while the audit insert waits", async () => {
  const suffix = randomUUID().replaceAll("-", ""),
    actorId = `usr_dpl_${suffix}`,
    token = `tok_dpl_${suffix}`,
    auditId = `aud_dpl_${suffix}`;
  const expiresAt = new Date(Date.now() + 4_000);
  const user = await userRepository.create({
    id: actorId,
    email: `${actorId}@example.invalid`,
    username: actorId,
    displayName: "Developer",
    role: "developer",
  });
  await sessionRepository.create({ id: `ses_dpl_${suffix}`, userId: actorId, token, expiresAt });
  await db
    .insert(developerProfiles)
    .values({
      id: `dev_dpl_${suffix}`,
      userId: actorId,
      specialties: ["Lua"],
      githubUrl: "https://example.test/old",
      verifiedDeveloper: true,
    });
  const locked = deferred(),
    release = deferred();
  let pid = 0;
  const blocker = db.transaction(async (tx) => {
    const [row] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
    pid = Number(row.pid);
    await tx
      .insert(auditEvents)
      .values({
        id: auditId,
        actorId,
        actorType: "user",
        action: "fixture",
        targetId: actorId,
        targetType: "user",
      });
    locked.resolve();
    await release.promise;
    throw new Error("rollback fixture");
  });
  try {
    await Promise.race([locked.promise, blocker]);
    const pending = developerProfileRepository
      .update({
        actorId,
        currentToken: token,
        expectedUpdatedAt: user.updatedAt,
        specialties: ["TypeScript"],
        githubUrl: "https://example.test/new",
        discordTag: "new",
        profileId: `dev_new_${suffix}`,
        auditId,
      })
      .then(
        () => null,
        (error: unknown) => error,
      );
    let blocked = false;
    const deadline = Date.now() + 3_000;
    while (Date.now() < deadline) {
      const [row] = await db.execute<{ blocked: boolean }>(
        sql`select exists(select 1 from pg_stat_activity where datname=current_database() and ${pid}=any(pg_blocking_pids(pid))) as blocked`,
      );
      if (row?.blocked) {
        blocked = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(blocked).toBe(true);
    await new Promise((resolve) =>
      setTimeout(resolve, Math.max(0, expiresAt.getTime() - Date.now() + 150)),
    );
    release.resolve();
    await blocker.catch(() => {});
    expect(await pending).toMatchObject({ code: "UNAUTHORIZED" });
    const [profile] = await db
      .select()
      .from(developerProfiles)
      .where(eq(developerProfiles.userId, actorId));
    expect(profile).toMatchObject({
      specialties: ["Lua"],
      githubUrl: "https://example.test/old",
      verifiedDeveloper: true,
    });
    expect(await db.select().from(auditEvents).where(eq(auditEvents.id, auditId))).toHaveLength(0);
  } finally {
    release.resolve();
    await blocker.catch(() => {});
    await db.delete(auditEvents).where(eq(auditEvents.actorId, actorId));
    await db.delete(users).where(eq(users.id, actorId));
  }
}, 15_000);
