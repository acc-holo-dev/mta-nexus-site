import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("bounded home feed reads", () => {
  it("does not materialize the full catalog for the landing page", () => {
    const page = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/page.tsx"),
      "utf8"
    );
    const service = readFileSync(
      resolve(process.cwd(), "apps/web/src/lib/services/content-service.ts"),
      "utf8"
    );

    expect(page).toContain('sort: "popular", limit: 4');
    expect(page).toContain("contentService.listArticles(4)");
    expect(service).toContain("featuredOnly: true");
    expect(service).toContain("maxPrice: 0");
    expect(service).toContain("limit: 4");
    expect(service).toContain("listActivePublic(3)");
    expect(service).toContain("listPublished(3)");
  });
});
