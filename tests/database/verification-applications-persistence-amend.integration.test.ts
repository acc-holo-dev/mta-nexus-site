import { describe, expect, it } from "vitest";
import {
  amend,
  db,
  developerProfileRepository,
  developerProfiles,
  eq,
  notificationRepository,
  profile,
  repo,
  request,
  resolutionAudits,
  staffSession,
  user,
  verificationRepository,
} from "../helpers/verification-applications-persistence-harness";

describe("verification applications persistence: amend, resolve, and audit rollback", () => {
  it("rebinds changed professional evidence to a current locked profile before independent approval, without changing original submission time or commercial scores", async () => {
    const actorId = await user(),
      reviewerId = await user("moderator"),
      token = await staffSession(reviewerId),
      application = await request(actorId),
      before = await repo.application(actorId, application.id);
    await profile(actorId, ["TypeScript"]);
    expect((await repo.application(actorId, application.id)).profileState).toBe("changed");
    const saved = await amend(actorId, application.id, before.revision),
      after = await repo.application(actorId, application.id);
    expect(after).toMatchObject({ revision: saved.revision, profileState: "current" });
    expect(after.row.createdAt).toBe(before.row.createdAt);
    expect(after.row.status).toBe("pending");
    expect((await developerProfileRepository.own(actorId)).verifiedDeveloper).toBe(false);
    await verificationRepository.resolveRequest({
      id: application.id,
      reviewerId,
      decision: "approved",
      currentToken: token,
      expectedApplicationRevision: saved.revision,
    });
    expect((await developerProfileRepository.own(actorId)).verifiedDeveloper).toBe(true);
    const [stored] = await db
      .select()
      .from(developerProfiles)
      .where(eq(developerProfiles.userId, actorId));
    expect(stored.reputationScore).toBe(100);
    expect(stored.completedDealsCount).toBe(0);
    expect(
      await notificationRepository.findById(`ntf_verification_resolution_${application.id}`),
    ).toMatchObject({ recipientId: actorId });
  });

  it("rolls back stale and legacy unbound decisions after amendments, then accepts a fresh independent rejection", async () => {
    const actorId = await user(),
      reviewerId = await user("moderator"),
      token = await staffSession(reviewerId),
      application = await request(actorId),
      before = await repo.application(actorId, application.id),
      saved = await amend(actorId, application.id, before.revision);
    for (const decision of ["approved", "rejected"] as const)
      for (const expectedApplicationRevision of [undefined, before.revision])
        await expect(
          verificationRepository.resolveRequest({
            id: application.id,
            reviewerId,
            decision,
            currentToken: token,
            expectedApplicationRevision,
          }),
        ).rejects.toMatchObject({ code: "VERIFICATION_APPLICATION_CHANGED" });
    expect(await verificationRepository.findById(application.id)).toMatchObject({
      status: "pending",
      reviewerId: null,
      resolvedAt: null,
    });
    expect(await resolutionAudits(application.id)).toHaveLength(0);
    expect(
      await notificationRepository.findById(`ntf_verification_resolution_${application.id}`),
    ).toBeNull();
    await verificationRepository.resolveRequest({
      id: application.id,
      reviewerId,
      decision: "rejected",
      currentToken: token,
      expectedApplicationRevision: saved.revision,
    });
    expect(await verificationRepository.findById(application.id)).toMatchObject({
      status: "rejected",
    });
    await expect(amend(actorId, application.id, saved.revision)).rejects.toMatchObject({
      code: "VERIFICATION_APPLICATION_CHANGED",
    });
  });

  it("rolls back evidence and revision on mandatory audit failure", async () => {
    const actorId = await user(),
      application = await request(actorId),
      before = await repo.application(actorId, application.id);
    await expect(
      amend(actorId, application.id, before.revision, before.events[0].id),
    ).rejects.toThrow();
    const after = await repo.application(actorId, application.id);
    expect(after.revision).toBe(before.revision);
    expect(after.row.proofUrl).toBe(before.row.proofUrl);
    expect(after.row.notes).toBe(before.row.notes);
    expect(after.events).toEqual(before.events);
  });
});
