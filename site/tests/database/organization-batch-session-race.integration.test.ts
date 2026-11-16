import { randomUUID } from "node:crypto";
import {
  db,
  sessionRepository,
  organizationWorkspaceRepository as teams,
  userRepository,
} from "@nexus/db";
import { eq, sql } from "drizzle-orm";
import { expect, it } from "vitest";
import {
  auditEvents,
  notifications,
  organizationMembers,
  organizations,
  sessions,
  users,
} from "../../packages/db/src/schema";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
it.each(["profile", "preview", "batch"] as const)(
  "rejects %s when the session is revoked while the organization is locked",
  async (action) => {
    const key = randomUUID().replaceAll("-", ""),
      ownerId = `usr_ots_${key}`,
      memberId = `usr_otm_${key}`,
      orgId = `org_ots_${key}`,
      sessionId = `ses_ots_${key}`,
      token = `tok_ots_${key}`,
      auditId = `aud_ots_${key}`;
    for (const id of [ownerId, memberId])
      await userRepository.create({
        id,
        username: id,
        email: `${id}@example.invalid`,
        displayName: "Team member",
      });
    const actorId = ownerId;
    await sessionRepository.create({
      id: sessionId,
      userId: actorId,
      token,
      expiresAt: new Date(Date.now() + 60000),
    });
    const [org] = await db
      .insert(organizations)
      .values({ id: orgId, ownerId, name: "Team", slug: `team-${key}` })
      .returning();
    await db.insert(organizationMembers).values({
      id: `mem_${key}`,
      organizationId: orgId,
      userId: memberId,
      role: "member",
      permissions: [],
    });
    const audit = {
      id: auditId,
      actorId,
      actorType: "user" as const,
      action: "organization.member_updated",
      targetType: "organization",
      targetId: orgId,
    };
    const batchInput = {
      userIds: [memberId],
      expectedUpdatedAt: org.updatedAt,
      change: { action: "role" as const, role: "developer" as const },
    };
    const preview = await teams.previewMembers(orgId, actorId, batchInput, token);
    const ready = deferred(),
      release = deferred();
    let pid = 0;
    const blocker = db.transaction(async (tx) => {
      const [row] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
      pid = Number(row.pid);
      await tx
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.id, orgId))
        .for("update");
      ready.resolve();
      await release.promise;
      await tx.delete(sessions).where(eq(sessions.id, sessionId));
    });
    try {
      await Promise.race([ready.promise, blocker]);
      const request = (
        action === "profile"
          ? teams.updateProfile(
              orgId,
              actorId,
              org.updatedAt,
              { name: "Changed", description: "", logoUrl: "", websiteUrl: "" },
              audit,
              token,
            )
          : action === "preview"
            ? teams.previewMembers(orgId, actorId, batchInput, token)
            : teams.batchMembers(
                orgId,
                actorId,
                { ...batchInput, previewRevision: preview.previewRevision },
                [audit],
                token,
              )
      ).then(
        () => null,
        (error: unknown) => error,
      );
      let blocked = false;
      const deadline = Date.now() + 3000;
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
      release.resolve();
      await blocker;
      expect(await request).toMatchObject({ code: "UNAUTHORIZED" });
      const member = await db
        .select()
        .from(organizationMembers)
        .where(eq(organizationMembers.organizationId, orgId));
      expect(member).toHaveLength(1);
      if (member[0]) expect(member[0].role).toBe("member");
      const [after] = await db.select().from(organizations).where(eq(organizations.id, orgId));
      expect(after.updatedAt.getTime()).toBe(org.updatedAt.getTime());
      expect(await db.select().from(auditEvents).where(eq(auditEvents.id, auditId))).toHaveLength(
        0,
      );
      expect(
        await db.select().from(notifications).where(eq(notifications.recipientId, memberId)),
      ).toHaveLength(0);
    } finally {
      release.resolve();
      await blocker.catch(() => {});
      await db.delete(organizations).where(eq(organizations.id, orgId));
      await db.delete(auditEvents).where(eq(auditEvents.actorId, actorId));
      for (const id of [ownerId, memberId]) await db.delete(users).where(eq(users.id, id));
    }
  },
  15000,
);
