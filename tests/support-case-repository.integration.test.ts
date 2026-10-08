import { describe, expect, it } from "vitest";
import { supportCaseRepository, userRepository } from "@nexus/db";

describe("support case repository", () => {
  it("persists threads, status changes and requester isolation", async () => {
    const suffix = `${Date.now().toString(36)}_${process.pid}`;
    const requesterId = `usr_support_${suffix}`;
    const otherUserId = `usr_support_other_${suffix}`;
    const staffId = `usr_support_staff_${suffix}`;
    const caseId = `sup_${suffix}`;

    await userRepository.create({
      id: requesterId,
      email: `support_${suffix}@nexus.test`,
      username: `support_${suffix}`,
      displayName: "Support Requester",
      role: "user",
    });
    await userRepository.create({
      id: otherUserId,
      email: `support_other_${suffix}@nexus.test`,
      username: `support_other_${suffix}`,
      displayName: "Other Support User",
      role: "user",
    });
    await userRepository.create({
      id: staffId,
      email: `support_staff_${suffix}@nexus.test`,
      username: `support_staff_${suffix}`,
      displayName: "Support Moderator",
      role: "moderator",
    });

    await supportCaseRepository.createWithInitialMessage(
      {
        id: caseId,
        requesterId,
        category: "account",
        subject: "Integration support case",
        status: "open",
      },
      {
        id: `spm_initial_${suffix}`,
        caseId,
        authorId: requesterId,
        authorRole: "requester",
        body: "Initial support message with enough context.",
      },
      {
        id: `aud_support_create_${suffix}`,
        actorId: requesterId,
        actorType: "user",
        action: "support.case.created",
        targetId: caseId,
        targetType: "support_case",
      },
    );

    expect(await supportCaseRepository.listByRequester(otherUserId)).toEqual([]);
    expect(
      (await supportCaseRepository.listByRequester(requesterId)).map(
        (item) => item.id,
      ),
    ).toContain(caseId);

    const reply = await supportCaseRepository.addMessage(
      {
        id: `spm_staff_${suffix}`,
        caseId,
        authorId: staffId,
        authorRole: "staff",
        body: "Staff reply stored in the same durable case.",
      },
      {
        id: `aud_support_reply_${suffix}`,
        actorId: staffId,
        actorType: "admin",
        action: "support.message.created",
        targetId: caseId,
        targetType: "support_case",
      },
    );
    expect(reply?.message.authorRole).toBe("staff");

    expect(
      (await supportCaseRepository.listMessages(caseId)).map(
        (message) => message.authorRole,
      ),
    ).toEqual(["requester", "staff"]);

    expect(
      (
        await supportCaseRepository.updateStatus(caseId, "closed", {
          id: `aud_support_close_${suffix}`,
          actorId: staffId,
          actorType: "admin",
          action: "support.case.status_changed",
          targetId: caseId,
          targetType: "support_case",
        })
      )?.status,
    ).toBe("closed");

    const staleUpdate = await supportCaseRepository.updateStatus(
      caseId,
      "resolved",
      {
        id: `aud_support_stale_${suffix}`,
        actorId: staffId,
        actorType: "admin",
        action: "support.case.status_changed",
        targetId: caseId,
        targetType: "support_case",
      },
      "open",
    );
    expect(staleUpdate).toBeNull();
    expect((await supportCaseRepository.findById(caseId))?.status).toBe("closed");

    await expect(
      supportCaseRepository.addMessage(
        {
          id: `spm_after_close_${suffix}`,
          caseId,
          authorId: requesterId,
          authorRole: "requester",
          body: "This message must not be accepted after final close.",
        },
        {
          id: `aud_support_after_close_${suffix}`,
          actorId: requesterId,
          actorType: "user",
          action: "support.message.created",
          targetId: caseId,
          targetType: "support_case",
        },
      ),
    ).resolves.toBeNull();
  });
});
