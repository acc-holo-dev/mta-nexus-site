import { randomUUID } from "node:crypto";
import { db, serverClaimChallengeRepository, sessionRepository, userRepository } from "@nexus/db";
import { eq, sql } from "drizzle-orm";
import { expect, it } from "vitest";
import {
  auditEvents,
  serverClaimChallenges,
  servers,
  users,
} from "../../site/packages/db/src/schema";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

it("rolls back issuance if the session expires while the audit insert waits", async () => {
  const suffix = randomUUID().replaceAll("-", "");
  const actorId = `usr_late_${suffix}`,
    serverId = `srv_late_${suffix}`,
    token = `tok_late_${suffix}`,
    auditId = `aud_late_${suffix}`;
  const expiresAt = new Date(Date.now() + 4_000);
  await userRepository.create({
    id: actorId,
    email: `${actorId}@example.invalid`,
    username: actorId,
    displayName: "Claimant",
  });
  await sessionRepository.create({ id: `ses_late_${suffix}`, userId: actorId, token, expiresAt });
  await db.insert(servers).values({
    id: serverId,
    name: "Server",
    slug: serverId,
    ipAddress: `${suffix}.example.invalid`,
    port: 22003,
    visibility: "public",
  });
  const locked = deferred(),
    release = deferred();
  let blockerPid = 0;
  const blocker = db.transaction(async (tx) => {
    const [row] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
    blockerPid = Number(row.pid);
    await tx.insert(auditEvents).values({
      id: auditId,
      actorId,
      actorType: "user",
      action: "fixture",
      targetId: serverId,
      targetType: "server",
    });
    locked.resolve();
    await release.promise;
    throw new Error("rollback fixture");
  });
  try {
    await Promise.race([locked.promise, blocker]);
    const pending = serverClaimChallengeRepository
      .issue({ serverId, requesterId: actorId, auditId, currentToken: token })
      .then(
        () => null,
        (error: unknown) => error,
      );
    const deadline = Date.now() + 3_000;
    let blocked = false;
    while (Date.now() < deadline) {
      const [row] = await db.execute<{ blocked: boolean }>(
        sql`select exists(select 1 from pg_stat_activity where datname=current_database() and ${blockerPid}=any(pg_blocking_pids(pid))) as blocked`,
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
    expect(
      await db
        .select()
        .from(serverClaimChallenges)
        .where(eq(serverClaimChallenges.serverId, serverId)),
    ).toHaveLength(0);
    expect(await db.select().from(auditEvents).where(eq(auditEvents.id, auditId))).toHaveLength(0);
  } finally {
    release.resolve();
    await blocker.catch(() => {});
    await db.delete(auditEvents).where(eq(auditEvents.actorId, actorId));
    await db.delete(servers).where(eq(servers.id, serverId));
    await db.delete(users).where(eq(users.id, actorId));
  }
}, 15_000);
