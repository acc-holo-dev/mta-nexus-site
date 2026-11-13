import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { ContentFollowControls } from "../site/src/components/content-follow-controls";
import { FollowButton } from "../site/src/components/follow-button";
import { FollowWorkspace } from "../site/src/components/follow-workspace";
import { LocaleProvider } from "../site/src/components/locale-context";
import type { FollowPage } from "../site/src/lib/follow-workspace-contract";
import { followActionCopy, followCopy } from "../site/src/lib/follow-workspace-copy";
import { getDictionary } from "../site/src/lib/i18n";
import { followWorkspaceItemBase } from "./helpers/discovery-follow-surface-harness";

vi.mock("next/navigation", () => ({ usePathname: () => "/discover" }));

it.each(["en", "ru"] as const)(
  "renders all followed target families and removal controls in %s",
  (locale) => {
    const initial: FollowPage = {
      items: [
        followWorkspaceItemBase,
        {
          ...followWorkspaceItemBase,
          id: "missing",
          targetType: "server",
          targetId: "private-target-marker",
          title: null,
          href: null,
          description: null,
          verified: false,
        },
      ],
      hasMore: true,
      nextCursor: '{"id":"f","createdAt":"2026-10-10T12:00:00.000000Z"}',
    };
    const html = renderToStaticMarkup(
      <FollowWorkspace actorId="usr_1" initial={initial} query="" locale={locale} />,
    );
    for (const key of ["user", "server", "organization", "product"] as const)
      expect(html).toContain(followCopy(locale)[key]);
    expect(html).toContain(`<search aria-label="${followCopy(locale).search}"`);
    expect(html).toContain('href="/organizations/team"');
    expect(html).toContain(followCopy(locale).unavailableTarget);
    expect(html).toContain(`${followCopy(locale).remove}: Team`);
    expect(html).toContain(followCopy(locale).muteHelp);
    expect(html).toContain(followCopy(locale).mute24h);
    expect(html).toContain(followCopy(locale).older);
    expect(html).not.toContain("private-target-marker");
    expect(html).toContain("focus-visible:outline-[var(--nexus-accent)]");
  },
);
it("keeps failed follow reads separate from true empty states", () => {
  const failed = renderToStaticMarkup(
    <FollowWorkspace actorId="usr_1" initial={null} query="" locale="ru" />,
  );
  expect(failed).toContain('role="alert"');
  expect(failed).not.toContain(followCopy("ru").empty);
  const empty = renderToStaticMarkup(
    <FollowWorkspace
      actorId="usr_1"
      initial={{ items: [], hasMore: false, nextCursor: null }}
      query=""
      locale="ru"
    />,
  );
  expect(empty).toContain(followCopy("ru").empty);
  expect(empty).toContain('href="/discover"');
});
it.each(["en", "ru"] as const)(
  "renders a disabled checking state before follow state is known in %s",
  (locale) => {
    const html = renderToStaticMarkup(
      <LocaleProvider locale={locale}>
        <FollowButton targetType="user" targetId="user" targetName="Member" />
      </LocaleProvider>,
    );
    expect(html).toContain("disabled");
    expect(html).toContain(followCopy(locale).checking);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("rounded-lg");
    expect(html).not.toContain('aria-pressed="false"');
  },
);
it.each(["en", "ru"] as const)(
  "offers guest login and create-account links for follow controls in %s",
  (locale) => {
    const workspace = getDictionary(locale).workspace;
    const follow = renderToStaticMarkup(
      <LocaleProvider locale={locale}>
        <FollowButton
          targetType="user"
          targetId="user"
          targetName="Member"
          initial={{ authenticated: false, following: false }}
        />
      </LocaleProvider>,
    );
    expect(follow).toContain('href="/auth/login?next=%2Fdiscover"');
    expect(follow).toContain('href="/auth/register?next=%2Fdiscover"');
    expect(follow).toContain(workspace.createAccount);
    const discussion = renderToStaticMarkup(
      <LocaleProvider locale={locale}>
        <ContentFollowControls
          contentId="article"
          title="Article"
          initial={{
            authenticated: false,
            following: false,
            notifyComments: false,
            muted: false,
            mutedUntil: null,
          }}
        />
      </LocaleProvider>,
    );
    expect(discussion).toContain('href="/auth/register?next=%2Fdiscover"');
    expect(discussion).toContain(workspace.createAccount);
  },
);
it("marks content follow controls busy while saved state is loading", () => {
  const html = renderToStaticMarkup(
    <LocaleProvider locale="en">
      <ContentFollowControls contentId="article" title="Article" />
    </LocaleProvider>,
  );
  expect(html).toContain('aria-busy="true"');
});
it.each(["en", "ru"] as const)(
  "renders saved discussions and a focused latest reply link in %s",
  (locale) => {
    const html = renderToStaticMarkup(
      <FollowWorkspace
        actorId="usr_1"
        locale={locale}
        query=""
        type="content"
        initial={{
          items: [
            {
              ...followWorkspaceItemBase,
              id: "discussion",
              targetType: "content",
              targetId: "article",
              href: "/articles/current",
              title: "Current article",
              discussion: {
                replyCount: 8,
                latestId: "reply",
                latestAt: "2026-10-12T00:00:00.000123Z",
              },
            },
          ],
          hasMore: false,
          nextCursor: null,
        }}
      />,
    );
    expect(html).toContain(followCopy(locale).content);
    expect(html).toContain(followCopy(locale).latestReply);
    expect(html).toContain('href="/articles/current?comment=reply#comment-reply"');
    expect(html).not.toContain("source=content");
  },
);
it.each(["en", "ru"] as const)(
  "uses an explicit locale for discussion subscribe controls without requiring a page provider in %s",
  (locale) => {
    const action = followActionCopy(locale, "content");
    const html = renderToStaticMarkup(
      <FollowButton
        locale={locale}
        targetType="content"
        targetId="article"
        targetName="Article"
        initial={{ authenticated: true, actorId: "usr_1", following: true }}
      />,
    );
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain(action.following);
    expect(html).toContain(`${action.unfollow}: Article`);
    expect(html).toContain(action.hint);
    expect(html).toContain(followCopy(locale).muteHelp);
    expect(html).toContain(followCopy(locale).mute24h);
    expect(html).toContain("rounded-lg");
    expect(html).toContain("text-accent");
  },
);
it.each(["en", "ru"] as const)(
  "labels product follow as Save without promising release-watch in %s",
  (locale) => {
    const action = followActionCopy(locale, "product");
    const html = renderToStaticMarkup(
      <FollowButton
        locale={locale}
        targetType="product"
        targetId="resource"
        targetName="Pack"
        initial={{ authenticated: true, actorId: "usr_1", following: false }}
      />,
    );
    expect(html).toContain(action.follow);
    expect(html).toContain(action.hint);
    expect(html).toContain(followCopy(locale).muteHelp);
    expect(html).not.toContain(followCopy(locale).follow);
  },
);
