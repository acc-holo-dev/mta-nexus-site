import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NotificationCenterTabs } from "../apps/web/src/components/notification-center-tabs";

describe("NotificationCenterTabs keyboard focus", () => {
  it("renders reading-state filters with a visible focus ring", () => {
    const html = renderToStaticMarkup(
      createElement(NotificationCenterTabs, {
        state: "all",
        filters: { query: "", state: "all", category: "all" },
        labels: { title: "Notifications", all: "All", unread: "Unread", read: "Read" },
        children: null,
      }),
    );

    expect(html).toContain('href="/notifications?state=unread"');
    expect(html).toContain("focus-visible:ring-2");
  });
});
