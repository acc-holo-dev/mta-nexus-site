import { describe, expect, it } from "vitest";
import {
  notificationRepository,
  userRepository,
  verificationRepository,
} from "@nexus/db";

describe("verification resolution notifications", () => {
  it.each(["approved", "rejected"] as const)(
    "stores requester notification atomically when a request is %s",
    async (decision) => {
      const suffix = `${decision}_${Date.now().toString(36)}_${process.pid}`;
      const requesterId = `usr_verify_result_${suffix}`;
      const reviewerId = `usr_verify_result_mod_${suffix}`;

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

      const request = await verificationRepository.createRequest({
        requesterId,
        targetType: "user",
        targetId: requesterId,
        notes: "Verification result integration fixture.",
      });

      const resolved = await verificationRepository.resolveRequest({
        id: request.id,
        reviewerId,
        decision,
        reviewNotes: "Reviewed integration fixture.",
      });
      expect(resolved).toMatchObject({
        id: request.id,
        requesterId,
        status: decision,
      });

      await expect(
        notificationRepository.findById(
          `ntf_verification_resolution_${request.id}`,
        ),
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

      const replay = await verificationRepository.resolveRequest({
        id: request.id,
        reviewerId,
        decision,
        reviewNotes: "Replay must be a no-op.",
      });
      expect(replay).toBeNull();

      const inbox = await notificationRepository.listByUser(requesterId);
      expect(
        inbox.filter(
          (item) =>
            item.id ===
            `ntf_verification_resolution_${request.id}`,
        ),
      ).toHaveLength(1);
    },
  );
});
