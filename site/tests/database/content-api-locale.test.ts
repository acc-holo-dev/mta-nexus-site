import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { contentApiCopy } from "../../src/features/community/content-api-copy";

const mocks = vi.hoisted(() => ({
  getArticleBySlug: vi.fn(),
  getComments: vi.fn(),
}));

vi.mock("../../src/lib/services/community/content-service", () => ({
  contentService: {
    getArticleBySlug: mocks.getArticleBySlug,
    getComments: mocks.getComments,
  },
}));

import { GET } from "../../src/app/api/content/[slug]/route";

function request(locale: "en" | "ru", slug = "hello-world") {
  return new NextRequest(`https://nexus.test/api/content/${slug}`, {
    headers: { cookie: `nexus_locale=${locale}` },
  });
}

describe("content detail API locale envelope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns bilingual not-found from nexus_locale", async () => {
    const invalid = await GET(request("ru", "BAD_SLUG"), {
      params: Promise.resolve({ slug: "BAD_SLUG" }),
    });
    expect(invalid.status).toBe(404);
    expect(await invalid.json()).toMatchObject({
      error: contentApiCopy("ru").notFound,
    });
    expect(mocks.getArticleBySlug).not.toHaveBeenCalled();

    mocks.getArticleBySlug.mockResolvedValueOnce(null);
    const missing = await GET(request("en"), { params: Promise.resolve({ slug: "hello-world" }) });
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({
      error: contentApiCopy("en").notFound,
    });
  });

  it("returns bilingual unavailable from nexus_locale", async () => {
    mocks.getArticleBySlug.mockRejectedValueOnce(new Error("db"));
    const ru = await GET(request("ru"), { params: Promise.resolve({ slug: "hello-world" }) });
    expect(ru.status).toBe(503);
    expect(await ru.json()).toMatchObject({
      error: contentApiCopy("ru").unavailable,
    });
  });
});
