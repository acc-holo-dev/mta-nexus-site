import { randomUUID } from "node:crypto";
import { db, sessionRepository, userRepository, webPushSubscriptionRepository } from "@nexus/db";
import { eq, sql } from "drizzle-orm";
import { expect, it } from "vitest";
import { digestSessionToken } from "../../site/packages/db/src/repositories/sessions";
import { sessions, users, webPushSubscriptions } from "../../site/packages/db/src/schema";

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
      select 1 from pg_stat_activity where datname = current_database()
        and ${pid} = any(pg_blocking_pids(pid))
    ) as blocked`);
    if (row?.blocked) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Web Push write did not reach the lock");
}

async function fixture(expiresAt = new Date(Date.now() + 60_000)) {
  const key = randomUUID().replaceAll("-", "");
  const userId = `usr_push_auth_${key}`;
  const sessionId = `ses_push_auth_${key}`;
  const token = `push-auth-token-${key}`;
  const input = {
    id: `wps_auth_${key}`,
    userId,
    sessionId,
    endpoint: `https://push.example.invalid/${key}`,
    p256dh: "original",
    auth: "secret",
    expirationAt: null,
  };
  await userRepository.create({
    id: userId,
    email: `${key}@example.invalid`,
    username: `push_${key}`,
    displayName: "Push",
  });
  await sessionRepository.create({ id: sessionId, userId, token, expiresAt });
  await webPushSubscriptionRepository.upsert(input);
  return {
    userId,
    sessionId,
    token,
    input,
    cleanup: () => db.delete(users).where(eq(users.id, userId)),
  };
}

it.each(["upsert", "remove"] as const)(
  "rejects %s after the initiating token rotates while waiting",
  async (action) => {
    const f = await fixture();
    const locked = deferred(),
      release = deferred();
    let blocker: Promise<void> | undefined;
    try {
      let pid = 0;
      blocker = db.transaction(async (tx) => {
        const [row] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
        pid = Number(row.pid);
        await tx
          .select({ id: sessions.id })
          .from(sessions)
          .where(eq(sessions.id, f.sessionId))
          .for("update");
        locked.resolve();
        await release.promise;
        await tx
          .update(sessions)
          .set({ token: digestSessionToken(`${f.token}-rotated`) })
          .where(eq(sessions.id, f.sessionId));
      });
      await Promise.race([locked.promise, blocker]);
      const pending = (
        action === "upsert"
          ? webPushSubscriptionRepository.upsertAuthenticated(
              { ...f.input, p256dh: "changed" },
              f.token,
            )
          : webPushSubscriptionRepository.removeAuthenticated(
              f.userId,
              f.sessionId,
              f.token,
              f.input.endpoint,
            )
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
      const rows = await db
        .select()
        .from(webPushSubscriptions)
        .where(eq(webPushSubscriptions.id, f.input.id));
      expect(rows).toHaveLength(1);
      expect(rows[0].p256dh).toBe("original");
    } finally {
      release.resolve();
      await blocker?.catch(() => {});
      await f.cleanup();
    }
  },
);

it.each(["upsert", "remove"] as const)(
  "rejects %s after session revocation while waiting",
  async (action) => {
    const f = await fixture();
    const locked = deferred(),
      release = deferred();
    let blocker: Promise<void> | undefined;
    try {
      let pid = 0;
      blocker = db.transaction(async (tx) => {
        const [row] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
        pid = Number(row.pid);
        await tx
          .select({ id: sessions.id })
          .from(sessions)
          .where(eq(sessions.id, f.sessionId))
          .for("update");
        locked.resolve();
        await release.promise;
        await tx.delete(sessions).where(eq(sessions.id, f.sessionId));
      });
      await Promise.race([locked.promise, blocker]);
      const pending = (
        action === "upsert"
          ? webPushSubscriptionRepository.upsertAuthenticated(
              { ...f.input, p256dh: "changed" },
              f.token,
            )
          : webPushSubscriptionRepository.removeAuthenticated(
              f.userId,
              f.sessionId,
              f.token,
              f.input.endpoint,
            )
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
      // Revoking the session cascades its pre-existing subscription.
      expect(
        await db.select().from(webPushSubscriptions).where(eq(webPushSubscriptions.id, f.input.id)),
      ).toHaveLength(0);
    } finally {
      release.resolve();
      await blocker?.catch(() => {});
      await f.cleanup();
    }
  },
);

it.each(["upsert", "remove"] as const)(
  "rolls back %s when the session expires during a later write wait",
  async (action) => {
    const f = await fixture();
    const expiresAt = new Date(Date.now() + 5_000);
    await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, f.sessionId));
    const locked = deferred(),
      release = deferred();
    let blocker: Promise<void> | undefined;
    try {
      let pid = 0;
      blocker = db.transaction(async (tx) => {
        const [row] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
        pid = Number(row.pid);
        await tx
          .select({ id: webPushSubscriptions.id })
          .from(webPushSubscriptions)
          .where(eq(webPushSubscriptions.id, f.input.id))
          .for("update");
        locked.resolve();
        await release.promise;
      });
      await Promise.race([locked.promise, blocker]);
      const pending = (
        action === "upsert"
          ? webPushSubscriptionRepository.upsertAuthenticated(
              { ...f.input, p256dh: "changed" },
              f.token,
            )
          : webPushSubscriptionRepository.removeAuthenticated(
              f.userId,
              f.sessionId,
              f.token,
              f.input.endpoint,
            )
      ).then(
        () => null,
        (error: unknown) => error,
      );
      try {
        await waitForBlocker(pid);
        const remaining = expiresAt.getTime() - Date.now();
        if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining + 30));
      } finally {
        release.resolve();
      }
      await blocker;
      expect(await pending).toMatchObject({ code: "UNAUTHORIZED" });
      const rows = await db
        .select()
        .from(webPushSubscriptions)
        .where(eq(webPushSubscriptions.id, f.input.id));
      expect(rows).toHaveLength(1);
      expect(rows[0].p256dh).toBe("original");
    } finally {
      release.resolve();
      await blocker?.catch(() => {});
      await f.cleanup();
    }
  },
  25_000,
);
