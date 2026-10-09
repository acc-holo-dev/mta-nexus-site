import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  db,
  serverClaimChallenges,
  serverClaimChallengeRepository,
  serverRepository,
  userRepository,
  verificationRepository,
  verificationRequests,
} from "@nexus/db";

async function fixture() {
  const suffix = `${Date.now().toString(36)}_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
  const requesterId = `usr_endpoint_proof_${suffix}`;
  const reviewerId = `usr_endpoint_reviewer_${suffix}`;
  const serverId = `srv_endpoint_proof_${suffix}`;
  const port = 15_000 + Math.floor(Math.random() * 35_000);
  await userRepository.create({
    id: requesterId,
    email: `proof_${suffix}@nexus.test`,
    username: `proof_${suffix}`,
    displayName: "Endpoint Proof Requester",
    role: "user",
  });
  await userRepository.create({
    id: reviewerId,
    email: `reviewer_${suffix}@nexus.test`,
    username: `reviewer_${suffix}`,
    displayName: "Endpoint Proof Reviewer",
    role: "moderator",
  });
  await serverRepository.create({
    id: serverId,
    slug: `endpoint-proof-${suffix.replace(/_/gu, "-")}`,
    name: "Endpoint Proof Server",
    ipAddress: "198.51.100.77",
    port,
    status: "active",
    visibility: "public",
    isVerified: false,
    gameplayTags: [],
    mediaUrls: [],
  });
  const endpoint = { ipAddress: "198.51.100.77", port };
  return { suffix, requesterId, reviewerId, serverId, endpoint };
}

async function issue(target: Awaited<ReturnType<typeof fixture>>) {
  const challenge = await serverClaimChallengeRepository.issue({
    serverId: target.serverId,
    requesterId: target.requesterId,
    auditId: `aud_issue_${target.suffix}`,
  });
  const [saved] = await db.select().from(serverClaimChallenges)
    .where(eq(serverClaimChallenges.id, challenge.id));
  expect(saved?.endpointRevision).toBe(0);
  if (!saved) throw new Error("Missing challenge");
  return { ...challenge, createdAt: saved.createdAt };
}

async function consume(
  target: Awaited<ReturnType<typeof fixture>>,
  challenge: Awaited<ReturnType<typeof issue>>,
) {
  return serverClaimChallengeRepository.consumeVerifiedProof({
    id: challenge.id,
    serverId: target.serverId,
    requesterId: target.requesterId,
    token: challenge.token,
    expectedEndpoint: target.endpoint,
    // Simulate a fresh master-list snapshot observed after issuance.
    sourceFetchedAt: new Date(challenge.createdAt.getTime() + 1_000),
    verificationRequestId: `ver_endpoint_${target.suffix}`,
    auditId: `aud_consume_${target.suffix}`,
  });
}

describe("server control proof is bound to game endpoint revision (PostgreSQL)", () => {
  it("rejects a challenge after A -> B -> A address changes", async () => {
    const target = await fixture();
    const challenge = await issue(target);
    await serverRepository.update(target.serverId, { port: target.endpoint.port + 1 });
    await serverRepository.update(target.serverId, { port: target.endpoint.port });
    await expect(consume(target, challenge)).rejects.toMatchObject({ statusCode: 409 });
    const [stored] = await db.select().from(serverClaimChallenges)
      .where(eq(serverClaimChallenges.id, challenge.id));
    expect(stored?.consumedAt).toBeNull();
  });

  it("blocks moderation after the endpoint changes even when proof was valid", async () => {
    const target = await fixture();
    const challenge = await issue(target);
    const completed = await consume(target, challenge);
    await serverRepository.update(target.serverId, { ipAddress: "198.51.100.78" });
    await serverRepository.update(target.serverId, { ipAddress: target.endpoint.ipAddress });
    await expect(verificationRepository.resolveRequest({
      id: completed.verificationRequest.id,
      reviewerId: target.reviewerId,
      decision: "approved",
    })).rejects.toMatchObject({ statusCode: 409 });
    const [request] = await db.select().from(verificationRequests)
      .where(eq(verificationRequests.id, completed.verificationRequest.id));
    expect(request?.status).toBe("pending");
    const server = await serverRepository.findById(target.serverId);
    expect(server?.ownerId).toBeFalsy();
    expect(server?.isVerified).toBe(false);
  });

  it("preserves a fresh control proof after editorial-only updates", async () => {
    const target = await fixture();
    const challenge = await issue(target);
    await serverRepository.update(target.serverId, { description: "Updated before proof" });
    const completed = await consume(target, challenge);
    await serverRepository.update(target.serverId, { name: "Updated after proof" });
    const approved = await verificationRepository.resolveRequest({
      id: completed.verificationRequest.id,
      reviewerId: target.reviewerId,
      decision: "approved",
    });
    expect(approved?.status).toBe("approved");
    const server = await serverRepository.findById(target.serverId);
    expect(server?.isVerified).toBe(true);
    expect(server?.ownerId).toBe(target.requesterId);
  });
});
