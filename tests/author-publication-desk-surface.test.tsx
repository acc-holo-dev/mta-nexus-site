import { AppError } from "@nexus/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  locale: "en" as "en" | "ru",
  actor: { id: "actor" } as { id: string } | null,
  session: vi.fn(),
  desk: vi.fn(),
  history: vi.fn(),
  feed: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  usePathname: () => "/workspace/content",
}));
vi.mock("../site/src/lib/i18n-server", () => ({ getRequestLocale: async () => state.locale }));
vi.mock("../site/src/lib/services/auth-service", () => ({
  authService: { getSession: state.session },
}));
vi.mock("../site/src/lib/services/author-content-service", () => ({
  authorContentService: { desk: state.desk, history: state.history },
}));
vi.mock("../site/src/lib/services/publication-feed-service", () => ({
  publicationFeedService: { page: state.feed },
}));

import History, {
  generateMetadata as historyMetadata,
} from "../site/src/app/workspace/content/[id]/history/page";
import Loading from "../site/src/app/workspace/content/loading";
import Desk, { generateMetadata as deskMetadata } from "../site/src/app/workspace/content/page";
import Following from "../site/src/app/workspace/feed/page";
import { FollowWorkspace } from "../site/src/components/follow-workspace";
import { PublicationFeed } from "../site/src/components/publication-feed";
import { authorPublicationDeskCopy } from "../site/src/lib/author-publication-desk-copy";
import { publicationCopy } from "../site/src/lib/publication-feed-copy";

const revision = "2026-10-11T00:00:00.123456Z";
const cursor = JSON.stringify({
  version: 1,
  createdAt: revision,
  id: "article",
  context: "a".repeat(64),
  direction: "older",
});
beforeEach(() => {
  vi.clearAllMocks();
  state.locale = "en";
  state.actor = { id: "actor" };
  state.session.mockImplementation(async () => state.actor);
  state.desk.mockResolvedValue({
    items: [
      {
        id: "article",
        slug: "article",
        title: "<Private title>",
        type: "article",
        status: "archived",
        excerpt: "<script>body</script>",
        updatedAt: revision,
        commentCount: 3,
        source: "organization",
        organization: { name: "Team", href: "/organizations/team" },
        server: null,
        recoverable: true,
        tags: ["Lua & MTA"],
      },
    ],
    olderCursor: cursor,
    newerCursor: JSON.stringify({ ...JSON.parse(cursor), direction: "newer" }),
  });
  state.history.mockResolvedValue({
    item: {
      id: "article",
      title: "<Private title>",
      status: "archived",
      revision,
      recoverable: true,
    },
    events: [
      {
        id: "audit",
        kind: "archived",
        actor: "moderation",
        from: "published",
        to: "archived",
        createdAt: revision,
      },
    ],
    olderCursor: cursor,
  });
  state.feed.mockResolvedValue({
    items: [],
    hasMore: false,
    nextCursor: null,
    previousCursor: null,
  });
});
it.each(["en", "ru"] as const)(
  "renders private searchable author summaries, context links and exact navigation in %s",
  async (locale) => {
    state.locale = locale;
    const html = renderToStaticMarkup(
      await Desk({
        searchParams: Promise.resolve({
          q: " Lua ",
          status: "archived",
          source: "organization",
          type: "article",
          tag: "MTA",
        }),
      }),
    );
    expect(state.desk).toHaveBeenCalledWith(
      { id: "actor" },
      expect.objectContaining({
        query: "Lua",
        status: "archived",
        source: "organization",
        type: "article",
        tag: "MTA",
      }),
    );
    expect(html).toContain('action="/workspace/content"');
    expect(html).toContain(`<search aria-label="${authorPublicationDeskCopy(locale).filters}"`);
    expect(html).toContain("rounded-lg");
    expect(html).toContain("bg-accent");
    expect(html).toContain("&lt;Private title&gt;");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain('value="resource"');
    expect(html).toContain('href="/workspace/content/article/history"');
    expect(html).toContain('href="/organizations/team"');
    expect(html).toContain(`dateTime="${revision}"`);
    expect(html).toContain("UTC");
    expect(html).toContain(authorPublicationDeskCopy(locale).live);
    const links = [...html.matchAll(/href="([^"]+)"/gu)].map(
      (match) => new URL(match[1].replaceAll("&amp;", "&"), "https://nexus.test"),
    );
    const page = links.find((url) => url.searchParams.get("cursor") === cursor);
    expect(page?.searchParams.get("status")).toBe("archived");
    expect(page?.searchParams.get("tag")).toBe("MTA");
    expect(page?.searchParams.has("page")).toBe(false);
    expect(await deskMetadata()).toMatchObject({ robots: { index: false, follow: false } });
    const loadingCopy = authorPublicationDeskCopy(locale);
    const loadingHtml = renderToStaticMarkup(await Loading());
    expect(loadingHtml).toContain('aria-busy="true"');
    expect(loadingHtml).toContain('id="publication-desk-loading-heading"');
    expect(loadingHtml).toContain('aria-labelledby="publication-desk-loading-heading"');
    expect(loadingHtml).toContain(`>${loadingCopy.title}<`);
    expect(loadingHtml).toContain(loadingCopy.loading);
    expect(loadingHtml).toContain("overflow-x-clip");
    expect(loadingHtml).toContain("min-w-0");
  },
);
it.each(["en", "ru"] as const)(
  "renders only safe status history and the proven exact-version action in %s",
  async (locale) => {
    state.locale = locale;
    const html = renderToStaticMarkup(
      await History({ params: Promise.resolve({ id: "article" }) }),
    );
    expect(state.history).toHaveBeenCalledWith("article", { id: "actor" }, { cursor: undefined });
    expect(html).toContain(authorPublicationDeskCopy(locale).actorModeration);
    expect(html).toContain(authorPublicationDeskCopy(locale).restore);
    expect(html).toContain("rounded-lg");
    expect(html).toContain("text-accent");
    expect(html).toContain(`dateTime="${revision}"`);
    expect(html).toContain('href="/workspace/content/article"');
    expect(html).toContain("cursor=");
    expect(await historyMetadata()).toMatchObject({ robots: { index: false, follow: false } });
  },
);
it("never offers restoration for an unproven archive", async () => {
  state.history.mockResolvedValue({
    item: { id: "article", title: "Title", status: "archived", revision, recoverable: false },
    events: [],
    olderCursor: null,
  });
  const html = renderToStaticMarkup(await History({ params: Promise.resolve({ id: "article" }) }));
  expect(html).not.toContain("aria-busy=");
  expect(html).toContain("draft=publication");
  expect(html).toContain("subject=Title");
  expect(html).toContain(authorPublicationDeskCopy("en").historyEmpty);
});
it("rejects unknown and duplicate private filters before reading publication data", async () => {
  const desk = renderToStaticMarkup(
    await Desk({ searchParams: Promise.resolve({ status: ["draft", "published"] }) }),
  );
  const history = renderToStaticMarkup(
    await History({
      params: Promise.resolve({ id: "article" }),
      searchParams: Promise.resolve({ actorId: "foreign" }),
    }),
  );
  expect(desk).toContain(authorPublicationDeskCopy("en").invalid);
  expect(history).toContain(authorPublicationDeskCopy("en").invalid);
  expect(state.desk).not.toHaveBeenCalled();
  expect(state.history).not.toHaveBeenCalled();
});
it("requires a session on the desk and history without exposing target titles", async () => {
  state.actor = null;
  const deskGuest = renderToStaticMarkup(await Desk({}));
  expect(deskGuest).toContain('href="/auth/login?next=%2Fworkspace%2Fcontent"');
  expect(deskGuest).toContain('href="/auth/register?next=%2Fworkspace%2Fcontent"');
  const historyGuest = renderToStaticMarkup(
    await History({ params: Promise.resolve({ id: "article" }) }),
  );
  expect(historyGuest).toContain(
    'href="/auth/login?next=%2Fworkspace%2Fcontent%2Farticle%2Fhistory"',
  );
  expect(historyGuest).toContain(
    'href="/auth/register?next=%2Fworkspace%2Fcontent%2Farticle%2Fhistory"',
  );
  for (const page of [
    await Desk({}),
    await History({ params: Promise.resolve({ id: "article" }) }),
  ]) {
    expect(renderToStaticMarkup(page)).not.toContain("Private title");
  }
  expect(state.desk).not.toHaveBeenCalled();
  expect(state.history).not.toHaveBeenCalled();
});
it.each(["en", "ru"] as const)(
  "distinguishes an empty filtered desk from an empty author library in %s",
  async (locale) => {
    state.locale = locale;
    const copy = authorPublicationDeskCopy(locale);
    expect(copy.emptyFiltered).not.toBe(copy.empty);
    expect(copy.emptyFilteredHint).not.toBe(copy.emptyHint);
    state.desk.mockResolvedValue({ items: [], olderCursor: null, newerCursor: null });
    const empty = renderToStaticMarkup(await Desk({ searchParams: Promise.resolve({}) }));
    expect(empty).toContain(copy.empty);
    expect(empty).toContain(copy.emptyHint);
    expect(empty).not.toContain(copy.emptyFiltered);
    expect(empty).toContain("overflow-x-clip");
    expect(empty).toContain('href="/workspace/content/new"');
    const filtered = renderToStaticMarkup(
      await Desk({ searchParams: Promise.resolve({ status: "draft" }) }),
    );
    expect(filtered).toContain(copy.emptyFiltered);
    expect(filtered).toContain(copy.emptyFilteredHint);
    expect(filtered).not.toContain(copy.empty);
    expect(filtered).toContain(copy.reset);
    expect(filtered).toContain('href="/workspace/content"');
  },
);
it("distinguishes auth, unavailable and forbidden-target errors from empty histories", async () => {
  state.session.mockRejectedValueOnce(Error("PRIVATE_AUTH_DETAILS"));
  const desk = renderToStaticMarkup(await Desk({}));
  expect(desk).toContain('href="/auth/login?next=%2Fworkspace%2Fcontent"');
  expect(desk).not.toContain("PRIVATE_AUTH_DETAILS");
  expect(desk).not.toContain(authorPublicationDeskCopy("en").empty);
  expect(desk).not.toContain(authorPublicationDeskCopy("en").title);
  state.history.mockRejectedValueOnce(new AppError("PRIVATE_TITLE", 404, "NOT_FOUND"));
  const history = renderToStaticMarkup(
    await History({ params: Promise.resolve({ id: "article" }) }),
  );
  expect(history).toContain('role="alert"');
  expect(history).toContain('href="/workspace/content/article/history"');
  expect(history).toContain("overflow-x-clip");
  expect(history).not.toContain("PRIVATE_TITLE");
  expect(history).not.toContain(authorPublicationDeskCopy("en").historyEmpty);
});
it.each(["en", "ru"] as const)(
  "offers ErrorState retry on desk load failure and EmptyState on empty history in %s",
  async (locale) => {
    state.locale = locale;
    const copy = authorPublicationDeskCopy(locale);
    state.desk.mockRejectedValueOnce(new AppError("PRIVATE_DESK", 500, "INTERNAL_ERROR"));
    const desk = renderToStaticMarkup(await Desk({ searchParams: Promise.resolve({}) }));
    expect(desk).toContain('role="alert"');
    expect(desk).toContain(copy.unavailable);
    expect(desk).toContain('href="/workspace/content"');
    expect(desk).not.toContain("PRIVATE_DESK");
    expect(desk).not.toContain(copy.empty);
    state.history.mockResolvedValueOnce({
      item: { id: "article", title: "Title", status: "draft", revision, recoverable: false },
      events: [],
      olderCursor: null,
    });
    const history = renderToStaticMarkup(
      await History({ params: Promise.resolve({ id: "article" }) }),
    );
    expect(history).toContain(copy.historyEmpty);
    expect(history).toContain(copy.historyEmptyHint);
    expect(history).toContain("overflow-x-clip");
  },
);
it.each(["en", "ru"] as const)(
  "retains one selected follow through forms and pagination and offers explicit broader navigation in %s",
  (locale) => {
    const filters = {
      query: "lua",
      source: "server" as const,
      target: "selected",
      type: undefined,
      cursor: undefined,
    };
    const html = renderToStaticMarkup(
      <PublicationFeed
        initial={{ items: [], hasMore: true, nextCursor: cursor, previousCursor: null }}
        filters={filters}
        locale={locale}
        path="/workspace/feed"
        following
      />,
    );
    expect(html).toContain('type="hidden" name="target" value="selected"');
    expect(html).toContain('type="hidden" name="source" value="server"');
    expect(html).not.toContain('<select name="source"');
    expect(html).toContain(publicationCopy(locale).emptyTarget);
    expect(html).toContain(publicationCopy(locale).clearTarget);
    const links = [...html.matchAll(/href="([^"]+)"/gu)].map(
      (match) => new URL(match[1].replaceAll("&amp;", "&"), "https://nexus.test"),
    );
    expect(
      links.find((url) => url.searchParams.get("cursor") === cursor)?.searchParams.get("target"),
    ).toBe("selected");
    expect(
      links.some(
        (url) => url.searchParams.get("source") === "server" && !url.searchParams.has("target"),
      ),
    ).toBe(true);
  },
);
it("links available noncommercial follows to their own feeds while unavailable targets retain recovery controls", () => {
  const items = (["user", "organization", "server", "product"] as const).map((targetType) => ({
    id: `follow_${targetType}`,
    targetId: targetType,
    targetType,
    notifyComments: false,
    title: "Title",
    description: null,
    image: null,
    verified: false,
    createdAt: revision,
    mutedUntil: null,
    href:
      targetType === "product"
        ? "/market/product"
        : `/${targetType === "user" ? "users" : targetType === "organization" ? "organizations" : "servers"}/${targetType}`,
  }));
  const html = renderToStaticMarkup(
    <FollowWorkspace
      actorId="usr_1"
      initial={{
        items: [...items, { ...items[0], id: "unavailable", targetId: "hidden", href: null }],
        hasMore: false,
        nextCursor: null,
      }}
      locale="en"
      query=""
    />,
  );
  for (const source of ["user", "organization", "server"])
    expect(html).toContain(`source=${source}&amp;target=${source}`);
  expect(html).not.toContain("target=product");
  expect(html).not.toContain("target=hidden");
});
it("isolates a selected feed to the signed-in actor and hides auth failures", async () => {
  await Following({ searchParams: Promise.resolve({ source: "server", target: "selected" }) });
  expect(state.feed).toHaveBeenCalledWith(
    { kind: "following", actorId: "actor" },
    expect.objectContaining({ source: "server", target: "selected" }),
  );
  state.session.mockRejectedValueOnce(Error("PRIVATE_AUTH_DETAILS"));
  const html = renderToStaticMarkup(await Following({}));
  expect(html).toContain('role="alert"');
  expect(html).not.toContain("PRIVATE_AUTH_DETAILS");
  expect(html).toContain('href="/workspace/feed"');
});
