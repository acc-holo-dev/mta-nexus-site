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
  sessionRepository,
  setNotificationPreferencesForTest,
  setupWebPushAdmissionRecovery,
  sql,
} from "../helpers/web-push-admission-recovery-harness";

setupWebPushAdmissionRecovery();

describe("web-push admission recovery: eligibility", () => {
  it.each(["read", "preference", "revoked session", "expired", "deleted"] as const)(
    "does not recover push after the notice is %s",
    async (reason) => {
      const f = await pendingFixture();
      if (reason === "read") await notificationRepository.markAsRead(f.notificationId, f.userId);
      if (reason === "preference")
        await setNotificationPreferencesForTest(f.userId, { systemEnabled: false });
      if (reason === "revoked session") await sessionRepository.deleteById(f.sessionId, f.userId);
      if (reason === "expired") {
        await db.execute(
          sql`update notifications set created_at=clock_timestamp()-interval '25 hours' where id=${f.notificationId}`,
        );
        await db.execute(
          sql`update web_push_admission_recovery set created_at=(select created_at from notifications where id=${f.notificationId}) where notification_id=${f.notificationId}`,
        );
      }
      if (reason === "deleted")
        await db.delete(notifications).where(eq(notifications.id, f.notificationId));
      await freeCapacity();
      await recovery.processNext();
      expect(await intent(f.notificationId)).toEqual([]);
      expect(await jobs(f.notificationId)).toEqual([]);
      if (reason === "read")
        expect(await notificationRepository.findById(f.notificationId)).toMatchObject({
          isRead: true,
        });
    },
  );
});
