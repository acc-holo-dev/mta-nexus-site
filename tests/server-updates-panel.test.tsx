import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getDictionary } from "../apps/web/src/lib/i18n";

vi.mock("../apps/web/src/components/article-card", () => ({
  ArticleCard: ({
    article,
    locale,
  }: {
    article: { slug: string; title: string };
    locale: string;
  }) => (
    <a
      data-testid="article-card"
      data-locale={locale}
      href={`/articles/${article.slug}`}
    >
      {article.title}
    </a>
  ),
}));

import { ServerUpdatesPanel } from "../apps/web/src/components/server-updates-panel";

describe("server updates panel behavior", () => {
  it.each(["en", "ru"] as const)(
    "distinguishes unavailable and empty feeds in %s",
    (locale) => {
      const copy = getDictionary(locale).serverUpdates;

      const unavailable = renderToStaticMarkup(
        <ServerUpdatesPanel
          updates={null}
          locale={locale}
        />,
      );
      expect(unavailable).toContain(copy.title);
      expect(unavailable).toContain(copy.description);
      expect(unavailable).toContain(copy.moderated);
      expect(unavailable).toContain(copy.unavailable);
      expect(unavailable).not.toContain(copy.empty);

      const empty = renderToStaticMarkup(
        <ServerUpdatesPanel
          updates={[]}
          locale={locale}
        />,
      );
      expect(empty).toContain(copy.empty);
      expect(empty).not.toContain(copy.unavailable);
    },
  );

  it("renders every supplied moderated update through ArticleCard", () => {
    const updates = [
      {
        id: "cnt_1",
        slug: "first-update",
        title: "First update",
      },
      {
        id: "cnt_2",
        slug: "second-update",
        title: "Second update",
      },
    ] as never;

    const markup = renderToStaticMarkup(
      <ServerUpdatesPanel updates={updates} locale="en" />,
    );

    expect(
      (markup.match(/data-testid="article-card"/gu) ?? []).length,
    ).toBe(2);
    expect(markup).toContain('href="/articles/first-update"');
    expect(markup).toContain('href="/articles/second-update"');
    expect(markup).toContain('data-locale="en"');
  });
});
