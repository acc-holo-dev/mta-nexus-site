import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  amend,
  and,
  db,
  eq,
  organizationMembers,
  organizationRepository,
  repo,
  user,
  verificationRepository,
} from "../helpers/verification-applications-persistence-harness";

describe("verification applications persistence: foreign access and org authority", () => {
  it("denies foreign access and rechecks revoked organization administration before replacing evidence", async () => {
    const actorId = await user(),
      ownerId = await user(),
      organizationId = `org_${randomUUID()}`;
    await organizationRepository.create({
      id: organizationId,
      name: "Evidence team",
      slug: `evidence-${randomUUID()}`,
      ownerId,
    });
    await db
      .insert(organizationMembers)
      .values({ id: `member_${randomUUID()}`, organizationId, userId: actorId, role: "admin" });
    const application = await verificationRepository.createRequest({
        requesterId: actorId,
        currentToken: `tok_${actorId}`,
        targetType: "organization",
        targetId: organizationId,
        notes: "Original evidence",
      }),
      before = await repo.application(actorId, application.id);
    await expect(repo.application(ownerId, application.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(amend(ownerId, application.id, before.revision)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await db
      .update(organizationMembers)
      .set({ role: "member" })
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, actorId),
        ),
      );
    await expect(amend(actorId, application.id, before.revision)).rejects.toMatchObject({
      code: "VERIFICATION_AUTHORITY_CHANGED",
    });
    expect((await repo.application(actorId, application.id)).revision).toBe(before.revision);
  });
});
