import { describe, expect, it } from "vitest";
import { formatNotification } from "../../src/features/notifications/notification-copy";

const reviewCopy = {
  approved: "Approved",
  rejected: "Rejected",
  version: "Version",
  notes: "Notes",
};

/** Waves 103–104: residual inbox title/message gaps localize through formatNotification. */
describe("notification residual inbox copy honesty", () => {
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
      message:
        "A verification request is awaiting review. / Заявка на верификацию ожидает рассмотрения.",
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

  it("localizes password-reset completed security notices", () => {
    const notice = {
      title: "Password reset completed",
      message:
        "Your password was reset and all existing sessions were signed out. / Пароль сброшен, все существующие сессии завершены.",
      data: null,
    };
    expect(formatNotification(notice, reviewCopy, "en")).toEqual({
      title: "Password reset completed",
      message: "Your password was reset and all existing sessions were signed out.",
    });
    expect(formatNotification(notice, reviewCopy, "ru")).toEqual({
      title: "Пароль восстановлен",
      message: "Пароль сброшен, все существующие сессии завершены.",
    });
  });

  it("accepts bilingual slash password-reset titles for Web Push storage", () => {
    const notice = {
      title: "Password reset completed / Пароль восстановлен",
      message:
        "Your password was reset and all existing sessions were signed out. / Пароль сброшен, все существующие сессии завершены.",
      data: null,
    };
    expect(formatNotification(notice, reviewCopy, "ru").title).toBe("Пароль восстановлен");
    expect(formatNotification(notice, reviewCopy, "en").title).toBe("Password reset completed");
  });
});
