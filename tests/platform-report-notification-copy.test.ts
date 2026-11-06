import { expect, it } from "vitest";
import { formatNotification } from "../apps/web/src/lib/notification-copy";

const reviewCopy = { approved: "", rejected: "", version: "", notes: "" };

it("localizes staff and reporter platform report notices in RU/EN", () => {
  const staff = formatNotification(
    {
      title: "New report",
      message: "A report is awaiting review.",
    },
    reviewCopy,
    "ru",
  );
  expect(staff.title).toBe("Новая жалоба");
  expect(staff.message).toBe("Жалоба ожидает рассмотрения.");

  const status = formatNotification(
    {
      title: "Platform report status",
      message: "Report status: resolved.",
    },
    reviewCopy,
    "ru",
  );
  expect(status.title).toBe("Статус жалобы платформы");
  expect(status.message).toBe("Жалоба решена.");

  const en = formatNotification(
    {
      title: "Platform report status",
      message: "Report status: dismissed.",
    },
    reviewCopy,
    "en",
  );
  expect(en.title).toBe("Platform report status");
  expect(en.message).toBe("Report status: dismissed.");
});
