import { expect, it } from "vitest";
import {
  createSupportUser,
  fixtureSuffix,
  openSupportCase,
  supportCaseRepository,
} from "../helpers/support-case-repository-harness";

it("paginates support cases and keeps message pages bounded newest-first", async () => {
  const suffix = fixtureSuffix("support_page");
  const requesterId = `usr_${suffix}`;

  await createSupportUser({
    id: requesterId,
    email: `${suffix}@nexus.test`,
    username: suffix,
    displayName: "Support Pagination",
  });

  for (let index = 0; index < 3; index += 1) {
    const caseId = `sup_${suffix}_${index}`;
    await openSupportCase({
      caseId,
      requesterId,
      category: "account",
      subject: `Pagination case ${index}`,
      messageId: `spm_${suffix}_${index}_0`,
      messageBody: `Initial message ${index}`,
      auditId: `aud_${suffix}_${index}_0`,
    });
  }

  const firstCasePage = await supportCaseRepository.pageByRequester(requesterId, 1, 2);
  const secondCasePage = await supportCaseRepository.pageByRequester(requesterId, 2, 2);
  expect(firstCasePage).toMatchObject({
    page: 1,
    pageSize: 2,
    total: 3,
    totalPages: 2,
  });
  expect(firstCasePage.items).toHaveLength(2);
  expect(secondCasePage.items).toHaveLength(1);

  const caseId = firstCasePage.items[0]?.id;
  expect(caseId).toBeTruthy();
  if (!caseId) return;

  for (let index = 1; index <= 4; index += 1) {
    await supportCaseRepository.addMessage(
      {
        id: `spm_${suffix}_extra_${index}`,
        caseId,
        authorId: requesterId,
        authorRole: "requester",
        body: `Paged message ${index}`,
        expectedStatus: "open",
      },
      {
        id: `aud_${suffix}_extra_${index}`,
        actorId: requesterId,
        actorType: "user",
        action: "support.message.created",
        targetId: caseId,
        targetType: "support_case",
      },
    );
  }

  const latest = await supportCaseRepository.pageMessages(caseId, 1, 2);
  const older = await supportCaseRepository.pageMessages(caseId, 2, 2);
  expect(latest).toMatchObject({
    page: 1,
    pageSize: 2,
    totalPages: 3,
  });
  expect(latest.items.map((item) => item.body)).toEqual(["Paged message 3", "Paged message 4"]);
  expect(older.items.map((item) => item.body)).toEqual(["Paged message 1", "Paged message 2"]);
});
