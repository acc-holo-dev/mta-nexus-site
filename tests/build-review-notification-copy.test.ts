import { expect, it } from "vitest";
import type { Notification } from "@nexus/domain";
import { formatNotification } from "../apps/web/src/lib/notification-copy";
import { getDictionary } from "../apps/web/src/lib/i18n";
const notice = {
  title: "Fallback",
  message: "Stored message",
  data: {
    kind: "build_review" as const,
    decision: "approve" as const,
    resourceTitle: "Test resource",
    version: "1.0.0",
    notes: "Use the manifest.",
  },
};
it.each(["en", "ru"] as const)(
  "localizes a review title, version and moderator comment in %s",
  (locale) => {
    const copy = getDictionary(locale).buildReviewNotifications;
    const result = formatNotification(notice, copy);
    expect(result.title).toBe(copy.approved);
    expect(result.message).toBe(
      `Test resource · ${copy.version} 1.0.0\n${copy.notes}: Use the manifest.`,
    );
    expect(
      formatNotification(
        { ...notice, data: { ...notice.data, decision: "reject", notes: "" } },
        copy,
      ),
    ).toEqual({ title: copy.rejected, message: `Test resource · ${copy.version} 1.0.0` });
  },
);
it.each([
  undefined,
  null,
  {},
  { kind: "unknown" },
  { ...notice.data, decision: "invalid" },
  { ...notice.data, notes: null },
])("preserves stored text for legacy or malformed payload %s", (data) => {
  expect(
    formatNotification(
      { title: notice.title, message: notice.message, data } as Notification,
      getDictionary("en").buildReviewNotifications,
    ),
  ).toEqual({ title: "Fallback", message: "Stored message" });
});
