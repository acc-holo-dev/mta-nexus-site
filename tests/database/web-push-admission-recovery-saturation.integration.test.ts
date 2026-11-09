import { describe, expect, it } from "vitest";
import {
  db,
  eq,
  freeCapacity,
  intent,
  jobs,
  notificationRepository,
  notifications,
  pendingFixture,
  recovery,
  setupWebPushAdmissionRecovery,
  sql,
  WebPushAdmissionRecoveryRepository,
  webPushOutbox,
} from "../helpers/web-push-admission-recovery-harness";

setupWebPushAdmissionRecovery();

describe("web-push admission recovery: saturation", () => {
  it("recovers saturation across worker instances using only original devices and the original deadline", async () => {
    const f = await pendingFixture();
    const newDevice = `${f.subscriptionId}_later`;
    await f.subscribe(newDevice);
    await db.execute(
      sql`update web_push_subscriptions set created_at=(select created_at + interval '1 second' from notifications where id=${f.notificationId}) where id=${newDevice}`,
    );
    await freeCapacity();
    expect(await new WebPushAdmissionRecoveryRepository().processNext()).toEqual({
      state: "completed",
      pushJobs: 2,
    });
    expect(await intent(f.notificationId)).toEqual([]);
    expect((await jobs(f.notificationId)).map((row) => row.subscriptionId).sort()).toEqual(
      [f.subscriptionId, `${f.subscriptionId}_second`].sort(),
    );
    const proof = await db.execute(
      sql`select bool_and(o.expires_at=n.created_at + interval '24 hours') as original_deadline from web_push_outbox o join notifications n on n.id=o.notification_id where n.id=${f.notificationId}`,
    );
    expect(proof[0].original_deadline).toBe(true);
    // Simulate acceptance/cleanup by the sender. Absence of a pending intent must
    // prevent another admission even when outbox deduplication rows are gone.
    await db.delete(webPushOutbox).where(eq(webPushOutbox.notificationId, f.notificationId));
    await db.transaction((tx) =>
      notificationRepository.createWithPushOutboxWithin(tx, f.notice, true),
    );
    await recovery.processNext();
    expect(await intent(f.notificationId)).toEqual([]);
    expect(await jobs(f.notificationId)).toEqual([]);
  });

  it("serializes concurrent recovery without duplicate jobs or inbox rows", async () => {
    const f = await pendingFixture();
    await freeCapacity();
    const results = await Promise.all([
      recovery.processNext(),
      new WebPushAdmissionRecoveryRepository().processNext(),
    ]);
    expect(results.reduce((sum, value) => sum + value.pushJobs, 0)).toBe(2);
    expect(await jobs(f.notificationId)).toHaveLength(2);
    expect(await intent(f.notificationId)).toEqual([]);
    expect(
      await db.select().from(notifications).where(eq(notifications.id, f.notificationId)),
    ).toHaveLength(1);
  });
});
