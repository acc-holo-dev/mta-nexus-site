import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  callbacks: [] as (() => Promise<void>)[],
  moderators: vi.fn(),
  dispatch: vi.fn(),
  registrationFails: false,
}));
vi.mock("next/server", () => ({
  after: (callback: () => Promise<void>) => {
    if (mocks.registrationFails) throw Error("PRIVATE_REGISTRATION_FAILURE");
    return mocks.callbacks.push(callback);
  },
}));
vi.mock("@nexus/db", () => ({ userRepository: { listModeratorIds: mocks.moderators } }));
vi.mock("../apps/web/src/lib/services/notification-dispatch-service", () => ({
  dispatchNotificationsBestEffort: mocks.dispatch,
}));

import {
  queueCommunityReportBatchNotices,
  queueCommunityReportNotice,
} from "../apps/web/src/lib/services/community-report-notifications";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.callbacks = [];
  mocks.registrationFails = false;
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

it("dispatches bounded selected-report statuses in one deferred batch without moderator fanout", async () => {
  queueCommunityReportBatchNotices([
    { id: "a", reporterId: "first", status: "resolved" },
    { id: "b", reporterId: "second", status: "dismissed" },
  ]);
  expect(mocks.callbacks).toHaveLength(1);
  expect(mocks.dispatch).not.toHaveBeenCalled();
  await mocks.callbacks[0]();
  expect(mocks.dispatch).toHaveBeenCalledTimes(1);
  expect(mocks.moderators).not.toHaveBeenCalled();
  expect(mocks.dispatch).toHaveBeenCalledWith([
    expect.objectContaining({
      recipientId: "first",
      link: "/workspace/reports/a",
      message: "Report status: resolved.",
    }),
    expect.objectContaining({ recipientId: "second", link: "/workspace/reports/b" }),
  ]);
  expect(() => queueCommunityReportBatchNotices([])).toThrow(RangeError);
});

it("contains deferred registration failure without turning a stored decision into a failed response", () => {
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    mocks.registrationFails = true;
    expect(() =>
      queueCommunityReportBatchNotices([{ id: "report", reporterId: "owner", status: "resolved" }]),
    ).not.toThrow();
    expect(JSON.stringify(warning.mock.calls)).toContain(
      "community_report.notification_registration_failed",
    );
    expect(JSON.stringify(warning.mock.calls)).not.toContain("PRIVATE_REGISTRATION_FAILURE");
    expect(mocks.dispatch).not.toHaveBeenCalled();
  } finally {
    warning.mockRestore();
  }
});
