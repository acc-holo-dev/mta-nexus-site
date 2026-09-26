import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("content feed separation", () => {
  it("keeps editorial feeds separate from community topics", () => {
    const service = readFileSync(
      resolve(process.cwd(), "apps/web/src/lib/services/content-service.ts"),
      "utf8",
    );

    const articles = service.slice(
      service.indexOf("async listArticles("),
      service.indexOf("async listCommunityTopics("),
    );
    const community = service.slice(
      service.indexOf("async listCommunityTopics("),
      service.indexOf("async listServerUpdates("),
    );

    for (const type of [
      "article",
      "news",
      "devlog",
      "update",
      "announcement",
    ]) {
      expect(articles).toContain(`"${type}"`);
    }
    expect(articles).not.toContain('"post"');
    expect(articles).not.toContain('"question"');
    expect(community).toContain('["post", "question"]');
  });
});
