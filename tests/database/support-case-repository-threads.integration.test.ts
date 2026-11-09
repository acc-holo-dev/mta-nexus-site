import { describe, expect, it } from "vitest";
import {
  createSupportUser,
  fixtureSuffix,
  initiatingToken,
  openSupportCase,
  supportCaseRepository,
} from "../helpers/support-case-repository-harness";

describe("support case repository: threads, status, and requester isolation", () => {
  it("persists threads, status changes and requester isolation", async () => {
    const suffix = fixtureSuffix();
    const requesterId = `usr_support_${suffix}`;
    const otherUserId = `usr_support_other_${suffix}`;
    const staffId = `usr_support_staff_${suffix}`;
    const caseId = `sup_${suffix}`;

    await createSupportUser({
      id: requesterId,
      email: `support_${suffix}@nexus.test`,
      username: `support_${suffix}`,
      displayName: "Support Requester",
    });
    await createSupportUser({
      id: otherUserId,
      email: `support_other_${suffix}@nexus.test`,
      username: `support_other_${suffix}`,
      displayName: "Other Support User",
    });
    await createSupportUser({
      id: staffId,
      email: `support_staff_${suffix}@nexus.test`,
      username: `support_staff_${suffix}`,
      displayName: "Support Moderator",
      role: "moderator",
    });

    await openSupportCase({
      caseId,
      requesterId,
      category: "account",
      subject: "Integration support case",
      messageId: `spm_initial_${suffix}`,
      messageBody: "Initial support message with enough context.",
      auditId: `aud_support_create_${suffix}`,
    });

    expect(await supportCaseRepository.listByRequester(otherUserId)).toEqual([]);
    expect(
      (await supportCaseRepository.listByRequester(requesterId)).map((item) => item.id),
    ).toContain(caseId);

    const reply = await supportCaseRepository.addMessage(
      {
        id: `spm_staff_${suffix}`,
        caseId,
        authorId: staffId,
        authorRole: "staff",
        body: "Staff reply stored in the same durable case.",
        expectedStatus: "open",
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
      (await supportCaseRepository.listMessages(caseId)).map((message) => message.authorRole),
    ).toEqual(["requester", "staff"]);

    expect(
      (
        await supportCaseRepository.updateStatus(
          caseId,
          "closed",
          {
            id: `aud_support_close_${suffix}`,
            actorId: staffId,
            actorType: "admin",
            action: "support.case.status_changed",
            targetId: caseId,
            targetType: "support_case",
          },
          "open",
          await initiatingToken(staffId),
        )
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
      await initiatingToken(staffId),
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
          expectedStatus: "closed",
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
