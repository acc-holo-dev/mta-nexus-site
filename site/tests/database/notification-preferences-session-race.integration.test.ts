import { randomUUID } from "node:crypto";
import {
  db,
  notificationPreferences,
  notificationRepository,
  sessionRepository,
  userRepository,
  users,
} from "@nexus/db";
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
  throw new Error("Preference update did not reach the held lock");
}

it.each(["revoked", "expired"] as const)(
  "rolls back notification preferences when the session is %s during a lock wait",
  async (kind) => {
    const key = randomUUID().replaceAll("-", ""),
      userId = `usr_pref_${key}`,
      token = `tok_${key}`;
    const locked = deferred(),
      release = deferred();
    let blocker: Promise<void> | undefined, pending: Promise<unknown> | undefined;
    try {
      await userRepository.create({
        id: userId,
        email: `${key}@nexus.test`,
        username: `pref_${key}`,
        displayName: "Preference fixture",
        role: "user",
      });
      await db
        .insert(notificationPreferences)
        .values({ id: `npr_${key}`, userId, followsEnabled: true });
      const expiresAt = new Date(Date.now() + (kind === "expired" ? 2_000 : 60_000));
      await sessionRepository.create({ id: `ses_${key}`, userId, token, expiresAt });
      let pid = 0;
      blocker = db.transaction(async (tx) => {
        const [row] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
        pid = Number(row.pid);
        if (kind === "revoked")
          await tx.execute(
            sql`select pg_advisory_xact_lock(hashtextextended(${`nexus:notification-preference:v1:${userId}`}, 0))`,
          );
        else
          await tx
            .select({ userId: notificationPreferences.userId })
            .from(notificationPreferences)
            .where(eq(notificationPreferences.userId, userId))
            .for("update");
        locked.resolve();
        await release.promise;
      });
      await Promise.race([locked.promise, blocker]);
      pending = notificationRepository
        .updatePreferences(userId, { followsEnabled: false }, token)
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
      expect(await notificationRepository.getPreferences(userId)).toMatchObject({
        followsEnabled: true,
      });
    } finally {
      release.resolve();
      await blocker?.catch(() => {});
      await pending?.catch(() => {});
      await db.delete(users).where(eq(users.id, userId));
    }
  },
);
