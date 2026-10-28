import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  article: vi.fn(),
  comments: vi.fn(),
}));

vi.mock("../apps/web/src/lib/services/content-service", () => ({
  contentService: {
    getArticleBySlug: mocks.article,
    getComments: mocks.comments,
  },
}));

import { GET } from "../apps/web/src/app/api/content/[slug]/route";

describe("published content detail HTTP behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.comments.mockResolvedValue([]);
  });

  it.each(["", "Uppercase", "a".repeat(201), "bad/slash"])(
    "rejects invalid public slug %j before service lookup",
    async (slug) => {
      const response = await GET(
        new NextRequest(`http://nexus.test/api/content/${encodeURIComponent(slug)}`),
        { params: Promise.resolve({ slug }) },
      );
      expect(response.status).toBe(404);
      expect(mocks.article).not.toHaveBeenCalled();
    },
  );

  it("returns 404 when published lookup cannot find the article", async () => {
    mocks.article.mockResolvedValue(null);
    const response = await GET(new NextRequest("http://nexus.test/api/content/missing"), {
      params: Promise.resolve({ slug: "missing" }),
    });
    expect(response.status).toBe(404);
    expect(mocks.article).toHaveBeenCalledWith("missing");
    expect(mocks.comments).not.toHaveBeenCalled();
  });

  it("returns bounded comments and public cache headers for a published article", async () => {
    mocks.article.mockResolvedValue({ id: "cnt_1", slug: "published" });
    mocks.comments.mockResolvedValue([{ id: "cmt_1" }]);
    const response = await GET(new NextRequest("http://nexus.test/api/content/published"), {
      params: Promise.resolve({ slug: "published" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.comments).toHaveBeenCalledWith({ contentId: "cnt_1" }, 100);
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=30, stale-while-revalidate=120",
    );
  });
});
