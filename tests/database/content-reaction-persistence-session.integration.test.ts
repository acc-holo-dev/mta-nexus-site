import { randomUUID } from "node:crypto";
import {
  db,
  publicUserTrustRepository,
  contentReactionsRepository as repository,
  sessionRepository,
  sessions,
} from "@nexus/db";
import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  auditEvents,
  content,
  developerProfiles,
  notifications,
  organizations,
  servers,
  userProfilePreferences,
  users,
  verificationRequests,
} from "../../site/packages/db/src/schema";
import {
  actor,
  command,
  deferred,
  ownRows,
  publication,
  trackOrganization,
  trackServer,
} from "../helpers/content-reaction-persistence-harness";

describe("content reaction persistence: session authority and public trust", () => {
  it("gates trust by live role/flags/ownership and excludes private activity, evidence and nonpublic servers", async () => {
    const author = await actor();
    await db
      .update(users)
      .set({ role: "developer", isVerified: true })
      .where(eq(users.id, author.id));
    await db
      .insert(developerProfiles)
      .values({ id: randomUUID(), userId: author.id, verifiedDeveloper: true });
    await db.insert(userProfilePreferences).values({ userId: author.id, showActivity: false });
    await publication(author.id);
    await db.insert(verificationRequests).values({
      id: randomUUID(),
      requesterId: author.id,
      targetType: "developer",
      targetId: author.id,
      status: "approved",
      proofUrl: "https://private.test/proof",
      reviewNotes: "private",
      resolvedAt: new Date(),
    });
    for (const visibility of ["public", "private"]) {
      const id = randomUUID();
      trackServer(id);
      await db.insert(servers).values({
        id,
        slug: `trust-${id}`,
        name: "Server",
        ipAddress: `${id}.test`,
        ownerId: author.id,
        visibility,
        isVerified: true,
      });
    }
    const orgId = randomUUID();
    trackOrganization(orgId);
    await db.insert(organizations).values({
      id: orgId,
      slug: `trust-${orgId}`,
      name: "Team",
      ownerId: author.id,
      isVerified: true,
    });
    expect(await publicUserTrustRepository.find(author.username)).toMatchObject({
      developerVerified: true,
      servers: 1,
      verifiedServers: 1,
      organizations: 1,
      verifiedOrganizations: 1,
      publications: null,
    });
    await db.update(users).set({ role: "user", isVerified: false }).where(eq(users.id, author.id));
    const row = await publicUserTrustRepository.find(author.username);
    expect(row).toMatchObject({
      identityVerified: false,
      identityApprovalAt: null,
      developerVerified: false,
      developerApprovalAt: null,
    });
    expect(JSON.stringify(row)).not.toContain("private.test");
    expect(row).not.toHaveProperty("reviewNotes");
  });

  it("rolls back reaction, count, audit and notice when the initiating session expires during an audit write", async () => {
    const author = await actor(),
      reader = await actor(),
      item = await publication(author.id),
      input = command(reader.id, item.slug, "helpful"),
      expiresAt = new Date(Date.now() + 2000),
      locked = deferred(),
      release = deferred();
    await db.update(sessions).set({ expiresAt }).where(eq(sessions.userId, reader.id));
    let blockerPid = 0;
    const blocker = db
      .transaction(async (tx) => {
        await tx.insert(auditEvents).values({
          id: input.auditId,
          actorId: reader.id,
          actorType: "user",
          targetType: "content",
          targetId: item.id,
          action: "fixture.collision",
          details: {},
        });
        const [row] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
        blockerPid = row.pid;
        locked.resolve();
        await release.promise;
        throw new Error("rollback fixture blocker");
      })
      .catch((error: unknown) => {
        if (!(error instanceof Error) || error.message !== "rollback fixture blocker") throw error;
      });
    await Promise.race([
      locked.promise,
      blocker.then(() => {
        throw new Error("Blocker exited before locking");
      }),
    ]);
    const pending = repository.set(input).then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );
    try {
      await expect
        .poll(
          async () => {
            const [row] = await db.execute<{ waiting: boolean }>(sql`select exists(
        select 1 from pg_stat_activity where datname=current_database()
        and ${blockerPid}=any(pg_blocking_pids(pid)) and wait_event_type='Lock'
      ) as waiting`);
            return row.waiting;
          },
          { timeout: 5000, interval: 10 },
        )
        .toBe(true);
      await expect
        .poll(
          async () => {
            const [row] = await db.execute<{ expired: boolean }>(
              sql`select clock_timestamp()>=${expiresAt}::timestamptz as expired`,
            );
            return row.expired;
          },
          { timeout: 5000, interval: 10 },
        )
        .toBe(true);
    } finally {
      release.resolve();
      await blocker;
    }
    expect(await pending).toMatchObject({ error: { code: "UNAUTHORIZED" } });
    expect(await ownRows(reader.id, item.id)).toHaveLength(0);
    expect(
      await db.select().from(auditEvents).where(eq(auditEvents.targetId, item.id)),
    ).toHaveLength(0);
    expect(
      await db.select().from(notifications).where(eq(notifications.recipientId, author.id)),
    ).toHaveLength(0);
    const [saved] = await db.select().from(content).where(eq(content.id, item.id));
    expect(saved.likeCount).toBe(0);
  }, 15000);

  it("rejects a revoked initiating session for desired-state replay and empty cleanup", async () => {
    const author = await actor(),
      reader = await actor(),
      item = await publication(author.id);
    const input = command(reader.id, item.slug, "helpful");
    await repository.set(input);
    await sessionRepository.delete(input.currentToken);
    await expect(repository.set(input)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      repository.set({
        ...input,
        slug: undefined,
        contentId: `missing_${randomUUID()}`,
        reaction: null,
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(await ownRows(reader.id, item.id)).toHaveLength(1);
  });

  it("rejects revocation while waiting for the publication lock", async () => {
    const author = await actor(),
      reader = await actor(),
      item = await publication(author.id),
      input = command(reader.id, item.slug, "helpful"),
      locked = deferred(),
      release = deferred();
    let blockerPid = 0;
    const blocker = db.transaction(async (tx) => {
      await tx.select().from(content).where(eq(content.id, item.id)).for("update");
      const [row] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
      blockerPid = row.pid;
      locked.resolve();
      await release.promise;
    });
    await Promise.race([
      locked.promise,
      blocker.then(() => {
        throw new Error("Blocker exited before locking");
      }),
    ]);
    const pending = repository.set(input).then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );
    try {
      await expect
        .poll(
          async () => {
            const [row] = await db.execute<{ waiting: boolean }>(sql`select exists(
        select 1 from pg_stat_activity where datname=current_database()
        and ${blockerPid}=any(pg_blocking_pids(pid)) and wait_event_type='Lock'
      ) as waiting`);
            return row.waiting;
          },
          { timeout: 5000, interval: 10 },
        )
        .toBe(true);
      await sessionRepository.delete(input.currentToken);
    } finally {
      release.resolve();
      await blocker;
    }
    expect(await pending).toMatchObject({ error: { code: "UNAUTHORIZED" } });
    expect(await ownRows(reader.id, item.id)).toHaveLength(0);
    expect(
      await db.select().from(auditEvents).where(eq(auditEvents.targetId, item.id)),
    ).toHaveLength(0);
    expect(
      await db.select().from(notifications).where(eq(notifications.recipientId, author.id)),
    ).toHaveLength(0);
  }, 15000);
});
