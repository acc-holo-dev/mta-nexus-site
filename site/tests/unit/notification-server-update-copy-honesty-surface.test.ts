import { describe, expect, it } from "vitest";
import { formatNotification } from "../../src/features/notifications/notification-copy";

const reviewCopy = {
  approved: "Approved",
  rejected: "Rejected",
  version: "Version",
  notes: "Notes",
};

/** Wave 103: staff/server publication notices localize through formatNotification. */
describe("notification server update and verification awaiting honesty", () => {
  it("localizes New server update titles while keeping the stored body", () => {
    const notice = {
      title: "New server update",
      message: "Neon Drift: Patch notes",
      data: null,
    };
    expect(formatNotification(notice, reviewCopy, "en")).toEqual({
      title: "New server update",
      message: "Neon Drift: Patch notes",
    });
    expect(formatNotification(notice, reviewCopy, "ru")).toEqual({
      title: "Новость сервера",
      message: "Neon Drift: Patch notes",
    });
  });

  it("localizes generic staff verification awaiting-review notices", () => {
    const notice = {
      title: "New verification request",
      message: "A verification request is awaiting review.",
      data: null,
    };
    expect(formatNotification(notice, reviewCopy, "en")).toEqual({
      title: "New verification request",
      message: "A verification request is awaiting review.",
    });
    expect(formatNotification(notice, reviewCopy, "ru")).toEqual({
      title: "Новая заявка на верификацию",
      message: "Заявка на верификацию ожидает рассмотрения.",
    });
  });
});
