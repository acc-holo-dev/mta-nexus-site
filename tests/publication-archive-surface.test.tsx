import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AppError } from "@nexus/domain";
import { PublicationFeed } from "../apps/web/src/components/publication-feed";
import { publicationCopy } from "../apps/web/src/lib/publication-feed-copy";
import {
  publicationPageQuery,
  type PublicationPage,
} from "../apps/web/src/lib/publication-feed-contract";
const state = vi.hoisted(() => ({ locale: "en" as "ru" | "en", resolve: vi.fn(), page: vi.fn() }));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => state.locale }));
vi.mock("../apps/web/src/lib/services/publication-feed-service", () => ({
  publicationFeedService: { resolve: state.resolve, page: state.page },
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
import ServerUpdates, { generateMetadata } from "../apps/web/src/app/servers/[slug]/updates/page";
import Loading from "../apps/web/src/app/servers/[slug]/updates/loading";
const cursor = {
  version: 1,
  createdAt: "2026-10-11T00:00:00.123456Z",
  id: "content",
  context: "a".repeat(64),
  direction: "older" as const,
};
const initial: PublicationPage = {
  items: [
    {
      id: "content",
      slug: "article",
      title: "<Title>",
      type: "news",
      excerpt: "<script>secret</script>",
      image: null,
      publishedAt: "2026-10-11T00:00:00.123Z",
      commentCount: 3,
      author: { name: "Writer", username: "writer", avatar: null },
      server: { name: "MTA", href: "/servers/mta" },
      organization: null,
      product: null,
      tags: ["Lua", "MTA & UI"],
    },
  ],
  hasMore: true,
  nextCursor: JSON.stringify(cursor),
  previousCursor: JSON.stringify({ ...cursor, direction: "newer" }),
};
beforeEach(() => {
  vi.clearAllMocks();
  state.locale = "en";
  state.resolve.mockResolvedValue({ id: "server", name: "MTA" });
  state.page.mockResolvedValue(initial);
});
it.each(["en", "ru"] as const)(
  "renders the server archive, author/tag controls, safe summaries and URL navigation in %s",
  async (locale) => {
    state.locale = locale;
    const html = renderToStaticMarkup(
      await ServerUpdates({
        params: Promise.resolve({ slug: "mta" }),
        searchParams: Promise.resolve({
          q: "Lua",
          tag: "MTA & UI",
          author: "writer",
          cursor: JSON.stringify(cursor),
        }),
      }),
    );
    expect(state.resolve).toHaveBeenCalledWith("server", "mta");
    expect(state.page).toHaveBeenCalledWith(
      { kind: "server", id: "server" },
      expect.objectContaining({ query: "Lua", author: "writer", tag: "MTA & UI", cursor }),
    );
    expect(html).toContain(publicationCopy(locale).serverDescription);
    expect(html).toContain('href="/servers/mta"');
    expect(html).toContain('name="author"');
    expect(html).toContain('name="tag"');
    expect(html).not.toContain('value="post"');
    expect(html).not.toContain('name="source"');
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain(publicationCopy(locale).previous);
    const links = [...html.matchAll(/href="([^"]+)"/gu)].map((match) =>
      match[1].replaceAll("&amp;", "&"),
    );
    const pages = links
      .filter((href) => href.startsWith("/servers/mta/updates?"))
      .map((href) => new URL(href, "http://nexus.test"));
    expect(pages.some((url) => url.searchParams.get("cursor") === initial.nextCursor)).toBe(true);
    expect(pages.some((url) => url.searchParams.get("cursor") === initial.previousCursor)).toBe(
      true,
    );
    expect(
      pages
        .filter((url) => url.searchParams.has("cursor"))
        .every(
          (url) =>
            url.searchParams.get("tag") === "MTA & UI" &&
            url.searchParams.get("author") === "writer",
        ),
    ).toBe(true);
    expect(await generateMetadata()).toMatchObject({ title: publicationCopy(locale).serverTitle });
    expect(renderToStaticMarkup(await Loading())).toContain(publicationCopy(locale).loading);
  },
);
it("offers localized latest-page recovery without querying a malformed SSR cursor", async () => {
  state.locale = "ru";
  const html = renderToStaticMarkup(
    await ServerUpdates({
      params: Promise.resolve({ slug: "mta" }),
      searchParams: Promise.resolve({ cursor: "bad", q: "Lua" }),
    }),
  );
  expect(state.page).not.toHaveBeenCalled();
  expect(html).toContain(publicationCopy("ru").invalid);
  expect(html).toContain('href="/servers/mta/updates?q=Lua"');
  expect(html).not.toContain(publicationCopy("ru").empty);
});
it.each([{ q: "a\u0000b" }, { author: "writer\nname" }, { tag: "a\nb" }, { q: "x".repeat(101) }])(
  "safely renders malformed raw filters %j without querying or crashing",
  async (searchParams) => {
    const html = renderToStaticMarkup(
      await ServerUpdates({
        params: Promise.resolve({ slug: "mta" }),
        searchParams: Promise.resolve(searchParams),
      }),
    );
    expect(html).toContain(publicationCopy("en").invalid);
    expect(state.page).not.toHaveBeenCalled();
  },
);
it("does not load publications for a private, suspended or missing server", async () => {
  state.resolve.mockRejectedValue(new AppError("private endpoint", 404, "NOT_FOUND"));
  await expect(ServerUpdates({ params: Promise.resolve({ slug: "private" }) })).rejects.toThrow(
    "NOT_FOUND",
  );
  expect(state.page).not.toHaveBeenCalled();
});
it("keeps operational errors safe and distinguishes a tag-filtered empty page", async () => {
  state.page.mockRejectedValue(new Error("Secret SQL"));
  const html = renderToStaticMarkup(
    await ServerUpdates({ params: Promise.resolve({ slug: "mta" }) }),
  );
  expect(html).toContain(publicationCopy("en").error);
  expect(html).not.toContain("Secret SQL");
  const empty = renderToStaticMarkup(
    <PublicationFeed
      initial={{ items: [], hasMore: false, nextCursor: null }}
      filters={{ ...publicationPageQuery(), tag: "Lua" }}
      locale="en"
      path="/servers/mta/updates"
      server
    />,
  );
  expect(empty).toContain(publicationCopy("en").emptyFiltered);
});
