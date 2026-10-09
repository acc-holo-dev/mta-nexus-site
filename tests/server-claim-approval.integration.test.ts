import { sql, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  db,
  serverClaimChallengeRepository,
  servers,
  userRepository,
  verificationRepository,
  verificationRequests,
} from "@nexus/db";

function disposablePort(offset: number) {
  return 20_000 + ((Date.now() + process.pid + offset) % 30_000);
}

async function dbFutureTimestamp() {
  const [row] = await db.execute(
    sql`select (clock_timestamp() + interval '1 second')::text as now`,
  );
  return new Date(String(row.now));
}

describe("server claim moderation ownership CAS", () => {
  it("assigns ownership only after a consumed MTA control proof is approved", async () => {
    const suffix = `${Date.now().toString(36)}_${process.pid}`;
    const requesterId = `usr_claim_approve_${suffix}`;
    const reviewerId = `usr_claim_review_${suffix}`;
    const serverId = `srv_claim_approve_${suffix}`;
    const verificationId = `ver_claim_approve_${suffix}`;

    await userRepository.create({
      id: requesterId,
      email: `claim_approve_${suffix}@nexus.test`,
      username: `claim_approve_${suffix}`,
      displayName: "Claim Approval Requester",
      role: "user",
    });
    await userRepository.create({
      id: reviewerId,
      email: `claim_review_${suffix}@nexus.test`,
      username: `claim_review_${suffix}`,
      displayName: "Claim Approval Reviewer",
      role: "moderator",
    });
    const serverPort = disposablePort(1);
    await db.insert(servers).values({
      id: serverId,
      name: "Claim Approval Server",
      slug: `claim-approval-${suffix}`,
      ipAddress: "198.51.100.70",
      port: serverPort,
      status: "active",
      visibility: "public",
      isVerified: false,
    });

    const challenge = await serverClaimChallengeRepository.issue({
      serverId,
      requesterId,
      auditId: `aud_claim_issue_${suffix}`,
    });
    const sourceFetchedAt = await dbFutureTimestamp();
    const consumed =
      await serverClaimChallengeRepository.consumeVerifiedProof({
        id: challenge.id,
        serverId,
        requesterId,
        token: challenge.token,
        sourceFetchedAt,
        expectedEndpoint: { ipAddress: "198.51.100.70", port: serverPort },
        verificationRequestId: verificationId,
        auditId: `aud_claim_proof_${suffix}`,
      });

    expect(consumed.verificationRequest).toMatchObject({
      id: verificationId,
      requesterId,
      targetType: "server",
      targetId: serverId,
      status: "pending",
    });

    const resolved = await verificationRepository.resolveRequest({
      id: verificationId,
      reviewerId,
      decision: "approved",
      reviewNotes: "Verified control proof.",
    });
    expect(resolved).toMatchObject({
      id: verificationId,
      status: "approved",
    });

    const [claimed] = await db
      .select()
      .from(servers)
      .where(eq(servers.id, serverId))
      .limit(1);
    expect(claimed).toMatchObject({
      ownerId: requesterId,
      isVerified: true,
    });
  });

  it("rolls back a forged server approval that has no consumed proof", async () => {
    const suffix = `${Date.now().toString(36)}_${process.pid}_missing`;
    const requesterId = `usr_claim_missing_${suffix}`;
    const reviewerId = `usr_claim_missing_mod_${suffix}`;
    const serverId = `srv_claim_missing_${suffix}`;
    const verificationId = `ver_claim_missing_${suffix}`;

    await userRepository.create({
      id: requesterId,
      email: `claim_missing_${suffix}@nexus.test`,
      username: `claim_missing_${suffix}`,
      displayName: "Missing Proof Requester",
      role: "user",
    });
    await userRepository.create({
      id: reviewerId,
      email: `claim_missing_mod_${suffix}@nexus.test`,
      username: `claim_missing_mod_${suffix}`,
      displayName: "Missing Proof Moderator",
      role: "moderator",
    });
    await db.insert(servers).values({
      id: serverId,
      name: "Missing Proof Server",
      slug: `missing-proof-${suffix}`,
      ipAddress: "198.51.100.71",
      port: disposablePort(2),
      status: "active",
      visibility: "public",
      isVerified: false,
    });
    await db.insert(verificationRequests).values({
      id: verificationId,
      requesterId,
      targetType: "server",
      targetId: serverId,
      status: "pending",
    });

    await expect(
      verificationRepository.resolveRequest({
        id: verificationId,
        reviewerId,
        decision: "approved",
        reviewNotes: "Must fail without proof.",
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
    });

    const [request] = await db
      .select()
      .from(verificationRequests)
      .where(eq(verificationRequests.id, verificationId))
      .limit(1);
    const [unclaimed] = await db
      .select()
      .from(servers)
      .where(eq(servers.id, serverId))
      .limit(1);

    expect(request?.status).toBe("pending");
    expect(request?.reviewerId).toBeFalsy();
    expect(unclaimed).toMatchObject({
      ownerId: null,
      isVerified: false,
    });
  });

  it("rolls back approval if another user became owner after proof consumption", async () => {
    const suffix = `${Date.now().toString(36)}_${process.pid}_race`;
    const requesterId = `usr_claim_race_${suffix}`;
    const otherOwnerId = `usr_claim_race_other_${suffix}`;
    const reviewerId = `usr_claim_race_mod_${suffix}`;
    const serverId = `srv_claim_race_${suffix}`;
    const verificationId = `ver_claim_race_${suffix}`;

    for (const [id, name, role] of [
      [requesterId, "Claim Race Requester", "user"],
      [otherOwnerId, "Claim Race Other", "user"],
      [reviewerId, "Claim Race Moderator", "moderator"],
    ] as const) {
      await userRepository.create({
        id,
        email: `${id}@nexus.test`,
        username: id.slice(0, 60),
        displayName: name,
        role,
      });
    }
    const serverPort = disposablePort(3);
    await db.insert(servers).values({
      id: serverId,
      name: "Claim Race Server",
      slug: `claim-race-${suffix}`,
      ipAddress: "198.51.100.72",
      port: serverPort,
      status: "active",
      visibility: "public",
      isVerified: false,
    });

    const challenge = await serverClaimChallengeRepository.issue({
      serverId,
      requesterId,
      auditId: `aud_claim_race_issue_${suffix}`,
    });
    await serverClaimChallengeRepository.consumeVerifiedProof({
      id: challenge.id,
      serverId,
      requesterId,
      token: challenge.token,
      sourceFetchedAt: await dbFutureTimestamp(),
      expectedEndpoint: { ipAddress: "198.51.100.72", port: serverPort },
      verificationRequestId: verificationId,
      auditId: `aud_claim_race_proof_${suffix}`,
    });

    await db
      .update(servers)
      .set({ ownerId: otherOwnerId })
      .where(eq(servers.id, serverId));

    await expect(
      verificationRepository.resolveRequest({
        id: verificationId,
        reviewerId,
        decision: "approved",
        reviewNotes: "Ownership changed before moderation.",
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
    });

    const [request] = await db
      .select()
      .from(verificationRequests)
      .where(eq(verificationRequests.id, verificationId))
      .limit(1);
    const [serverState] = await db
      .select()
      .from(servers)
      .where(eq(servers.id, serverId))
      .limit(1);

    expect(request?.status).toBe("pending");
    expect(serverState).toMatchObject({
      ownerId: otherOwnerId,
      isVerified: false,
    });
  });
});
