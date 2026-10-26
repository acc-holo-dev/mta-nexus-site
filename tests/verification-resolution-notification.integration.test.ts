import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  db,
  notificationRepository,
  sessionRepository,
  userRepository,
  verificationRepository,
  webPushOutbox,
  webPushSubscriptionRepository,
} from "@nexus/db";

describe("verification resolution notifications", () => {
  it.each(["approved", "rejected"] as const)(
    "stores requester notification and push job atomically when a request is %s",
    async (decision) => {
      const suffix =
        `${decision}_${randomBytes(5).toString("hex")}`;
      const requesterId = `usr_verify_result_${suffix}`;
      const reviewerId = `usr_verify_result_mod_${suffix}`;
      const sessionId = `ses_verify_result_${suffix}`;
      const subscriptionId = `wps_verify_result_${suffix}`;

      await userRepository.create({
        id: requesterId,
        email: `verify_result_${suffix}@nexus.test`,
        username: `verify_result_${suffix}`,
        displayName: "Verification Result Requester",
        role: "user",
      });
      await userRepository.create({
        id: reviewerId,
        email: `verify_result_mod_${suffix}@nexus.test`,
        username: `verify_result_mod_${suffix}`,
        displayName: "Verification Result Moderator",
        role: "moderator",
      });
      await sessionRepository.create({
        id: sessionId,
        userId: requesterId,
        token: `verify-result-session-${suffix}`,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });
      const reviewerToken = `tok_${reviewerId}`;
      await sessionRepository.create({
        id: `ses_${reviewerId}`,
        userId: reviewerId,
        token: reviewerToken,
        expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      });
      await webPushSubscriptionRepository.upsert({
        id: subscriptionId,
        userId: requesterId,
        sessionId,
        endpoint:
          `https://push.example.invalid/verify-result-${suffix}`,
        p256dh: "verification-key",
        auth: "verification-auth",
        expirationAt: null,
      });

      const request = await verificationRepository.createRequest({
        requesterId,
        targetType: "user",
        targetId: requesterId,
        notes: "Verification result integration fixture.",
      });

      const resolved =
        await verificationRepository.resolveRequest({
          id: request.id,
          reviewerId,
          decision,
          currentToken: reviewerToken,
          reviewNotes: "Reviewed integration fixture.",
        });
      expect(resolved).toMatchObject({
        id: request.id,
        requesterId,
        status: decision,
      });

      const notificationId =
        `ntf_verification_resolution_${request.id}`;
      await expect(
        notificationRepository.findById(notificationId),
      ).resolves.toMatchObject({
        recipientId: requesterId,
        title:
          decision === "approved"
            ? "Verification approved"
            : "Verification rejected",
        type: "security",
        category: "security",
        isRead: false,
      });

      await expect(
        db
          .select()
          .from(webPushOutbox)
          .where(
            eq(
              webPushOutbox.notificationId,
              notificationId,
            ),
          ),
      ).resolves.toEqual([
        expect.objectContaining({
          subscriptionId,
          attempts: 0,
        }),
      ]);

      const replay =
        await verificationRepository.resolveRequest({
          id: request.id,
          reviewerId,
          decision,
          currentToken: reviewerToken,
          reviewNotes: "Replay must be a no-op.",
        });
      expect(replay).toBeNull();

      const inbox =
        await notificationRepository.listByUser(requesterId);
      expect(
        inbox.filter((item) => item.id === notificationId),
      ).toHaveLength(1);
      expect(
        await db
          .select()
          .from(webPushOutbox)
          .where(
            eq(
              webPushOutbox.notificationId,
              notificationId,
            ),
          ),
      ).toHaveLength(1);
    },
  );
});
