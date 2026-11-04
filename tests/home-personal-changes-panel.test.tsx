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

vi.mock("@nexus/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@nexus/ui")>();
  return {
    ...actual,
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
  };
});

vi.mock("../apps/web/src/components/home-personal-opt-out", () => ({
  HomePersonalOptOut: ({ describedBy }: { describedBy?: string }) => (
    <button type="button" aria-describedby={describedBy} className="min-h-11" />
  ),
}));

function panelCopy(locale: "en" | "ru"): HomePersonalCopy {
  const home = getDictionary(locale).home;
  return {
    title: home.personalTitle,
    description: home.personalDescription,
    scopeNote: home.personalScopeNote,
    empty: home.personalEmpty,
    emptyHint: home.personalEmptyHint,
    error: home.personalError,
    retry: home.personalRetry,
    partial: home.personalPartial,
    hidden: home.personalHidden,
    hiddenHint: home.personalHiddenHint,
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
      expect(html).toContain("overflow-x-clip");
      expect(html).toContain("min-w-0");
      expect(html).toContain("min-h-11");
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

  it.each(["en", "ru"] as const)(
    "renders EmptyState title and description for an empty personal strip in %s",
    (locale) => {
      const copy = panelCopy(locale);
      const html = renderToStaticMarkup(
        <HomePersonalChangesPanel
          preference="show"
          copy={copy}
          summary={{ status: "empty", failedSources: [], items: [] }}
        />,
      );

      expect(copy.empty).not.toBe(copy.emptyHint);
      expect(html).toContain(copy.empty);
      expect(html).toContain(copy.emptyHint);
      expect(html).toContain(copy.openInbox);
      expect(html).toContain('href="/notifications?state=unread"');
      expect(html).toContain("overflow-x-clip");
      expect(html).toContain("min-h-11");
      expect(html).not.toContain('role="alert"');
      expect(html).not.toContain(copy.error);
    },
  );

  it.each(["en", "ru"] as const)(
    "renders EmptyState title and description when personal changes are hidden in %s",
    (locale) => {
      const copy = panelCopy(locale);
      const html = renderToStaticMarkup(
        <HomePersonalChangesPanel
          preference="hide"
          copy={copy}
          summary={{ status: "hidden", failedSources: [], items: [] }}
        />,
      );

      expect(copy.hidden).not.toBe(copy.hiddenHint);
      expect(html).toContain(copy.hidden);
      expect(html).toContain(copy.hiddenHint);
      expect(html).toContain("overflow-x-clip");
      expect(html).not.toContain('role="alert"');
      expect(html).not.toContain(copy.empty);
    },
  );

  it.each(["en", "ru"] as const)(
    "shows ErrorState recovery with retry for personal load failure in %s",
    (locale) => {
      const copy = panelCopy(locale);
      const html = renderToStaticMarkup(
        <HomePersonalChangesPanel
          preference="show"
          copy={copy}
          summary={{
            status: "error",
            failedSources: ["releaseWatch", "discussionFollow", "replyToMe"],
            items: [],
          }}
        />,
      );

      expect(html).toContain('role="alert"');
      expect(html).toContain(copy.error);
      expect(html).toContain(copy.retry);
      expect(html).toContain(copy.openInbox);
      expect(html).toContain('href="/"');
      expect(html).toContain('href="/notifications?state=unread"');
      expect(html).toContain("overflow-x-clip");
      expect(html).toContain("min-h-11");
      expect(html).not.toContain(copy.empty);
      expect(html).not.toContain(copy.emptyHint);
    },
  );

  it("surfaces the partial state copy with clipped item links", () => {
    const copy = panelCopy("en");
    const html = renderToStaticMarkup(
      <HomePersonalChangesPanel
        preference="show"
        copy={copy}
        summary={{
          status: "partial",
          failedSources: ["releaseWatch"],
          items: [
            {
              id: "n_1",
              reason: "releaseWatch",
              title: "Build shipped",
              href: "/market/demo",
              createdAt: "2026-10-11T00:00:00.000Z",
            },
          ],
        }}
      />,
    );

    expect(html).toContain(copy.partial);
    expect(html).toContain("Build shipped");
    expect(html).toContain("overflow-x-clip");
    expect(html).toContain("min-h-11");
    expect(html).not.toContain('role="alert"');
  });
});
