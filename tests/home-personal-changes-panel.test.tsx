import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  HomePersonalChangesPanel,
  type HomePersonalCopy,
} from "../apps/web/src/components/home-personal-changes-panel";
import { getDictionary } from "../apps/web/src/lib/i18n";

vi.mock("@nexus/ui", () => ({
  SectionHeader: ({ title, description }: { title: string; description: string }) => (
    <header>
      <h2>{title}</h2>
      <p>{description}</p>
    </header>
  ),
}));

vi.mock("../apps/web/src/components/home-personal-opt-out", () => ({
  HomePersonalOptOut: () => null,
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
});
