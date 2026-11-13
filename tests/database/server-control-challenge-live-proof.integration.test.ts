import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../site/src/lib/services/mta-master-directory-service", async () => {
  const { directoryState: state } = await import("../helpers/server-control-challenge-harness");
  return {
    mtaMasterDirectoryService: {
      getDirectory: vi.fn(async () => state.current),
    },
    matchesMtaEndpoint: (
      server: { ipAddress: string; port: number },
      observed: { address: string; port: number },
    ) =>
      server.ipAddress.toLowerCase().replace(/\.$/u, "") ===
        observed.address.toLowerCase().replace(/\.$/u, "") && server.port === observed.port,
  };
});

import { db, serverClaimChallenges, serverRepository, verificationRequests } from "@nexus/db";
import { POST as adminAction } from "../../site/src/app/api/admin/actions/route";
import { POST as issueChallenge } from "../../site/src/app/api/servers/[id]/claim-challenge/route";
import { POST as verifyChallenge } from "../../site/src/app/api/servers/[id]/claim-challenge/verify/route";
import { POST as genericVerification } from "../../site/src/app/api/verification/route";
import {
  directoryState,
  post,
  seedLiveControlChallenge,
  setupServerControlChallenge,
} from "../helpers/server-control-challenge-harness";

setupServerControlChallenge();

describe("MTA server control challenge: live proof and moderation", () => {
  it("requires a fresh live name token and creates exactly one moderation request", async () => {
    const {
      userId,
      moderatorId,
      sessionToken,
      attackerToken,
      moderatorToken,
      serverId,
      address,
      port,
      staffPassword,
    } = await seedLiveControlChallenge();

    const issued = await issueChallenge(
      post(`http://nexus.test/api/servers/${serverId}/claim-challenge`, sessionToken),
      { params: Promise.resolve({ id: serverId }) },
    );

    expect(issued.status).toBe(201);
    expect(issued.headers.get("Cache-Control")).toBe("private, no-store");
    expect(issued.headers.get("Vary")).toBe("Cookie");
    const issuedBody = await issued.json();
    expect(issuedBody.challenge.token).toMatch(/^NXCLAIM-[A-F0-9]{24}$/u);
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
      post(`http://nexus.test/api/servers/${serverId}/claim-challenge/verify`, attackerToken, {
        challengeId,
        token: controlToken,
      }),
      { params: Promise.resolve({ id: serverId }) },
    );
    expect(stolenToken.status).toBe(400);
    expect(await stolenToken.json()).toMatchObject({
      code: "INVALID_SERVER_CONTROL_CHALLENGE",
    });

    const bypass = await genericVerification(
      post("http://nexus.test/api/verification", sessionToken, {
        targetType: "server",
        targetId: serverId,
        proofUrl: "https://example.test/manual-proof",
      }),
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
      post(`http://nexus.test/api/servers/${serverId}/claim-challenge/verify`, sessionToken, {
        challengeId,
        token: controlToken,
      }),
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
      post(`http://nexus.test/api/servers/${serverId}/claim-challenge/verify`, sessionToken, {
        challengeId,
        token: controlToken,
      }),
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
      post(`http://nexus.test/api/servers/${serverId}/claim-challenge/verify`, sessionToken, {
        challengeId,
        token: controlToken,
      }),
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
      post(`http://nexus.test/api/servers/${serverId}/claim-challenge/verify`, sessionToken, {
        challengeId,
        token: controlToken,
      }),
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
      post(`http://nexus.test/api/servers/${serverId}/claim-challenge/verify`, sessionToken, {
        challengeId,
        token: controlToken,
      }),
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
    expect(consumed?.verificationRequestId).toBe(verifiedBody.verificationRequest.id);

    const [request] = await db
      .select()
      .from(verificationRequests)
      .where(eq(verificationRequests.id, verifiedBody.verificationRequest.id))
      .limit(1);
    expect(request?.notes).toContain("Automated MTA master-list control challenge verified");
    expect(request?.notes).not.toContain(controlToken);

    const beforeModeration = await serverRepository.findById(serverId);
    expect(beforeModeration?.ownerId).toBeFalsy();
    expect(beforeModeration?.isVerified).toBe(false);

    const retry = await verifyChallenge(
      post(`http://nexus.test/api/servers/${serverId}/claim-challenge/verify`, sessionToken, {
        challengeId,
        token: controlToken,
      }),
      { params: Promise.resolve({ id: serverId }) },
    );
    expect(retry.status).toBe(400);
    expect(await retry.json()).toMatchObject({
      code: "INVALID_SERVER_CONTROL_CHALLENGE",
    });

    const approved = await adminAction(
      post("http://nexus.test/api/admin/actions", moderatorToken, {
        targetType: "verification",
        targetId: verifiedBody.verificationRequest.id,
        action: "approve",
        notes: "Live MTA control proof reviewed.",
        currentPassword: staffPassword,
      }),
    );
    expect(approved.status).toBe(200);

    const owned = await serverRepository.findById(serverId);
    expect(owned?.ownerId).toBe(userId);
    expect(owned?.isVerified).toBe(true);

    const [resolvedRequest] = await db
      .select()
      .from(verificationRequests)
      .where(eq(verificationRequests.id, verifiedBody.verificationRequest.id))
      .limit(1);
    expect(resolvedRequest?.status).toBe("approved");
    expect(resolvedRequest?.reviewerId).toBe(moderatorId);
  });
});
