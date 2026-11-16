import { randomUUID } from "node:crypto";
import { auditEvents, db, sessionRepository, userRepository, users } from "@nexus/db";
import { eq, sql } from "drizzle-orm";
import { expect, it } from "vitest";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function waitForBlocker(pid: number) {
  const deadline = Date.now() + 4_000;
  while (Date.now() < deadline) {
    const [row] = await db.execute<{ blocked: boolean }>(
      sql`select exists (select 1 from pg_stat_activity where datname=current_database() and ${pid} = any(pg_blocking_pids(pid))) as blocked`,
    );
    if (row?.blocked) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Profile update did not wait for the fixture lock");
}

it.each(["revoked", "expired"] as const)(
  "rolls back profile and audit when the initiating session is %s while waiting",
  async (kind) => {
    const key = randomUUID().replaceAll("-", ""),
      id = `usr_prof_${key}`,
      token = `tok_${key}`,
      auditId = `aud_${key}`;
    const locked = deferred(),
      release = deferred();
    let blocker: Promise<void> | undefined, pending: Promise<unknown> | undefined;
    try {
      const actor = await userRepository.create({
        id,
        email: `${key}@nexus.test`,
        username: `prof_${key}`,
        displayName: "Original",
        role: "user",
      });
      const expiresAt = new Date(Date.now() + (kind === "expired" ? 2_000 : 60_000));
      await sessionRepository.create({ id: `ses_${key}`, userId: id, token, expiresAt });
      let pid = 0;
      blocker = db
        .transaction(async (tx) => {
          const [row] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
          pid = Number(row.pid);
          if (kind === "revoked")
            await tx.select({ id: users.id }).from(users).where(eq(users.id, id)).for("update");
          else
            await tx.insert(auditEvents).values({
              id: auditId,
              actorId: id,
              actorType: "user",
              action: "fixture.block",
              targetId: id,
              targetType: "fixture",
            });
          locked.resolve();
          await release.promise;
          throw new Error("rollback fixture lock");
        })
        .catch((error) => {
          if (!(error instanceof Error) || error.message !== "rollback fixture lock") throw error;
        });
      await Promise.race([locked.promise, blocker]);
      pending = userRepository
        .updatePublicProfile(
          id,
          actor.updatedAt,
          { displayName: "Changed", bio: "Draft", avatarUrl: "" },
          auditId,
          token,
        )
        .then(
          () => null,
          (error: unknown) => error,
        );
      try {
        await waitForBlocker(pid);
        if (kind === "revoked") await sessionRepository.delete(token);
        else
          await new Promise((resolve) =>
            setTimeout(resolve, Math.max(0, expiresAt.getTime() - Date.now() + 100)),
          );
      } finally {
        release.resolve();
      }
      await blocker;
      expect(await pending).toMatchObject({ code: "UNAUTHORIZED" });
      expect((await userRepository.findById(id))?.displayName).toBe("Original");
      expect(await db.select().from(auditEvents).where(eq(auditEvents.actorId, id))).toHaveLength(
        0,
      );
    } finally {
      release.resolve();
      await blocker?.catch(() => {});
      await pending?.catch(() => {});
      await db.delete(auditEvents).where(eq(auditEvents.actorId, id));
      await db.delete(users).where(eq(users.id, id));
    }
  },
);
