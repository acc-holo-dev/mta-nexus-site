import { describe, expect, it } from "vitest";
import {
  db,
  deferred,
  eq,
  freeCapacity,
  inArray,
  intent,
  intents,
  jobs,
  notificationRepository,
  pendingFixture,
  ready,
  recovery,
  setupWebPushAdmissionRecovery,
  users,
} from "./helpers/web-push-admission-recovery-harness";

setupWebPushAdmissionRecovery();

describe("web-push admission recovery: lock skip", () => {
  it("continues past a locked recipient without consuming its retry or losing its intent", async () => {
    const first = await pendingFixture();
    const second = await pendingFixture();
    await db
      .update(intents)
      .set({ availableAt: new Date(-1000) })
      .where(eq(intents.notificationId, first.notificationId));
    await freeCapacity();
    const locked = deferred();
    const release = deferred();
    const blocker = db.transaction(async (tx) => {
      await tx.select().from(users).where(eq(users.id, first.userId)).for("update");
      locked.resolve();
      await release.promise;
    });
    try {
      await Promise.race([locked.promise, blocker]);
      expect(await recovery.processNext()).toEqual({ state: "completed", pushJobs: 2 });
      expect(await intent(first.notificationId)).toEqual([
        expect.objectContaining({ attempts: 0 }),
      ]);
      expect(await jobs(first.notificationId)).toEqual([]);
      expect(await intent(second.notificationId)).toEqual([]);
    } finally {
      release.resolve();
      await blocker;
    }
    await ready(first.notificationId);
    expect(await recovery.processNext()).toEqual({ state: "completed", pushJobs: 2 });
  });

  it("defers a full page for a locked account so another recipient can advance", async () => {
    const blocked = await pendingFixture();
    const blockedIds = [blocked.notificationId];
    for (let index = 1; index < 20; index++) {
      const id = `${blocked.notificationId}_${index}`;
      expect(
        await notificationRepository.createWithPushOutbox({ ...blocked.notice, id }),
      ).toMatchObject({ pushQueueState: "saturated" });
      blockedIds.push(id);
    }
    const runnable = await pendingFixture();
    await db
      .update(intents)
      .set({ availableAt: new Date(-1000) })
      .where(inArray(intents.notificationId, blockedIds));
    await freeCapacity();
    const locked = deferred();
    const release = deferred();
    const blocker = db.transaction(async (tx) => {
      await tx.select().from(users).where(eq(users.id, blocked.userId)).for("update");
      locked.resolve();
      await release.promise;
    });
    try {
      await Promise.race([locked.promise, blocker]);
      expect(await recovery.processNext()).toEqual({ state: "skipped", pushJobs: 0 });
      expect(await recovery.processNext()).toEqual({ state: "completed", pushJobs: 2 });
      expect(await jobs(runnable.notificationId)).toHaveLength(2);
      const pending = await db
        .select()
        .from(intents)
        .where(inArray(intents.notificationId, blockedIds));
      expect(pending).toHaveLength(20);
      expect(pending.every((row) => row.attempts === 0 && row.availableAt > new Date(0))).toBe(
        true,
      );
    } finally {
      release.resolve();
      await blocker;
    }
  });
});
