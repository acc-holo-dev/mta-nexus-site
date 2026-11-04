import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NotificationCenterTabs } from "../apps/web/src/components/notification-center-tabs";

describe("NotificationCenterTabs keyboard focus", () => {
  it("renders reading-state filters with a visible focus ring", () => {
    const html = renderToStaticMarkup(
      <NotificationCenterTabs
        state="all"
        filters={{ query: "", state: "all", category: "all" }}
        labels={{
          title: "Notification center",
          readingState: "Reading filters",
          all: "All",
          unread: "Unread",
          read: "Read",
        }}
      >
        {null}
      </NotificationCenterTabs>,
    );

    expect(html).toContain('aria-label="Reading filters"');
    expect(html).not.toContain('aria-label="Notification center"');
    expect(html).toContain('href="/notifications?state=unread"');
    expect(html).toContain("focus-visible:outline-2");
    expect(html).toContain("focus-visible:outline-[var(--nexus-accent)]");
  });

  it("falls back to the page title when readingState is omitted", () => {
    const html = renderToStaticMarkup(
      <NotificationCenterTabs
        state="unread"
        labels={{ title: "Notification center", all: "All", unread: "Unread", read: "Read" }}
      >
        {null}
      </NotificationCenterTabs>,
    );
    expect(html).toContain('aria-label="Notification center"');
  });
});
