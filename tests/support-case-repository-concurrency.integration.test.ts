import { expect, it } from "vitest";
import {
  createSupportUser,
  fixtureSuffix,
  initiatingToken,
  openSupportCase,
  supportCaseRepository,
} from "./helpers/support-case-repository-harness";

it("serializes reply-vs-status races without losing the moderation decision", async () => {
  const suffix = fixtureSuffix("support_race");
  const requesterId = `usr_${suffix}`;
  const staffId = `usr_staff_${suffix}`;
  const caseId = `sup_${suffix}`;

  await createSupportUser({
    id: requesterId,
    email: `${suffix}@nexus.test`,
    username: suffix,
    displayName: "Support Race Requester",
  });
  await createSupportUser({
    id: staffId,
    email: `staff_${suffix}@nexus.test`,
    username: `staff_${suffix}`,
    displayName: "Support Race Moderator",
    role: "moderator",
  });

  await openSupportCase({
    caseId,
    requesterId,
    category: "account",
    subject: "Concurrent support moderation",
    messageId: `spm_initial_${suffix}`,
    messageBody: "Initial message for the concurrency fixture.",
    auditId: `aud_initial_${suffix}`,
  });

  const [replyResult, statusResult] = await Promise.all([
    supportCaseRepository.addMessage(
      {
        id: `spm_race_${suffix}`,
        caseId,
        authorId: requesterId,
        authorRole: "requester",
        body: "Reply racing with a moderator resolution.",
        expectedStatus: "open",
      },
      {
        id: `aud_reply_race_${suffix}`,
        actorId: requesterId,
        actorType: "user",
        action: "support.message.created",
        targetId: caseId,
        targetType: "support_case",
      },
    ),
    supportCaseRepository.updateStatus(
      caseId,
      "resolved",
      {
        id: `aud_resolve_race_${suffix}`,
        actorId: staffId,
        actorType: "admin",
        action: "support.case.status_changed",
        targetId: caseId,
        targetType: "support_case",
      },
      "open",
      await initiatingToken(staffId),
    ),
  ]);

  expect((await supportCaseRepository.findById(caseId))?.status).toBe("resolved");
  expect(statusResult?.status).toBe("resolved");

  const messages = await supportCaseRepository.listMessages(caseId);
  const raced = messages.filter((message) => message.id === `spm_race_${suffix}`);
  expect(raced).toHaveLength(replyResult ? 1 : 0);
});
