import { expect, it } from "vitest";
import {
  createSupportUser,
  fixtureSuffix,
  initiatingToken,
  openSupportCase,
  supportCaseRepository,
} from "./helpers/support-case-repository-harness";

it("filters staff queue totals, categories and pages in PostgreSQL", async () => {
  const suffix = fixtureSuffix();
  const requesterId = `usr_filter_${suffix}`;
  const staffId = `usr_filter_staff_${suffix}`;
  const openId = `sup_filter_open_${suffix}`;
  const closedId = `sup_filter_closed_${suffix}`;
  const otherId = `sup_filter_other_${suffix}`;
  await createSupportUser({
    id: requesterId,
    email: `support-filter-${suffix}@nexus.test`,
    username: `sf_${suffix}`,
    displayName: "Filtered queue requester",
  });
  await createSupportUser({
    id: staffId,
    email: `support-filter-staff-${suffix}@nexus.test`,
    username: `sf_staff_${suffix}`,
    displayName: "Filtered queue staff",
    role: "moderator",
  });
  const beforeOpen = await supportCaseRepository.pageStaff(1, 25, {
    category: "integration",
    status: "open",
  });
  const beforeClosed = await supportCaseRepository.pageStaff(1, 25, {
    category: "integration",
    status: "closed",
  });
  const beforeCategory = await supportCaseRepository.pageStaff(1, 25, { category: "integration" });
  for (const [id, category] of [
    [openId, "integration"],
    [closedId, "integration"],
    [otherId, "account"],
  ] as const) {
    await openSupportCase({
      caseId: id,
      requesterId,
      category,
      subject: "Queue filter integration check",
      messageId: `spm_${id}`,
      messageBody: "Initial support queue filter test message.",
      auditId: `aud_${id}`,
    });
  }
  const transitioned = await supportCaseRepository.updateStatus(
    closedId,
    "closed",
    {
      id: `aud_closed_${suffix}`,
      actorId: staffId,
      actorType: "admin",
      action: "support.case.status_changed",
      targetId: closedId,
      targetType: "support_case",
    },
    "open",
    await initiatingToken(staffId),
  );
  expect(transitioned?.status).toBe("closed");
  const open = await supportCaseRepository.pageStaff(1, 25, {
    category: "integration",
    status: "open",
  });
  const closed = await supportCaseRepository.pageStaff(1, 25, {
    category: "integration",
    status: "closed",
  });
  const category = await supportCaseRepository.pageStaff(1, 25, { category: "integration" });
  expect(open.total).toBe(beforeOpen.total + 1);
  expect(closed.total).toBe(beforeClosed.total + 1);
  expect(category.total).toBe(beforeCategory.total + 2);
  expect(
    open.items.every(
      (row) => row.supportCase.category === "integration" && row.supportCase.status === "open",
    ),
  ).toBe(true);
  expect(
    closed.items.every(
      (row) => row.supportCase.category === "integration" && row.supportCase.status === "closed",
    ),
  ).toBe(true);
  expect(open.items.some((row) => row.supportCase.id === openId)).toBe(true);
  expect(closed.items.some((row) => row.supportCase.id === closedId)).toBe(true);
  expect(category.items.every((row) => row.supportCase.category === "integration")).toBe(true);
  expect((await supportCaseRepository.pageByRequester(requesterId)).total).toBe(3);
  const one = await supportCaseRepository.pageStaff(1, 1, {
    category: "integration",
    status: "open",
  });
  expect(one.pageSize).toBe(1);
  expect(one.items).toHaveLength(1);
  expect(one.total).toBe(open.total);
  expect(one.totalPages).toBe(Math.max(1, open.total));
});
