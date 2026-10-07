import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  db,
  organizations,
  organizationRepository,
  userRepository,
  notificationRepository,
  verificationRepository,
  verificationRequests,
} from "@nexus/db";

describe("verification stale target approval", () => {
  it("rolls back approval when an organization target disappeared", async () => {
    const suffix = `${Date.now().toString(36)}_${process.pid}`;
    const requesterId = `usr_verify_stale_${suffix}`;
    const reviewerId = `usr_verify_reviewer_${suffix}`;
    const organizationId = `org_verify_stale_${suffix}`;

    await userRepository.create({
      id: requesterId,
      email: `verify_stale_${suffix}@nexus.test`,
      username: `verify_stale_${suffix}`,
      displayName: "Verification Stale Requester",
      role: "user",
    });
    await userRepository.create({
      id: reviewerId,
      email: `verify_reviewer_${suffix}@nexus.test`,
      username: `verify_reviewer_${suffix}`,
      displayName: "Verification Reviewer",
      role: "moderator",
    });
    await organizationRepository.create({
      id: organizationId,
      name: "Stale Verification Organization",
      slug: `stale-verification-${suffix}`,
      ownerId: requesterId,
    });

    const request = await verificationRepository.createRequest({
      requesterId,
      targetType: "organization",
      targetId: organizationId,
      notes: "Target will be removed before moderation.",
    });

    await db
      .delete(organizations)
      .where(eq(organizations.id, organizationId));

    await expect(
      verificationRepository.resolveRequest({
        id: request.id,
        reviewerId,
        decision: "approved",
        reviewNotes: "Should fail closed.",
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "CONFLICT",
    });

    const [persisted] = await db
      .select()
      .from(verificationRequests)
      .where(eq(verificationRequests.id, request.id))
      .limit(1);

    expect(persisted?.status).toBe("pending");
    expect(persisted?.reviewerId).toBeFalsy();
    expect(persisted?.resolvedAt).toBeFalsy();
    expect(
      await notificationRepository.findById(
        `ntf_verification_resolution_${request.id}`,
      ),
    ).toBeNull();
  });
});
