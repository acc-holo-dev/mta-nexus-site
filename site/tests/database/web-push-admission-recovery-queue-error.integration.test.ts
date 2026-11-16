import { describe, expect, it } from "vitest";
import {
  db,
  eq,
  failInsert,
  fixture,
  freeCapacity,
  intent,
  jobs,
  notifications,
  pendingFixture,
  ready,
  recovery,
  setupWebPushAdmissionRecovery,
} from "../helpers/web-push-admission-recovery-harness";

setupWebPushAdmissionRecovery();

describe("web-push admission recovery: queue error and rollback", () => {
  it("keeps the inbox and retry evidence on queue error, then recovers after the cause is removed", async () => {
    const f = await fixture();
    const removeFailure = await failInsert("web_push_outbox", f.notificationId);
    expect(await f.create()).toMatchObject({
      pushQueueState: "error",
      pushJobs: 0,
      notification: { id: f.notificationId },
    });
    expect(await intent(f.notificationId)).toHaveLength(1);
    expect(await jobs(f.notificationId)).toEqual([]);
    await removeFailure();
    await ready(f.notificationId);
    expect(await recovery.processNext()).toEqual({ state: "completed", pushJobs: 1 });
  });

  it("rolls back source inbox creation when durable recovery evidence cannot be stored", async () => {
    const f = await fixture();
    await failInsert("web_push_outbox", f.notificationId);
    await failInsert("web_push_admission_recovery", f.notificationId);
    await expect(f.create()).rejects.toThrow();
    expect(
      await db.select().from(notifications).where(eq(notifications.id, f.notificationId)),
    ).toEqual([]);
    expect(await jobs(f.notificationId)).toEqual([]);
  });

  it("rolls back optional jobs when the admission proof cannot be consumed", async () => {
    const f = await pendingFixture();
    await freeCapacity();
    const removeFailure = await failInsert(
      "web_push_admission_recovery",
      f.notificationId,
      "delete",
    );
    expect(await recovery.processNext()).toEqual({ state: "retry", pushJobs: 0 });
    expect(await intent(f.notificationId)).toEqual([expect.objectContaining({ attempts: 1 })]);
    expect(await jobs(f.notificationId)).toEqual([]);
    await removeFailure();
    await ready(f.notificationId);
    expect(await recovery.processNext()).toEqual({ state: "completed", pushJobs: 2 });
  });
});
