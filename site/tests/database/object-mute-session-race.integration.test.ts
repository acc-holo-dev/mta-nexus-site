import { randomUUID } from "node:crypto";
import { db, followWorkspaceRepository, sessionRepository, userRepository } from "@nexus/db";
import { and, eq, sql } from "drizzle-orm";
import { expect, it } from "vitest";
import { objectNotificationMutes, users } from "../../packages/db/src/schema";

it.each(["24h", null] as const)(
  "rejects mute %s after revocation during lock wait",
  async (duration) => {
    const suffix = randomUUID().replaceAll("-", "");
    const actor = `usr_mute_${suffix}`,
      target = `cnt_${suffix}`,
      token = `token_${suffix}`;
    await userRepository.create({
      id: actor,
      username: `mute_${suffix}`,
      email: `${suffix}@nexus.test`,
      displayName: "Mute",
    });
    await sessionRepository.create({
      id: `ses_${suffix}`,
      userId: actor,
      token,
      expiresAt: new Date("2099-01-01"),
    });
    if (duration === null)
      await followWorkspaceRepository.setObjectMute(
        actor,
        "content",
        target,
        "24h",
        `omi_${suffix}`,
        token,
      );
    let release!: () => void, ready!: () => void;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    const locked = new Promise<void>((resolve) => {
      ready = resolve;
    });
    let pid = 0;
    const blocker = db.transaction(async (tx) => {
      const [row] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
      pid = Number(row.pid);
      const key = JSON.stringify(["mute", actor, "content", target]);
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
      ready();
      await released;
    });
    try {
      await Promise.race([locked, blocker]);
      const result = followWorkspaceRepository
        .setObjectMute(actor, "content", target, duration, `omi_new_${suffix}`, token)
        .then(
          () => null,
          (error: unknown) => error,
        );
      const deadline = Date.now() + 3000;
      let blocked = false;
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
      await sessionRepository.delete(token);
      release();
      await blocker;
      expect(await result).toMatchObject({ code: "UNAUTHORIZED" });
      const rows = await db
        .select()
        .from(objectNotificationMutes)
        .where(
          and(
            eq(objectNotificationMutes.userId, actor),
            eq(objectNotificationMutes.targetId, target),
          ),
        );
      expect(rows).toHaveLength(duration === null ? 1 : 0);
    } finally {
      release();
      await blocker.catch(() => {});
      await db.delete(users).where(eq(users.id, actor));
    }
  },
  15000,
);
