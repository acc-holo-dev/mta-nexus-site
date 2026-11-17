import { createContentSchema } from "@nexus/validation";
import { describe, expect, it } from "vitest";

describe("content publication validation authority", () => {
  it("defaults omitted publication status to draft", () => {
    const parsed = createContentSchema.parse({
      title: "Article title",
      slug: "article-title",
      body: "Long enough article body.",
      type: "article",
    });
    expect(parsed.status).toBe("draft");
  });

  it("allows status intent in validated input while leaving final authority to the route", () => {
    const parsed = createContentSchema.parse({
      title: "Article title",
      slug: "article-title",
      body: "Long enough article body.",
      type: "article",
      status: "published",
    });
    expect(parsed.status).toBe("published");
  });
});
