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

import { queueCommunityReportNotice } from "../apps/web/src/lib/services/community-report-notifications";

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
it("contains delivery failures after report storage and emits only a safe diagnostic", async () => {
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    mocks.dispatch.mockRejectedValue(new Error("secret SQL"));
    queueCommunityReportNotice({ id: "report" });
    await expect(mocks.callbacks[0]()).resolves.toBeUndefined();
    expect(JSON.stringify(warning.mock.calls)).not.toContain("secret SQL");
  } finally {
    warning.mockRestore();
  }
});

it("contains deferred registration failure after a report submission", () => {
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    mocks.registrationFails = true;
    expect(() => queueCommunityReportNotice({ id: "report" })).not.toThrow();
    expect(JSON.stringify(warning.mock.calls)).toContain(
      "community_report.notification_registration_failed",
    );
    expect(JSON.stringify(warning.mock.calls)).not.toContain("PRIVATE_REGISTRATION_FAILURE");
    expect(mocks.dispatch).not.toHaveBeenCalled();
  } finally {
    warning.mockRestore();
  }
});
