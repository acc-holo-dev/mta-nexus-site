import { randomUUID } from "node:crypto";
import {
  db,
  organizationContentRepository,
  serverContentRepository,
  sessionRepository,
  userRepository,
} from "@nexus/db";
import { eq, sql } from "drizzle-orm";
import { expect, it } from "vitest";
import {
  auditEvents,
  content,
  organizations,
  servers,
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

async function waitForBlocker(pid: number) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const [row] = await db.execute<{ blocked: boolean }>(
      sql`select exists (select 1 from pg_stat_activity where datname=current_database() and ${pid} = any(pg_blocking_pids(pid))) as blocked`,
    );
    if (row?.blocked) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Content creation did not wait on the locked parent");
}

it.each(["organization", "server"] as const)(
  "rejects %s creation when the session is revoked while awaiting the parent",
  async (scope) => {
    const key = randomUUID().replaceAll("-", "");
    const actorId = `usr_scope_${key}`,
      parentId = `${scope === "server" ? "srv" : "org"}_scope_${key}`,
      token = `tok_scope_${key}`,
      sessionId = `ses_scope_${key}`,
      contentId = `cnt_scope_${key}`;
    const locked = deferred(),
      release = deferred();
    let blocker: Promise<void> | undefined;
    try {
      await userRepository.create({
        id: actorId,
        username: `scope_${key}`,
        email: `${key}@nexus.test`,
        displayName: "Scope fixture",
        role: "user",
      });
      if (scope === "organization")
        await db
          .insert(organizations)
          .values({ id: parentId, ownerId: actorId, name: "Fixture", slug: parentId });
      else
        await db
          .insert(servers)
          .values({
            id: parentId,
            ownerId: actorId,
            name: "Fixture",
            slug: parentId,
            ipAddress: `${key}.example.invalid`,
          });
      await sessionRepository.create({
        id: sessionId,
        userId: actorId,
        token,
        expiresAt: new Date(Date.now() + 60_000),
      });
      let pid = 0;
      blocker = db.transaction(async (tx) => {
        const [result] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
        pid = Number(result.pid);
        if (scope === "organization")
          await tx
            .select({ id: organizations.id })
            .from(organizations)
            .where(eq(organizations.id, parentId))
            .for("update");
        else
          await tx
            .select({ id: servers.id })
            .from(servers)
            .where(eq(servers.id, parentId))
            .for("update");
        locked.resolve();
        await release.promise;
        await tx.delete(sessions).where(eq(sessions.id, sessionId));
      });
      await Promise.race([locked.promise, blocker]);
      const data = {
        id: contentId,
        slug: contentId,
        title: "Title",
        body: "Publication body",
        type: "article" as const,
        status: "draft" as const,
        authorId: actorId,
        tags: [],
        viewCount: 0,
        likeCount: 0,
        commentCount: 0,
      };
      const audit = {
        id: `aud_scope_${key}`,
        actorId,
        actorType: "user" as const,
        action: "content.created",
        targetId: contentId,
        targetType: "content",
      };
      const pending = (
        scope === "organization"
          ? organizationContentRepository.create(parentId, actorId, data, audit, token)
          : serverContentRepository.create(parentId, actorId, data, audit, token)
      ).then(
        () => null,
        (error: unknown) => error,
      );
      try {
        await waitForBlocker(pid);
      } finally {
        release.resolve();
      }
      await blocker;
      expect(await pending).toMatchObject({ code: "UNAUTHORIZED" });
      expect(await db.select().from(content).where(eq(content.id, contentId))).toHaveLength(0);
      expect(
        await db.select().from(auditEvents).where(eq(auditEvents.actorId, actorId)),
      ).toHaveLength(0);
    } finally {
      release.resolve();
      await blocker?.catch(() => {});
      await db.delete(auditEvents).where(eq(auditEvents.actorId, actorId));
      await db.delete(content).where(eq(content.id, contentId));
      await db.delete(sessions).where(eq(sessions.id, sessionId));
      if (scope === "organization")
        await db.delete(organizations).where(eq(organizations.id, parentId));
      else await db.delete(servers).where(eq(servers.id, parentId));
      await db.delete(users).where(eq(users.id, actorId));
    }
  },
);
