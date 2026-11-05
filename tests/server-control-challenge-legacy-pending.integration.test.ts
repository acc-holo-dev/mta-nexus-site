import { db, serverRepository, verificationRepository, verificationRequests } from "@nexus/db";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  seedLegacyPendingClaim,
  setupServerControlChallenge,
} from "./helpers/server-control-challenge-harness";

setupServerControlChallenge();

describe("MTA server control challenge: legacy pending fail-closed", () => {
  it("fails closed when a legacy pending server request has no consumed control proof", async () => {
    const { reviewerId, reviewerToken, serverId, requestId } = await seedLegacyPendingClaim();

    await expect(
      verificationRepository.resolveRequest({
        id: requestId,
        reviewerId,
        decision: "approved",
        currentToken: reviewerToken,
        reviewNotes: "Must not approve without durable control proof.",
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "CONFLICT",
    });

    const [stillPending] = await db
      .select()
      .from(verificationRequests)
      .where(eq(verificationRequests.id, requestId))
      .limit(1);
    expect(stillPending?.status).toBe("pending");

    const afterFailedApproval = await serverRepository.findById(serverId);
    expect(afterFailedApproval?.ownerId).toBeFalsy();
    expect(afterFailedApproval?.isVerified).toBe(false);

    const rejected = await verificationRepository.resolveRequest({
      id: requestId,
      reviewerId,
      decision: "rejected",
      currentToken: reviewerToken,
      reviewNotes: "Re-submit through the live control challenge.",
    });
    expect(rejected?.status).toBe("rejected");

    const afterRejection = await serverRepository.findById(serverId);
    expect(afterRejection?.ownerId).toBeFalsy();
    expect(afterRejection?.isVerified).toBe(false);
  });
});
