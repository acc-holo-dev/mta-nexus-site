import { randomUUID } from "node:crypto";
import { db, serverClaimChallengeRepository, sessionRepository, userRepository } from "@nexus/db";
import { eq, sql } from "drizzle-orm";
import { expect, it } from "vitest";
import {
  auditEvents,
  serverClaimChallenges,
  servers,
  sessions,
  users,
  verificationNotificationDeliveries,
  verificationRequests,
} from "../../site/packages/db/src/schema";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function waitForBlocker(pid: number) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const [row] = await db.execute<{ blocked: boolean }>(sql`select exists (
      select 1 from pg_stat_activity where datname=current_database() and ${pid}=any(pg_blocking_pids(pid))
    ) as blocked`);
    if (row?.blocked) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Claim operation did not wait on the server lock");
}
async function fixture() {
  const suffix = randomUUID().replaceAll("-", ""),
    actorId = `usr_scs_${suffix}`,
    serverId = `srv_scs_${suffix}`,
    sessionId = `ses_scs_${suffix}`,
    token = `tok_scs_${suffix}`;
  await userRepository.create({
    id: actorId,
    email: `${actorId}@example.invalid`,
    username: actorId,
    displayName: "Claimant",
  });
  await sessionRepository.create({
    id: sessionId,
    userId: actorId,
    token,
    expiresAt: new Date(Date.now() + 60_000),
  });
  await db.insert(servers).values({
    id: serverId,
    name: "Server",
    slug: serverId,
    ipAddress: `${suffix}.example.invalid`,
    port: 22003,
    visibility: "public",
  });
  const issue = (auditId: string) =>
    serverClaimChallengeRepository.issue({
      serverId,
      requesterId: actorId,
      auditId,
      currentToken: token,
    });
  const cleanup = async () => {
    await db.delete(auditEvents).where(eq(auditEvents.actorId, actorId));
    await db.delete(verificationRequests).where(eq(verificationRequests.requesterId, actorId));
    await db.delete(servers).where(eq(servers.id, serverId));
    await db.delete(users).where(eq(users.id, actorId));
  };
  return { suffix, actorId, serverId, sessionId, token, issue, cleanup };
}
async function revokeWhileBlocked<T>(
  f: Awaited<ReturnType<typeof fixture>>,
  action: () => Promise<T>,
  expire = false,
) {
  const locked = deferred(),
    release = deferred();
  let pid = 0;
  const blocker = db.transaction(async (tx) => {
    const [row] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
    pid = Number(row.pid);
    await tx
      .select({ id: servers.id })
      .from(servers)
      .where(eq(servers.id, f.serverId))
      .for("update");
    locked.resolve();
    await release.promise;
    if (expire)
      await tx
        .update(sessions)
        .set({ expiresAt: new Date("2000-01-01T00:00:00.000Z") })
        .where(eq(sessions.id, f.sessionId));
    else await tx.delete(sessions).where(eq(sessions.id, f.sessionId));
  });
  try {
    await Promise.race([locked.promise, blocker]);
    const pending = action().then(
      () => null,
      (error: unknown) => error,
    );
    try {
      await waitForBlocker(pid);
    } finally {
      release.resolve();
    }
    await blocker;
    return await pending;
  } finally {
    release.resolve();
    await blocker.catch(() => {});
  }
}

it("does not issue or audit a challenge when the session is revoked during the server lock", async () => {
  const f = await fixture();
  try {
    expect(await revokeWhileBlocked(f, () => f.issue(`aud_issue_${f.suffix}`))).toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(
      await db
        .select()
        .from(serverClaimChallenges)
        .where(eq(serverClaimChallenges.serverId, f.serverId)),
    ).toHaveLength(0);
    expect(
      await db.select().from(auditEvents).where(eq(auditEvents.actorId, f.actorId)),
    ).toHaveLength(0);
  } finally {
    await f.cleanup();
  }
});

it("does not issue a challenge when the initiating session expires while waiting", async () => {
  const f = await fixture();
  try {
    expect(
      await revokeWhileBlocked(f, () => f.issue(`aud_expired_${f.suffix}`), true),
    ).toMatchObject({ code: "UNAUTHORIZED" });
    expect(
      await db
        .select()
        .from(serverClaimChallenges)
        .where(eq(serverClaimChallenges.serverId, f.serverId)),
    ).toHaveLength(0);
    expect(
      await db.select().from(auditEvents).where(eq(auditEvents.actorId, f.actorId)),
    ).toHaveLength(0);
  } finally {
    await f.cleanup();
  }
});

it("does not consume proof or create verification and notifications when the session is revoked", async () => {
  const f = await fixture();
  try {
    const challenge = await f.issue(`aud_issue_${f.suffix}`);
    const [stored] = await db
      .select()
      .from(serverClaimChallenges)
      .where(eq(serverClaimChallenges.id, challenge.id));
    const verificationId = `ver_scs_${f.suffix}`;
    const failure = await revokeWhileBlocked(f, () =>
      serverClaimChallengeRepository.consumeVerifiedProof({
        id: challenge.id,
        serverId: f.serverId,
        requesterId: f.actorId,
        currentToken: f.token,
        token: challenge.token,
        expectedEndpoint: { ipAddress: challenge.server.ipAddress, port: challenge.server.port },
        sourceFetchedAt: new Date(stored.createdAt.getTime() + 1_000),
        verificationRequestId: verificationId,
        auditId: `aud_verify_${f.suffix}`,
      }),
    );
    expect(failure).toMatchObject({ code: "UNAUTHORIZED" });
    const [after] = await db
      .select()
      .from(serverClaimChallenges)
      .where(eq(serverClaimChallenges.id, challenge.id));
    expect(after.consumedAt).toBeNull();
    expect(
      await db
        .select()
        .from(verificationRequests)
        .where(eq(verificationRequests.id, verificationId)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(verificationNotificationDeliveries)
        .where(eq(verificationNotificationDeliveries.verificationRequestId, verificationId)),
    ).toHaveLength(0);
    expect(
      await db.select().from(auditEvents).where(eq(auditEvents.actorId, f.actorId)),
    ).toHaveLength(1);
  } finally {
    await f.cleanup();
  }
});
