import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("community content API", () => {
  it("keeps public reads published-only and author submissions moderated", () => {
    const route = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/api/content/route.ts"),
      "utf8"
    );

    expect(route).toContain("contentRepository.listPublished(limit)");
    expect(route).toMatch(/consumeRateLimit\(\s*"contentCreation",\s*user\.id/);
    expect(route).toContain(': "draft";');
    expect(route).toContain('can(user, "admin.moderation")');
    expect(route).toContain("Linked server");
    expect(route).toContain("stale-while-revalidate=120");
    expect(route).toContain("organizationRepository.listUserMemberships(");
    expect(route).toContain('const privateHeaders = {');
    expect(route).toContain('"Cache-Control": "private, no-store"');
    expect(route).toContain('Vary: "Cookie"');
    expect(route).toContain("privateJson(");
  });
});
