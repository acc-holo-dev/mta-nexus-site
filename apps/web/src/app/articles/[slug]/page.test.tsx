import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

import type { Content } from "@nexus/domain";
import { createContentSchema } from "@nexus/validation";

const state = vi.hoisted(() => ({ cover: "", locale: "en" as "en" | "ru" }));
const article = () =>
  ({
    id: "article",
    slug: "guide",
    title: "Guide",
    body: "A useful guide to resources",
    type: "article",
    tags: [],
    authorId: "author",
    createdAt: new Date("2026-01-01"),
    coverImageUrl: state.cover,
    likeCount: 0,
    viewCount: 1,
  }) as unknown as Content;
vi.mock("../../../lib/services/content-service", () => ({
  contentService: {
    getArticleBySlug: async () => article(),
    pageDiscussion: async () => ({ items: [], hasMore: false, nextCursor: null }),
  },
}));
const follow = vi.hoisted(() => ({
  contentStates: vi.fn(async () => []),
  muteState: vi.fn(async () => ({ muted: false, mutedUntil: null })),
  session: null as null | { id: string; role: string },
}));
vi.mock("@nexus/db", () => ({
  followWorkspaceRepository: {
    contentStates: follow.contentStates,
    muteState: follow.muteState,
  },
}));
vi.mock("../../../lib/services/auth-service", () => ({
  authService: {
    getUserById: async () => null,
    getSession: async () => follow.session,
  },
}));
vi.mock("../../../lib/i18n-server", () => ({ getRequestLocale: async () => state.locale }));
vi.mock("../../../components/content-discussion", () => ({
  ContentDiscussion: (props: { followInitial?: unknown }) => (
    <div data-follow-initial={JSON.stringify(props.followInitial ?? null)} />
  ),
}));
vi.mock("../../../lib/services/content-reaction-service", () => ({
  contentReactionService: {
    state: async () => ({
      contentId: "article",
      slug: "guide",
      authenticated: false,
      self: false,
      reaction: null,
      counts: { helpful: 0, thanks: 0, insight: 0 },
    }),
  },
}));

import { ArticleCard } from "../../../components/article-card";
import Page, { generateMetadata } from "./page";

const input = () => ({ params: Promise.resolve({ slug: "guide" }) });
beforeEach(() => {
  state.cover = "";
  state.locale = "en";
  follow.session = null;
  follow.contentStates.mockReset();
  follow.muteState.mockReset();
  follow.contentStates.mockResolvedValue([]);
  follow.muteState.mockResolvedValue({ muted: false, mutedUntil: null });
});
it.each([
  "javascript:alert(1)",
  "data:image/svg+xml,bad",
  "https://user:pass@example.com/image.png",
  "https://example.com/\nimage.png",
])("rejects new and hides stored unsafe cover %s", async (cover) => {
  state.cover = cover;
  expect(createContentSchema.safeParse({ ...article(), status: "draft" }).success).toBe(false);
  expect(renderToStaticMarkup(<ArticleCard article={article()} />)).not.toContain("<img");
  expect(renderToStaticMarkup(await Page(input()))).not.toContain("<img");
  expect((await generateMetadata(input())).openGraph).toMatchObject({ images: undefined });
});
it.each(["en", "ru"] as const)(
  "preserves safe covers in card, page and metadata in %s",
  async (locale) => {
    state.locale = locale;
    state.cover = "https://example.com/cover.png";
    expect(createContentSchema.safeParse(article()).success).toBe(true);
    expect(renderToStaticMarkup(<ArticleCard article={article()} locale={locale} />)).toContain(
      'src="https://example.com/cover.png"',
    );
    expect(renderToStaticMarkup(await Page(input()))).toContain(
      'src="https://example.com/cover.png"',
    );
    expect((await generateMetadata(input())).openGraph).toMatchObject({
      images: [{ url: state.cover }],
    });
  },
);
it("supports omitted or cleared covers", async () => {
  expect(createContentSchema.safeParse({ ...article(), coverImageUrl: undefined }).success).toBe(
    true,
  );
  expect(createContentSchema.safeParse(article()).success).toBe(true);
  expect(renderToStaticMarkup(await Page(input()))).not.toContain("<img");
});
it("clips the article detail shell and keeps a touch-sized back control", async () => {
  const html = renderToStaticMarkup(await Page(input()));
  expect(html).toContain("min-w-0 max-w-4xl space-y-8 overflow-x-clip");
  expect(html).toContain("min-h-11");
  expect(html).toContain('href="/articles"');
});
it("SSR-hydrates guest follow controls without querying mute state", async () => {
  const html = renderToStaticMarkup(await Page(input()));
  expect(follow.contentStates).not.toHaveBeenCalled();
  expect(follow.muteState).not.toHaveBeenCalled();
  expect(html).toContain(
    'data-follow-initial="{&quot;authenticated&quot;:false,&quot;following&quot;:false,&quot;notifyComments&quot;:false,&quot;muted&quot;:false,&quot;mutedUntil&quot;:null}"',
  );
});
it("SSR-hydrates authenticated content follow and mute into discussion controls", async () => {
  follow.session = { id: "usr_a", role: "user" };
  follow.contentStates.mockResolvedValue([
    {
      targetId: "article",
      notifyComments: true,
      mutedUntil: "2026-12-01T00:00:00.000000Z",
    },
  ]);
  const html = renderToStaticMarkup(await Page(input()));
  expect(follow.contentStates).toHaveBeenCalledWith("usr_a", ["article"]);
  expect(html).toContain("&quot;authenticated&quot;:true");
  expect(html).toContain("&quot;following&quot;:true");
  expect(html).toContain("&quot;notifyComments&quot;:true");
  expect(html).toContain("&quot;muted&quot;:true");
  expect(html).toContain("2026-12-01T00:00:00.000000Z");
});
it("falls back to muteState when the viewer is not following the article", async () => {
  follow.session = { id: "usr_a", role: "user" };
  follow.contentStates.mockResolvedValue([]);
  follow.muteState.mockResolvedValue({
    muted: true,
    mutedUntil: "2026-11-30T12:00:00.000000Z",
  });
  const html = renderToStaticMarkup(await Page(input()));
  expect(follow.muteState).toHaveBeenCalledWith("usr_a", "content", "article");
  expect(html).toContain("&quot;following&quot;:false");
  expect(html).toContain("&quot;muted&quot;:true");
  expect(html).toContain("2026-11-30T12:00:00.000000Z");
});
