import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { expect, it } from "vitest";
import {
  auditEvents,
  auditRepository,
  db,
  notifications,
  organizationMembers,
  organizations,
  readManagedServerClaimStatus,
  serverClaimChallenges,
  serverClaimChallengeRepository,
  servers,
  sessionRepository,
  users,
  verificationRepository,
  verificationRequests,
} from "@nexus/db";

let nextPort = 20_000 + (Date.now() % 30_000);
async function fixture() {
  const suffix = randomUUID().replaceAll("-", "");
  const manager = `usr_cm_${suffix}`,
    owner = `usr_co_${suffix}`,
    reviewer = `usr_cr_${suffix}`;
  const organization = `org_ca_${suffix}`,
    otherOrganization = `org_cb_${suffix}`;
  const serverId = `srv_co_${suffix}`,
    memberId = `om_co_${suffix}`,
    requestId = `ver_co_${suffix}`;
  for (const [id, role] of [
    [manager, "user"],
    [owner, "user"],
    [reviewer, "moderator"],
  ] as const)
    await db
      .insert(users)
      .values({ id, email: `${id}@example.invalid`, username: id, displayName: role, role });
  await sessionRepository.create({
    id: `ses_${reviewer}`,
    userId: reviewer,
    token: `tok_${reviewer}`,
    expiresAt: new Date("2099-01-01T00:00:00.000Z"),
  });
  for (const id of [organization, otherOrganization])
    await db
      .insert(organizations)
      .values({ id, name: "Claim organization", slug: id, ownerId: owner });
  await db.insert(organizationMembers).values({
    id: memberId,
    organizationId: organization,
    userId: manager,
    role: "member",
    permissions: ["manage_servers"],
  });
  const port = ++nextPort;
  await db.insert(servers).values({
    id: serverId,
    name: "Organization server",
    slug: serverId,
    ipAddress: "198.51.100.205",
    port,
    organizationId: organization,
    ownerId: owner,
    visibility: "private",
    isVerified: false,
  });
  const issue = () =>
    serverClaimChallengeRepository.issue({
      serverId,
      requesterId: manager,
      auditId: `aud_ci_${suffix}`,
    });
  const consume = async (challenge: Awaited<ReturnType<typeof issue>>) => {
    const [clock] = await db.execute(
      sql`select (clock_timestamp() + interval '1 second')::text as now`,
    );
    return serverClaimChallengeRepository.consumeVerifiedProof({
      id: challenge.id,
      serverId,
      requesterId: manager,
      token: challenge.token,
      sourceFetchedAt: new Date(String(clock.now)),
      expectedEndpoint: { ipAddress: "198.51.100.205", port },
      verificationRequestId: requestId,
      auditId: `aud_cp_${suffix}`,
    });
  };
  const approve = () =>
    verificationRepository.resolveRequest({
      id: requestId,
      reviewerId: reviewer,
      decision: "approved",
      currentToken: `tok_${reviewer}`,
    });
  const revoke = () =>
    db
      .update(organizationMembers)
      .set({ permissions: [] })
      .where(eq(organizationMembers.id, memberId));
  const readServer = async () =>
    (await db.select().from(servers).where(eq(servers.id, serverId)))[0];
  const assertApprovalRolledBack = async () => {
    const [request] = await db
      .select()
      .from(verificationRequests)
      .where(eq(verificationRequests.id, requestId));
    expect(request).toMatchObject({ status: "pending", reviewerId: null, resolvedAt: null });
    expect((await readServer()).isVerified).toBe(false);
    expect(
      await db
        .select()
        .from(notifications)
        .where(eq(notifications.id, `ntf_verification_resolution_${requestId}`)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(auditEvents)
        .where(eq(auditEvents.id, `aud_server_verification_${requestId}`)),
    ).toHaveLength(0);
  };
  return {
    manager,
    owner,
    reviewer,
    organization,
    otherOrganization,
    serverId,
    requestId,
    issue,
    consume,
    approve,
    revoke,
    readServer,
    assertApprovalRolledBack,
  };
}

it("keeps organizational ownership and records a private proof/decision lifecycle", async () => {
  const f = await fixture();
  const challenge = await f.issue();
  const [proof] = await db
    .select()
    .from(serverClaimChallenges)
    .where(eq(serverClaimChallenges.id, challenge.id));
  expect(proof).toMatchObject({ claimScopeRecorded: true, claimOrganizationId: f.organization });
  await f.consume(challenge);
  expect(
    await readManagedServerClaimStatus(f.serverId, { id: f.manager, role: "user" }),
  ).toMatchObject({
    isVerified: false,
    request: { status: "pending", isRequester: true, proofMatchesServer: true },
  });
  await f.approve();
  expect(await f.readServer()).toMatchObject({
    ownerId: null,
    organizationId: f.organization,
    isVerified: true,
  });
  const page = await auditRepository.pageForManagedServer(f.serverId, {
    id: f.owner,
    role: "user",
  });
  expect(page?.events.map((event) => event.action)).toEqual(
    expect.arrayContaining([
      "server.claim_challenge_issued",
      "server.control_proof_recorded",
      "server.verification_approved",
    ]),
  );
  const decision = page?.events.find((event) => event.action === "server.verification_approved");
  expect(decision).toMatchObject({
    actorId: f.reviewer,
    actorType: "admin",
    actorUsername: f.reviewer,
  });
  expect(JSON.stringify(page)).not.toContain(challenge.token);
});
it("cannot issue new challenges after delegation is revoked", async () => {
  const f = await fixture();
  await f.revoke();
  await expect(f.issue()).rejects.toMatchObject({
    code: "SERVER_CLAIM_AUTHORITY_CHANGED",
    statusCode: 403,
  });
  expect(
    await db
      .select()
      .from(serverClaimChallenges)
      .where(eq(serverClaimChallenges.serverId, f.serverId)),
  ).toHaveLength(0);
});
it("does not consume a previously issued token after revocation", async () => {
  const f = await fixture(),
    challenge = await f.issue();
  await f.revoke();
  await expect(f.consume(challenge)).rejects.toMatchObject({
    code: "SERVER_CLAIM_AUTHORITY_CHANGED",
  });
  const [proof] = await db
    .select()
    .from(serverClaimChallenges)
    .where(eq(serverClaimChallenges.id, challenge.id));
  expect(proof.consumedAt).toBeNull();
  expect(
    await db.select().from(verificationRequests).where(eq(verificationRequests.id, f.requestId)),
  ).toHaveLength(0);
});
it("rolls back approval after revocation, but permits rejection and a new owner challenge", async () => {
  const f = await fixture();
  await f.consume(await f.issue());
  await f.revoke();
  await expect(f.approve()).rejects.toMatchObject({
    code: "SERVER_CLAIM_AUTHORITY_CHANGED",
    statusCode: 409,
  });
  await f.assertApprovalRolledBack();
  expect(
    await readManagedServerClaimStatus(f.serverId, { id: f.manager, role: "user" }),
  ).toBeNull();
  expect(
    await readManagedServerClaimStatus(f.serverId, { id: f.owner, role: "user" }),
  ).toMatchObject({ request: { status: "pending", isRequester: false } });
  await verificationRepository.resolveRequest({
    id: f.requestId,
    reviewerId: f.reviewer,
    decision: "rejected",
    currentToken: `tok_${f.reviewer}`,
  });
  expect(
    await readManagedServerClaimStatus(f.serverId, { id: f.owner, role: "user" }),
  ).toMatchObject({ request: { status: "rejected" } });
  await expect(
    serverClaimChallengeRepository.issue({
      serverId: f.serverId,
      requesterId: f.owner,
      auditId: `aud_retry_${f.requestId}`,
    }),
  ).resolves.toHaveProperty("token");
});
it("rejects proof carried to another organization, even if the requester owns both", async () => {
  const f = await fixture();
  await db
    .update(organizations)
    .set({ ownerId: f.manager })
    .where(eq(organizations.id, f.otherOrganization));
  await f.consume(await f.issue());
  await db
    .update(servers)
    .set({ organizationId: f.otherOrganization })
    .where(eq(servers.id, f.serverId));
  await expect(f.approve()).rejects.toMatchObject({ code: "SERVER_CLAIM_SCOPE_CHANGED" });
  await f.assertApprovalRolledBack();
  expect(
    await readManagedServerClaimStatus(f.serverId, { id: f.manager, role: "user" }),
  ).toMatchObject({ request: { proofMatchesServer: false } });
});
it("retains the proof's original organization snapshot after organization deletion", async () => {
  const f = await fixture();
  await f.consume(await f.issue());
  await db.delete(organizations).where(eq(organizations.id, f.organization));
  expect((await f.readServer()).organizationId).toBeNull();
  // Remove the legacy owner too so the test reaches the proof scope guard.
  await db.update(servers).set({ ownerId: null }).where(eq(servers.id, f.serverId));
  await expect(f.approve()).rejects.toMatchObject({ code: "SERVER_CLAIM_SCOPE_CHANGED" });
  await f.assertApprovalRolledBack();
  const [proof] = await db
    .select()
    .from(serverClaimChallenges)
    .where(eq(serverClaimChallenges.verificationRequestId, f.requestId));
  expect(proof.claimOrganizationId).toBe(f.organization);
});
it("fails closed for a consumed proof without an explicitly recorded legacy scope", async () => {
  const f = await fixture();
  await f.consume(await f.issue());
  await db
    .update(serverClaimChallenges)
    .set({ claimScopeRecorded: false, claimOrganizationId: null })
    .where(
      and(
        eq(serverClaimChallenges.serverId, f.serverId),
        eq(serverClaimChallenges.verificationRequestId, f.requestId),
      ),
    );
  await expect(f.approve()).rejects.toMatchObject({ code: "SERVER_CLAIM_SCOPE_CHANGED" });
  await f.assertApprovalRolledBack();
});
