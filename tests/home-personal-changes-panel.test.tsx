import type * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  HOME_PERSONAL_CHANGES_HEADING_ID,
  HOME_PERSONAL_CHANGES_SCOPE_NOTE_ID,
  HomePersonalChangesPanel,
  type HomePersonalCopy,
} from "../apps/web/src/components/home-personal-changes-panel";
import { getDictionary } from "../apps/web/src/lib/i18n";

vi.mock("@nexus/ui", () => ({
  SectionHeader: ({
    title,
    description,
    titleId,
    action,
  }: {
    title: string;
    description: string;
    titleId?: string;
    action?: React.ReactNode;
  }) => (
    <header>
      <h2 id={titleId}>{title}</h2>
      <p>{description}</p>
      {action}
    </header>
  ),
}));

vi.mock("../apps/web/src/components/home-personal-opt-out", () => ({
  HomePersonalOptOut: ({ describedBy }: { describedBy?: string }) => (
    <button type="button" aria-describedby={describedBy} />
  ),
}));

function panelCopy(locale: "en" | "ru"): HomePersonalCopy {
  const home = getDictionary(locale).home;
  return {
    title: home.personalTitle,
    description: home.personalDescription,
    scopeNote: home.personalScopeNote,
    empty: home.personalEmpty,
    error: home.personalError,
    partial: home.personalPartial,
    hidden: home.personalHidden,
    hidePreference: home.personalHide,
    showPreference: home.personalShow,
    reasonReleaseWatch: home.personalReasonReleaseWatch,
    reasonDiscussionFollow: home.personalReasonDiscussionFollow,
    reasonReplyToMe: home.personalReasonReplyToMe,
    openInbox: home.personalOpenInbox,
  };
}

describe("HomePersonalChangesPanel", () => {
  it.each(["en", "ru"] as const)(
    "discloses bounded Home scope and inbox as source of truth in %s",
    (locale) => {
      const copy = panelCopy(locale);
      const html = renderToStaticMarkup(
        <HomePersonalChangesPanel
          preference="show"
          copy={copy}
          summary={{
            status: "ok",
            failedSources: [],
            items: [
              {
                id: "n_1",
                reason: "replyToMe",
                title: "Reply waiting",
                href: "/articles/demo",
                createdAt: "2026-10-11T00:00:00.000Z",
              },
            ],
          }}
        />,
      );

      expect(html).toContain(copy.scopeNote);
      expect(html).toMatch(/12|до 12/u);
      expect(html).toMatch(/notification inbox|центре уведомлений/u);
      expect(html).toContain(copy.description);
    },
  );

  it("labels the section and ties the opt-out control to the scope note", () => {
    const copy = panelCopy("en");
    const html = renderToStaticMarkup(
      <HomePersonalChangesPanel
        preference="show"
        copy={copy}
        summary={{ status: "empty", failedSources: [], items: [] }}
      />,
    );

    expect(html).toContain(`aria-labelledby="${HOME_PERSONAL_CHANGES_HEADING_ID}"`);
    expect(html).toContain(`id="${HOME_PERSONAL_CHANGES_HEADING_ID}"`);
    expect(html).toContain(`id="${HOME_PERSONAL_CHANGES_SCOPE_NOTE_ID}"`);
    expect(html).toContain(`aria-describedby="${HOME_PERSONAL_CHANGES_SCOPE_NOTE_ID}"`);
    expect(html).toContain(copy.scopeNote);
  });

  it.each([
    ["empty", "empty"] as const,
    ["error", "error"] as const,
    ["partial", "partial"] as const,
  ])("surfaces the %s state copy", (status, copyKey) => {
    const copy = panelCopy("en");
    const html = renderToStaticMarkup(
      <HomePersonalChangesPanel
        preference="show"
        copy={copy}
        summary={{
          status,
          failedSources: status === "partial" ? ["releaseWatch"] : [],
          items:
            status === "partial"
              ? [
                  {
                    id: "n_1",
                    reason: "releaseWatch",
                    title: "Build shipped",
                    href: "/market/demo",
                    createdAt: "2026-10-11T00:00:00.000Z",
                  },
                ]
              : [],
        }}
      />,
    );

    expect(html).toContain(copy[copyKey]);
    if (status === "error") {
      expect(html).toContain(copy.openInbox);
      expect(html).toContain('href="/notifications?state=unread"');
    }
  });
});
