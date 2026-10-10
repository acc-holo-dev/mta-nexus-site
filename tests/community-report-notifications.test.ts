import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  callbacks: [] as (() => Promise<void>)[],
  moderators: vi.fn(),
  dispatch: vi.fn(),
}));
vi.mock("next/server", () => ({
  after: (callback: () => Promise<void>) => mocks.callbacks.push(callback),
}));
vi.mock("@nexus/db", () => ({ userRepository: { listModeratorIds: mocks.moderators } }));
vi.mock("../apps/web/src/lib/services/notification-dispatch-service", () => ({
  dispatchNotificationsBestEffort: mocks.dispatch,
}));
import { queueCommunityReportNotice } from "../apps/web/src/lib/services/community-report-notifications";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.callbacks = [];
  mocks.moderators.mockResolvedValue(["mod-1", "mod-2"]);
  mocks.dispatch.mockResolvedValue({ storageFailed: 0 });
});
it("queues new reports after the response and links staff directly to the case", async () => {
  queueCommunityReportNotice({ id: "report" });
  expect(mocks.dispatch).not.toHaveBeenCalled();
  await mocks.callbacks[0]();
  expect(mocks.dispatch).toHaveBeenCalledWith(
    expect.arrayContaining([
      expect.objectContaining({ recipientId: "mod-1", link: "/admin/reports/report" }),
      expect.objectContaining({ recipientId: "mod-2" }),
    ]),
  );
});
it("sends only a status and private owner link without staff notes or target text", async () => {
  queueCommunityReportNotice({ id: "report", reporterId: "owner", status: "dismissed" });
  await mocks.callbacks[0]();
  expect(mocks.moderators).not.toHaveBeenCalled();
  expect(mocks.dispatch).toHaveBeenCalledWith([
    {
      recipientId: "owner",
      title: "Community report status",
      message: "Report status: dismissed.",
      link: "/workspace/reports/report",
      type: "security",
    },
  ]);
});
it("contains delivery failures after report storage and emits only a safe diagnostic", async () => {
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    mocks.dispatch.mockRejectedValue(new Error("secret SQL"));
    queueCommunityReportNotice({ id: "report", reporterId: "owner", status: "resolved" });
    await expect(mocks.callbacks[0]()).resolves.toBeUndefined();
    expect(JSON.stringify(warning.mock.calls)).not.toContain("secret SQL");
  } finally {
    warning.mockRestore();
  }
});
