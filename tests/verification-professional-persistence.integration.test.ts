import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { expect, it } from "vitest";
import {
  auditEvents,
  db,
  developerProfileRepository,
  developerProfiles,
  notificationRepository,
  organizationMembers,
  organizationRepository,
  sessionRepository,
  users,
  userRepository,
  verificationRepository,
} from "@nexus/db";
async function fixture(role: "developer" | "moderator" = "developer") {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 16),
    id = `usr_vprof_${suffix}`;
  await userRepository.create({
    id,
    email: `${suffix}@nexus.test`,
    username: `vprof_${suffix}`,
    displayName: "Verification fixture",
    role,
  });
  return id;
}
async function staffSession(reviewerId: string) {
  const token = `tok_${reviewerId}`;
  await sessionRepository.create({
    id: `ses_${reviewerId}`,
    userId: reviewerId,
    token,
    expiresAt: new Date("2099-01-01T00:00:00.000Z"),
  });
  return token;
}
async function save(
  actorId: string,
  fields: Partial<{ specialties: string[]; githubUrl: string; discordTag: string }> = {},
) {
  const previous = await developerProfileRepository.own(actorId);
  return developerProfileRepository.update({
    actorId,
    expectedUpdatedAt: previous.updatedAt,
    specialties: ["Lua"],
    githubUrl: "https://github.com/example",
    discordTag: "fixture",
    ...fields,
    profileId: `dev_${randomUUID()}`,
    auditId: `aud_${randomUUID()}`,
  });
}
const application = (id: string) =>
  verificationRepository.createRequest({
    requesterId: id,
    targetType: "developer",
    targetId: id,
    proofUrl: "https://example.test/evidence",
    notes: "Evidence fixture",
  });
it("allows experience verification after identity approval and atomically stores the genuine flag, audit and inbox", async () => {
  const id = await fixture(),
    reviewerId = await fixture("moderator"),
    token = await staffSession(reviewerId);
  await save(id);
  await db.update(users).set({ isVerified: true }).where(eq(users.id, id));
  const request = await application(id);
  await verificationRepository.resolveRequest({
    id: request.id,
    reviewerId,
    decision: "approved",
    reviewNotes: "Evidence reviewed",
    currentToken: token,
  });
  expect((await developerProfileRepository.own(id)).verifiedDeveloper).toBe(true);
  expect(
    await notificationRepository.findById(`ntf_verification_resolution_${request.id}`),
  ).toMatchObject({ recipientId: id, link: "/workspace/verification?view=history" });
  expect(
    await db
      .select()
      .from(auditEvents)
      .where(
        and(eq(auditEvents.targetId, request.id), eq(auditEvents.action, "verification.approved")),
      ),
  ).toHaveLength(1);
  await save(id, { discordTag: "new-contact" });
  expect((await developerProfileRepository.own(id)).verifiedDeveloper).toBe(true);
  await save(id, { specialties: ["TypeScript"] });
  expect((await developerProfileRepository.own(id)).verifiedDeveloper).toBe(false);
  const [profile] = await db
    .select()
    .from(developerProfiles)
    .where(eq(developerProfiles.userId, id));
  expect(profile.reputationScore).toBe(100);
  expect(profile.completedDealsCount).toBe(0);
});
it("serializes duplicate applications and concurrent shared-profile-version saves", async () => {
  const id = await fixture();
  const initial = await save(id);
  const applications = await Promise.allSettled([application(id), application(id)]);
  expect(applications.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(applications.filter((result) => result.status === "rejected")).toHaveLength(1);
  const writes = await Promise.allSettled(
    ["contact-a", "contact-b"].map((discordTag) =>
      developerProfileRepository.update({
        actorId: id,
        expectedUpdatedAt: initial.updatedAt,
        specialties: ["Lua"],
        githubUrl: initial.githubUrl,
        discordTag,
        profileId: `dev_${randomUUID()}`,
        auditId: `aud_${randomUUID()}`,
      }),
    ),
  );
  expect(writes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(writes.find((result) => result.status === "rejected")).toMatchObject({
    reason: { code: "CONFLICT" },
  });
});
it("rolls back stale experience approval and keeps the request pending without a notification or resolution audit", async () => {
  const id = await fixture(),
    reviewerId = await fixture("moderator"),
    token = await staffSession(reviewerId);
  await save(id);
  const request = await application(id);
  await save(id, { githubUrl: "https://github.com/changed" });
  await expect(
    verificationRepository.resolveRequest({
      id: request.id,
      reviewerId,
      decision: "approved",
      currentToken: token,
    }),
  ).rejects.toMatchObject({ code: "VERIFICATION_PROFILE_CHANGED" });
  expect(await verificationRepository.findById(request.id)).toMatchObject({
    status: "pending",
    reviewerId: null,
    resolvedAt: null,
  });
  expect((await developerProfileRepository.own(id)).verifiedDeveloper).toBe(false);
  expect(
    await notificationRepository.findById(`ntf_verification_resolution_${request.id}`),
  ).toBeNull();
  expect(
    await db
      .select()
      .from(auditEvents)
      .where(
        and(eq(auditEvents.targetId, request.id), eq(auditEvents.action, "verification.approved")),
      ),
  ).toHaveLength(0);
  await verificationRepository.resolveRequest({
    id: request.id,
    reviewerId,
    decision: "rejected",
    reviewNotes: "Resubmit current profile",
    currentToken: token,
  });
  expect(await verificationRepository.findById(request.id)).toMatchObject({ status: "rejected" });
});
it("rejects own approval and current-role revocation without committing the pending-state transition", async () => {
  const id = await fixture("moderator"),
    reviewerId = await fixture("moderator"),
    selfToken = await staffSession(id),
    token = await staffSession(reviewerId);
  const request = await verificationRepository.createRequest({
    requesterId: id,
    targetType: "user",
    targetId: id,
  });
  await expect(
    verificationRepository.resolveRequest({
      id: request.id,
      reviewerId: id,
      decision: "approved",
      currentToken: selfToken,
    }),
  ).rejects.toMatchObject({ code: "VERIFICATION_SELF_REVIEW" });
  await db.update(users).set({ role: "user" }).where(eq(users.id, reviewerId));
  await expect(
    verificationRepository.resolveRequest({
      id: request.id,
      reviewerId,
      decision: "approved",
      currentToken: token,
    }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(await verificationRepository.findById(request.id)).toMatchObject({ status: "pending" });
  expect(
    await notificationRepository.findById(`ntf_verification_resolution_${request.id}`),
  ).toBeNull();
});
it("rechecks revoked organization administration at approval and allows an independent rejection", async () => {
  const ownerId = await fixture(),
    managerId = await fixture(),
    reviewerId = await fixture("moderator"),
    token = await staffSession(reviewerId),
    organizationId = `org_${randomUUID()}`;
  await organizationRepository.create({
    id: organizationId,
    name: "Authority fixture",
    slug: `authority-${randomUUID()}`,
    ownerId,
  });
  await db
    .insert(organizationMembers)
    .values({ id: `member_${randomUUID()}`, organizationId, userId: managerId, role: "admin" });
  const request = await verificationRepository.createRequest({
    requesterId: managerId,
    targetType: "organization",
    targetId: organizationId,
  });
  await db
    .update(organizationMembers)
    .set({ role: "member" })
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, managerId),
      ),
    );
  await expect(
    verificationRepository.resolveRequest({
      id: request.id,
      reviewerId,
      decision: "approved",
      currentToken: token,
    }),
  ).rejects.toMatchObject({ code: "VERIFICATION_AUTHORITY_CHANGED" });
  expect(await verificationRepository.findById(request.id)).toMatchObject({ status: "pending" });
  await verificationRepository.resolveRequest({
    id: request.id,
    reviewerId,
    decision: "rejected",
    currentToken: token,
  });
  expect(await verificationRepository.findById(request.id)).toMatchObject({ status: "rejected" });
});
