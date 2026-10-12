import { beforeEach, expect, it, vi } from "vitest";

const page = vi.hoisted(() => vi.fn());
vi.mock("@nexus/db", () => ({ supportMessageDiscoveryRepository: { page } }));

import { supportMessageDiscoveryService as service } from "../apps/web/src/lib/services/support-message-discovery-service";

const id = `sup_${"a".repeat(24)}`,
  messageId = `spm_${"b".repeat(24)}`,
  stamp = "2026-10-12T00:00:00.123456Z",
  base = { group: "all" as const, query: "" };
const value = {
  supportCase: { id, subject: "Own case", status: "open" },
  items: [],
  until: stamp,
  olderCursor: null,
  newerCursor: null,
  focus: null,
};
beforeEach(() => {
  vi.resetAllMocks();
  page.mockResolvedValue(value);
});
it("passes the actor and staff-only requirement to the existing authorization boundary", async () => {
  expect(await service.page(id, "owner", base, true)).toEqual(value);
  expect(page).toHaveBeenCalledExactlyOnceWith(id, "owner", base, true);
});
it.each([
  { supportCase: { ...value.supportCase, id: `sup_${"c".repeat(24)}` } },
  { focus: messageId },
  { until: "2026-10-12T00:00:01.000000Z" },
])("fails closed when storage changes the reviewed case/focus/cutoff: %j", async (extra) => {
  page.mockResolvedValue({ ...value, ...extra });
  await expect(service.page(id, "owner", { ...base, until: stamp })).rejects.toMatchObject({
    code: "INTERNAL_ERROR",
  });
});
it("requires a requested focus to survive the result projection", async () => {
  await expect(service.page(id, "owner", { ...base, focus: messageId })).rejects.toMatchObject({
    code: "INTERNAL_ERROR",
  });
});
