import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";

const directoryState = vi.hoisted(() => ({
  current: {
    fetchedAt: "2026-09-25T12:00:00.000Z",
    isStale: false,
    servers: [] as Array<{
      address: string;
      port: number;
      name?: string;
      responding?: boolean;
    }>,
  },
}));

vi.mock(
  "../apps/web/src/lib/services/mta-master-directory-service",
  () => ({
    mtaMasterDirectoryService: {
      getDirectory: vi.fn(async () => directoryState.current),
    },
    matchesMtaEndpoint: (
      server: { ipAddress: string; port: number },
      observed: { address: string; port: number },
    ) =>
      server.ipAddress.toLowerCase().replace(/\.$/u, "") ===
        observed.address.toLowerCase().replace(/\.$/u, "") &&
      server.port === observed.port,
  }),
);

import {
  db,
  serverClaimChallenges,
  serverRepository,
  sessionRepository,
  userRepository,
  verificationRepository,
  verificationRequests,
} from "@nexus/db";
import { POST as issueChallenge } from "../apps/web/src/app/api/servers/[id]/claim-challenge/route";
import { POST as verifyChallenge } from "../apps/web/src/app/api/servers/[id]/claim-challenge/verify/route";
import { POST as genericVerification } from "../apps/web/src/app/api/verification/route";
import { POST as adminAction } from "../apps/web/src/app/api/admin/actions/route";

function post(
  url: string,
  token: string,
  body?: Record<string, unknown>,
) {
  return new NextRequest(url, {
    method: "POST",
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      cookie: `nexus_session=${token}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

describe("MTA server control challenge integration", () => {
  it("requires a fresh live name token and creates exactly one moderation request", async () => {
    const suffix = `${Date.now().toString(36)}_${process.pid}`;
    const userId = `usr_control_${suffix}`;
    const attackerId = `usr_control_attacker_${suffix}`;
    const moderatorId = `usr_control_moderator_${suffix}`;
    const sessionToken = `tok_control_${suffix}`;
    const attackerToken = `tok_control_attacker_${suffix}`;
    const moderatorToken = `tok_control_moderator_${suffix}`;
    const serverId = `srv_control_${suffix}`;
    const address = "198.51.100.211";
    const port = 18_000 + ((Date.now() + process.pid) % 30_000);

    await userRepository.create({
      id: userId,
      email: `server_control_${suffix}@nexus.test`,
      username: `server_control_${suffix}`,
      displayName: "Server Control Claimant",
      role: "user",
    });
    await sessionRepository.create({
      id: `ses_control_${suffix}`,
      userId,
      token: sessionToken,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    await userRepository.create({
      id: attackerId,
      email: `server_control_attacker_${suffix}@nexus.test`,
      username: `server_control_attacker_${suffix}`,
      displayName: "Server Control Attacker",
      role: "user",
    });
    await sessionRepository.create({
      id: `ses_control_attacker_${suffix}`,
      userId: attackerId,
      token: attackerToken,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    await userRepository.create({
      id: moderatorId,
      email: `server_control_moderator_${suffix}@nexus.test`,
      username: `server_control_moderator_${suffix}`,
      displayName: "Server Control Moderator",
      role: "moderator",
    });
    await sessionRepository.create({
      id: `ses_control_moderator_${suffix}`,
      userId: moderatorId,
      token: moderatorToken,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    await serverRepository.create({
      id: serverId,
      name: "Control Challenge Server",
      slug: `control-challenge-${suffix}`,
      ipAddress: address,
      port,
      status: "active",
      visibility: "public",
      isVerified: false,
      gameplayTags: [],
      mediaUrls: [],
    });

    const issued = await issueChallenge(
      post(
        `http://nexus.test/api/servers/${serverId}/claim-challenge`,
        sessionToken,
      ),
      { params: Promise.resolve({ id: serverId }) },
    );

    expect(issued.status).toBe(201);
    expect(issued.headers.get("Cache-Control")).toBe("private, no-store");
    expect(issued.headers.get("Vary")).toBe("Cookie");
    const issuedBody = await issued.json();
    expect(issuedBody.challenge.token).toMatch(
      /^NXCLAIM-[A-F0-9]{24}$/u,
    );
    const challengeId = issuedBody.challenge.challengeId as string;
    const controlToken = issuedBody.challenge.token as string;

    const [storedChallenge] = await db
      .select()
      .from(serverClaimChallenges)
      .where(eq(serverClaimChallenges.id, challengeId))
      .limit(1);
    expect(storedChallenge).toBeTruthy();
    expect(storedChallenge?.tokenDigest).toMatch(/^[0-9a-f]{64}$/u);
    expect(storedChallenge?.tokenDigest).not.toBe(controlToken);
    expect(JSON.stringify(storedChallenge)).not.toContain(controlToken);

    directoryState.current = {
      fetchedAt: new Date(Date.now() + 4_000).toISOString(),
      isStale: false,
      servers: [
        {
          address,
          port,
          name: `Control Challenge Server ${controlToken}`,
          responding: true,
        },
      ],
    };
    const stolenToken = await verifyChallenge(
      post(
        `http://nexus.test/api/servers/${serverId}/claim-challenge/verify`,
        attackerToken,
        { challengeId, token: controlToken },
      ),
      { params: Promise.resolve({ id: serverId }) },
    );
    expect(stolenToken.status).toBe(400);
    expect(await stolenToken.json()).toMatchObject({
      code: "INVALID_SERVER_CONTROL_CHALLENGE",
    });

    const bypass = await genericVerification(
      post(
        "http://nexus.test/api/verification",
        sessionToken,
        {
          targetType: "server",
          targetId: serverId,
          proofUrl: "https://example.test/manual-proof",
        },
      ),
    );
    expect(bypass.status).toBe(422);
    expect(await bypass.json()).toMatchObject({
      code: "SERVER_CONTROL_CHALLENGE_REQUIRED",
    });

    directoryState.current = {
      fetchedAt: new Date(Date.now() + 5_000).toISOString(),
      isStale: true,
      servers: [
        {
          address,
          port,
          name: `Control Challenge Server ${controlToken}`,
          responding: true,
        },
      ],
    };
    const stale = await verifyChallenge(
      post(
        `http://nexus.test/api/servers/${serverId}/claim-challenge/verify`,
        sessionToken,
        { challengeId, token: controlToken },
      ),
      { params: Promise.resolve({ id: serverId }) },
    );
    expect(stale.status).toBe(503);
    expect(await stale.json()).toMatchObject({
      code: "MTA_DIRECTORY_STALE",
    });

    if (!storedChallenge) throw new Error("Expected issued challenge to be persisted");
    const createdAt = storedChallenge.createdAt;
    directoryState.current = {
      fetchedAt: new Date(createdAt.getTime() - 1_000).toISOString(),
      isStale: false,
      servers: [
        {
          address,
          port,
          name: `Control Challenge Server ${controlToken}`,
          responding: true,
        },
      ],
    };
    const tooOld = await verifyChallenge(
      post(
        `http://nexus.test/api/servers/${serverId}/claim-challenge/verify`,
        sessionToken,
        { challengeId, token: controlToken },
      ),
      { params: Promise.resolve({ id: serverId }) },
    );
    expect(tooOld.status).toBe(409);
    expect(await tooOld.json()).toMatchObject({
      code: "SERVER_CONTROL_SNAPSHOT_TOO_OLD",
    });

    directoryState.current = {
      fetchedAt: new Date(Date.now() + 5_000).toISOString(),
      isStale: false,
      servers: [
        {
          address,
          port,
          name: "Control Challenge Server",
          responding: true,
        },
      ],
    };
    const missingToken = await verifyChallenge(
      post(
        `http://nexus.test/api/servers/${serverId}/claim-challenge/verify`,
        sessionToken,
        { challengeId, token: controlToken },
      ),
      { params: Promise.resolve({ id: serverId }) },
    );
    expect(missingToken.status).toBe(422);
    expect(await missingToken.json()).toMatchObject({
      code: "SERVER_CONTROL_TOKEN_NOT_VISIBLE",
    });

    directoryState.current = {
      fetchedAt: new Date(Date.now() + 6_000).toISOString(),
      isStale: false,
      servers: [
        {
          address,
          port,
          name: `Control Challenge Server ${controlToken}`,
          responding: false,
        },
      ],
    };
    const offline = await verifyChallenge(
      post(
        `http://nexus.test/api/servers/${serverId}/claim-challenge/verify`,
        sessionToken,
        { challengeId, token: controlToken },
      ),
      { params: Promise.resolve({ id: serverId }) },
    );
    expect(offline.status).toBe(409);
    expect(await offline.json()).toMatchObject({
      code: "SERVER_CONTROL_PROOF_NOT_LIVE",
    });

    const freshFetchedAt = new Date(Date.now() + 7_000).toISOString();
    directoryState.current = {
      fetchedAt: freshFetchedAt,
      isStale: false,
      servers: [
        {
          address,
          port,
          name: `Control Challenge Server ${controlToken}`,
          responding: true,
        },
      ],
    };
    const verified = await verifyChallenge(
      post(
        `http://nexus.test/api/servers/${serverId}/claim-challenge/verify`,
        sessionToken,
        { challengeId, token: controlToken },
      ),
      { params: Promise.resolve({ id: serverId }) },
    );
    expect(verified.status).toBe(201);
    const verifiedText = await verified.text();
    expect(verifiedText).not.toContain(controlToken);
    const verifiedBody = JSON.parse(verifiedText);
    expect(verifiedBody).toMatchObject({
      success: true,
      verificationRequest: {
        requesterId: userId,
        targetType: "server",
        targetId: serverId,
        status: "pending",
      },
      proof: {
        method: "mta_master_name_challenge",
        challengeId,
        sourceFetchedAt: freshFetchedAt,
      },
    });

    const [consumed] = await db
      .select()
      .from(serverClaimChallenges)
      .where(eq(serverClaimChallenges.id, challengeId))
      .limit(1);
    expect(consumed?.consumedAt).toBeTruthy();
    expect(consumed?.sourceFetchedAt?.toISOString()).toBe(freshFetchedAt);
    expect(consumed?.verificationRequestId).toBe(
      verifiedBody.verificationRequest.id,
    );

    const [request] = await db
      .select()
      .from(verificationRequests)
      .where(
        eq(
          verificationRequests.id,
          verifiedBody.verificationRequest.id,
        ),
      )
      .limit(1);
    expect(request?.notes).toContain(
      "Automated MTA master-list control challenge verified",
    );
    expect(request?.notes).not.toContain(controlToken);

    const beforeModeration = await serverRepository.findById(serverId);
    expect(beforeModeration?.ownerId).toBeFalsy();
    expect(beforeModeration?.isVerified).toBe(false);

    const retry = await verifyChallenge(
      post(
        `http://nexus.test/api/servers/${serverId}/claim-challenge/verify`,
        sessionToken,
        { challengeId, token: controlToken },
      ),
      { params: Promise.resolve({ id: serverId }) },
    );
    expect(retry.status).toBe(400);
    expect(await retry.json()).toMatchObject({
      code: "INVALID_SERVER_CONTROL_CHALLENGE",
    });

    const approved = await adminAction(
      post(
        "http://nexus.test/api/admin/actions",
        moderatorToken,
        {
          targetType: "verification",
          targetId: verifiedBody.verificationRequest.id,
          action: "approve",
          notes: "Live MTA control proof reviewed.",
        },
      ),
    );
    expect(approved.status).toBe(200);

    const owned = await serverRepository.findById(serverId);
    expect(owned?.ownerId).toBe(userId);
    expect(owned?.isVerified).toBe(true);

    const [resolvedRequest] = await db
      .select()
      .from(verificationRequests)
      .where(
        eq(
          verificationRequests.id,
          verifiedBody.verificationRequest.id,
        ),
      )
      .limit(1);
    expect(resolvedRequest?.status).toBe("approved");
    expect(resolvedRequest?.reviewerId).toBe(moderatorId);
  });

  it("fails closed when a legacy pending server request has no consumed control proof", async () => {
    const suffix = `${Date.now().toString(36)}_${process.pid}`;
    const requesterId = `usr_legacy_claim_${suffix}`;
    const reviewerId = `usr_legacy_reviewer_${suffix}`;
    const serverId = `srv_legacy_claim_${suffix}`;
    const requestId = `ver_legacy_claim_${suffix}`;
    const port = 19_000 + ((Date.now() + process.pid) % 30_000);

    await userRepository.create({
      id: requesterId,
      email: `legacy_claim_${suffix}@nexus.test`,
      username: `legacy_claim_${suffix}`,
      displayName: "Legacy Claim Requester",
      role: "user",
    });
    await userRepository.create({
      id: reviewerId,
      email: `legacy_reviewer_${suffix}@nexus.test`,
      username: `legacy_reviewer_${suffix}`,
      displayName: "Legacy Claim Reviewer",
      role: "moderator",
    });
    await serverRepository.create({
      id: serverId,
      name: "Legacy Pending Claim",
      slug: `legacy-pending-claim-${suffix}`,
      ipAddress: "198.51.100.212",
      port,
      status: "active",
      visibility: "public",
      isVerified: false,
      gameplayTags: [],
      mediaUrls: [],
    });

    await db.insert(verificationRequests).values({
      id: requestId,
      requesterId,
      targetType: "server",
      targetId: serverId,
      status: "pending",
      notes: "Legacy pre-challenge ownership request.",
      createdAt: new Date(),
    });

    await expect(
      verificationRepository.resolveRequest({
        id: requestId,
        reviewerId,
        decision: "approved",
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
      reviewNotes: "Re-submit through the live control challenge.",
    });
    expect(rejected?.status).toBe("rejected");

    const afterRejection = await serverRepository.findById(serverId);
    expect(afterRejection?.ownerId).toBeFalsy();
    expect(afterRejection?.isVerified).toBe(false);
  });
});
