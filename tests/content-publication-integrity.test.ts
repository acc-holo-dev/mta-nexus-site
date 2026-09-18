import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("public content publication integrity", () => {
  it("filters slug reads to published content", () => {
    const repository = readFileSync(
      resolve(process.cwd(), "packages/db/src/repositories/content.ts"),
      "utf8"
    );

    expect(repository).toContain("findPublishedBySlug");
    expect(repository).toContain('eq(content.status, "published")');
    expect(repository).toContain("return this.findPublishedBySlug(slug, options)");
  });

  it("does not count metadata generation as an article view", () => {
    const page = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/articles/[slug]/page.tsx"),
      "utf8"
    );

    expect(page).toContain(
      'contentService.getArticleBySlug(slug, { incrementView: false })'
    );
    expect(page).toContain(
      'contentService.getComments({ contentId: article.id }, 100)'
    );
  });

  it("bounds comments and exposes a cacheable published detail read", () => {
    const repository = readFileSync(
      resolve(process.cwd(), "packages/db/src/repositories/content.ts"),
      "utf8"
    );
    const route = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/api/content/[slug]/route.ts"),
      "utf8"
    );

    expect(repository).toContain(".limit(boundedLimit)");
    expect(route).toContain('contentService.getArticleBySlug(slug)');
    expect(route).toContain("Article not found");
    expect(route).toContain("stale-while-revalidate=120");
  });
});
