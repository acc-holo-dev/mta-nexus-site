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
vi.mock("../../../lib/services/auth-service", () => ({
  authService: { getUserById: async () => null, getSession: async () => null },
}));
vi.mock("../../../lib/i18n-server", () => ({ getRequestLocale: async () => state.locale }));
vi.mock("../../../components/content-discussion", () => ({ ContentDiscussion: () => null }));
import Page, { generateMetadata } from "./page";
import { ArticleCard } from "../../../components/article-card";
const input = () => ({ params: Promise.resolve({ slug: "guide" }) });
beforeEach(() => {
  state.cover = "";
  state.locale = "en";
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
