import type { Content } from "@nexus/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  page: vi.fn(),
  directory: vi.fn(),
  viewer: vi.fn(),
  states: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("@nexus/db", () => ({ followWorkspaceRepository: { states: mocks.states } }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: mocks.viewer },
}));
vi.mock("../apps/web/src/lib/services/discovery-service", () => ({
  discoveryService: { page: mocks.page },
}));
vi.mock("../apps/web/src/lib/services/mta-master-directory-service", () => ({
  mtaMasterDirectoryService: { getDirectory: mocks.directory },
  indexMtaObservations: () => () => null,
}));
vi.mock("../apps/web/src/components/product-card", () => ({ ProductCard: () => null }));
vi.mock("../apps/web/src/components/server-card", () => ({ ServerCard: () => null }));
vi.mock("../apps/web/src/components/article-card", () => ({ ArticleCard: () => null }));

import { DirectoryFilters, DirectoryResults } from "../apps/web/src/components/discovery-directory";
import { FollowButton } from "../apps/web/src/components/follow-button";
import { FollowWorkspace } from "../apps/web/src/components/follow-workspace";
import { LocaleProvider } from "../apps/web/src/components/locale-context";
import { parseDiscoverQuery } from "../apps/web/src/lib/discover-query";
import { discoveryCopy } from "../apps/web/src/lib/discovery-copy";
import type { FollowPage } from "../apps/web/src/lib/follow-workspace-contract";
import { followCopy } from "../apps/web/src/lib/follow-workspace-copy";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.viewer.mockResolvedValue(null);
  mocks.states.mockResolvedValue([]);
  mocks.page.mockResolvedValue({ type: "creators", items: [], page: 1, hasMore: false });
});
it.each(["en", "ru"] as const)(
  "renders accessible server filters and preserves them in page links in %s",
  async (locale) => {
    const state = parseDiscoverQuery({
      type: "servers",
      q: "RP",
      verified: "1",
      language: "ru",
      page: "2",
      sort: "name",
    });
    const filters = renderToStaticMarkup(<DirectoryFilters state={state} locale={locale} />);
    expect(filters).toContain('action="/discover"');
    expect(filters).toContain('name="language"');
    expect(filters).toContain('name="verified"');
    expect(filters).toContain(discoveryCopy(locale).filter);
    expect(filters).toContain("rounded-lg");
    expect(filters).toContain("bg-accent");
    mocks.page.mockResolvedValue({ type: "servers", items: [], page: 2, hasMore: true });
    const results = renderToStaticMarkup(await DirectoryResults({ state, locale }));
    expect(results).toContain("page=3");
    expect(results).toContain("language=ru");
    expect(results).toContain("verified=1");
    expect(results).toContain(discoveryCopy(locale).previous);
    expect(mocks.directory).not.toHaveBeenCalled();
  },
);
it("shows a directory read failure as an alert instead of an empty result", async () => {
  mocks.page.mockRejectedValue(new Error("private-database-detail"));
  const html = renderToStaticMarkup(
    await DirectoryResults({ state: parseDiscoverQuery({ type: "organizations" }), locale: "ru" }),
  );
  expect(html).toContain('role="alert"');
  expect(html).toContain(discoveryCopy("ru").unavailable);
  expect(html).not.toContain("private-database-detail");
});
it("renders creator identity without exposing private account fields or interpreting HTML", async () => {
  mocks.page.mockResolvedValue({
    type: "creators",
    items: [
      {
        id: "user",
        username: "builder",
        displayName: "<script>alert(1)</script>",
        bio: "Public biography",
        avatarUrl: null,
        isVerified: false,
      },
    ],
    page: 1,
    hasMore: false,
  });
  const html = renderToStaticMarkup(
    <LocaleProvider locale="en">
      {await DirectoryResults({ state: parseDiscoverQuery({ type: "creators" }), locale: "en" })}
    </LocaleProvider>,
  );
  expect(html).toContain('href="/developers/builder"');
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("<script>");
});
const base = {
  id: "f",
  targetType: "organization" as const,
  targetId: "org",
  createdAt: "2026-10-10T12:00:00.000Z",
  title: "Team",
  description: "Public organization",
  image: null,
  verified: true,
  href: "/organizations/team",
};
it.each(["en", "ru"] as const)(
  "renders all followed target families and removal controls in %s",
  (locale) => {
    const initial: FollowPage = {
      items: [
        base,
        {
          ...base,
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
      <FollowWorkspace initial={initial} query="" locale={locale} />,
    );
    for (const key of ["user", "server", "organization", "product"] as const)
      expect(html).toContain(followCopy(locale)[key]);
    expect(html).toContain('href="/organizations/team"');
    expect(html).toContain(followCopy(locale).unavailableTarget);
    expect(html).toContain(`${followCopy(locale).remove}: Team`);
    expect(html).toContain(followCopy(locale).older);
    expect(html).not.toContain("private-target-marker");
  },
);
it("keeps failed follow reads separate from true empty states", () => {
  const failed = renderToStaticMarkup(<FollowWorkspace initial={null} query="" locale="ru" />);
  expect(failed).toContain('role="alert"');
  expect(failed).not.toContain(followCopy("ru").empty);
  const empty = renderToStaticMarkup(
    <FollowWorkspace
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
    expect(html).toContain("rounded-lg");
    expect(html).not.toContain('aria-pressed="false"');
  },
);
it("reads all grid follow states once and renders each authoritative initial state", async () => {
  mocks.viewer.mockResolvedValue({ id: "actor" });
  mocks.states.mockResolvedValue(["first"]);
  mocks.page.mockResolvedValue({
    type: "creators",
    items: ["first", "second"].map((id) => ({
      id,
      username: id,
      displayName: id,
      bio: "",
      avatarUrl: null,
      isVerified: false,
    })),
    page: 1,
    hasMore: false,
  });
  const html = renderToStaticMarkup(
    <LocaleProvider locale="en">
      {await DirectoryResults({ state: parseDiscoverQuery({ type: "creators" }), locale: "en" })}
    </LocaleProvider>,
  );
  expect(mocks.states).toHaveBeenCalledExactlyOnceWith("actor", "user", ["first", "second"]);
  expect(html).toContain('aria-pressed="true"');
  expect(html).toContain('aria-pressed="false"');
  expect(html).not.toContain("Checking…");
});
it("keeps catalog results visible and follow controls retryable after a state read failure", async () => {
  mocks.viewer.mockResolvedValue({ id: "actor" });
  mocks.states.mockRejectedValue(new Error("private-failure"));
  mocks.page.mockResolvedValue({
    type: "creators",
    items: [
      {
        id: "first",
        username: "first",
        displayName: "Visible creator",
        bio: "",
        avatarUrl: null,
        isVerified: false,
      },
    ],
    page: 1,
    hasMore: false,
  });
  const html = renderToStaticMarkup(
    <LocaleProvider locale="en">
      {await DirectoryResults({ state: parseDiscoverQuery({ type: "creators" }), locale: "en" })}
    </LocaleProvider>,
  );
  expect(html).toContain("Visible creator");
  expect(html).toContain(followCopy("en").retry);
  expect(html).toContain('role="alert"');
  expect(html).not.toContain("private-failure");
});
it.each([
  ["news", "en", "News"],
  ["news", "ru", "Новость"],
  ["update", "en", "Update"],
  ["update", "ru", "Обновление"],
] as const)("localizes %s cards in %s", async (type, locale, label) => {
  const { ArticleCard } = await vi.importActual<
    typeof import("../apps/web/src/components/article-card")
  >("../apps/web/src/components/article-card");
  const article: Content = {
    id: "content",
    slug: "entry",
    title: "Entry",
    body: "Text",
    type,
    authorId: "author",
    status: "published",
    viewCount: 0,
    likeCount: 0,
    commentCount: 0,
    tags: [],
    coverImageUrl: "https://safe.test/cover.png",
    createdAt: new Date("2026-10-10T12:00:00.000Z"),
    updatedAt: new Date("2026-10-10T12:00:00.000Z"),
  };
  const html = renderToStaticMarkup(<ArticleCard article={article} locale={locale} />);
  expect(html).toContain(`>${label}</div>`);
  expect(html).not.toContain(`>${type}</div>`);
});
it.each(["en", "ru"] as const)(
  "renders saved discussions and a focused latest reply link in %s",
  (locale) => {
    const html = renderToStaticMarkup(
      <FollowWorkspace
        locale={locale}
        query=""
        type="content"
        initial={{
          items: [
            {
              ...base,
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
    const html = renderToStaticMarkup(
      <FollowButton
        locale={locale}
        targetType="content"
        targetId="article"
        targetName="Article"
        initial={{ authenticated: true, following: true }}
      />,
    );
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain(followCopy(locale).following);
    expect(html).toContain(`${followCopy(locale).unfollow}: Article`);
    expect(html).toContain("rounded-lg");
    expect(html).toContain("text-accent");
  },
);
