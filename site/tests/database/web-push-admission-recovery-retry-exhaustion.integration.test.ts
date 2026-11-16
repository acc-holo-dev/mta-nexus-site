import { describe, expect, it } from "vitest";
import {
  db,
  freeCapacity,
  intent,
  jobs,
  pendingFixture,
  ready,
  recovery,
  setupWebPushAdmissionRecovery,
  sql,
} from "../helpers/web-push-admission-recovery-harness";

setupWebPushAdmissionRecovery();

describe("web-push admission recovery: retry exhaustion", () => {
  it("bounds retries, exposes exhaustion, and expires terminal evidence without renewing delivery", async () => {
    const f = await pendingFixture();
    for (let attempt = 1; attempt <= 5; attempt++) {
      await ready(f.notificationId);
      expect(await recovery.processNext()).toMatchObject({
        state: attempt === 5 ? "failed" : "retry",
        pushJobs: 0,
      });
      expect(await intent(f.notificationId)).toEqual([
        expect.objectContaining({ attempts: attempt }),
      ]);
    }
    const stats = await recovery.stats();
    expect(stats.failed).toBeGreaterThanOrEqual(1);
    await ready(f.notificationId);
    await freeCapacity();
    await recovery.processNext();
    expect(await jobs(f.notificationId)).toEqual([]);
    await db.execute(
      sql`update notifications set created_at=clock_timestamp()-interval '25 hours' where id=${f.notificationId}`,
    );
    await db.execute(
      sql`update web_push_admission_recovery set created_at=(select created_at from notifications where id=${f.notificationId}) where notification_id=${f.notificationId}`,
    );
    await recovery.processNext();
    expect(await intent(f.notificationId)).toEqual([]);
    expect(await jobs(f.notificationId)).toEqual([]);
  });
});
