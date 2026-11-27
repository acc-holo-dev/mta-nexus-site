import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const views = vi.hoisted(() => ({ count: 4 }));

const mocks = vi.hoisted(() => ({
  getArticleBySlug: vi.fn(async (slug: string, options?: { incrementView?: boolean }) => {
    if (options?.incrementView !== false) views.count += 1;
    return {
      id: "cnt_public",
      slug,
      title: "Public article",
      status: "published" as const,
      viewCount: views.count,
    };
  }),
  getComments: vi.fn(async () => []),
  pageDiscussion: vi.fn(async () => ({ items: [], hasMore: false, nextCursor: null })),
}));

vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: { getSession: async () => null },
}));

vi.mock("../../src/lib/services/community/content-service", () => ({
  contentService: {
    getArticleBySlug: mocks.getArticleBySlug,
    getComments: mocks.getComments,
    pageDiscussion: mocks.pageDiscussion,
  },
}));

import { GET as getComments } from "../../src/app/api/content/[slug]/comments/route";
import { GET as getArticle } from "../../src/app/api/content/[slug]/route";

const slug = "public-article";
const params = { params: Promise.resolve({ slug }) };

function articleRequest() {
  return new NextRequest(`https://nexus.test/api/content/${slug}`);
}

function commentsRequest() {
  return new NextRequest(`https://nexus.test/api/content/${slug}/comments`);
}

describe("AUD-12 public article view count", () => {
  beforeEach(() => {
    views.count = 4;
    vi.clearAllMocks();
  });

  it("does not increment viewCount on repeated article GET or the comments GET", async () => {
    const first = await getArticle(articleRequest(), params);
    const second = await getArticle(articleRequest(), params);
    const comments = await getComments(commentsRequest(), params);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(comments.status).toBe(200);
    expect((await first.json()).content.viewCount).toBe(4);
    expect((await second.json()).content.viewCount).toBe(4);
    expect(views.count).toBe(4);
    expect(mocks.getArticleBySlug).toHaveBeenNthCalledWith(1, slug, { incrementView: false });
    expect(mocks.getArticleBySlug).toHaveBeenNthCalledWith(2, slug, { incrementView: false });
    expect(mocks.getArticleBySlug).toHaveBeenNthCalledWith(3, slug, { incrementView: false });
    expect(mocks.getComments).toHaveBeenCalledTimes(2);
    expect(mocks.pageDiscussion).toHaveBeenCalledWith("cnt_public", undefined);
  });
});
