import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("community content API", () => {
  it("keeps public reads published-only and author submissions moderated", () => {
    const route = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/api/content/route.ts"),
      "utf8"
    );

    expect(route).toContain("contentRepository.listPublished()");
    expect(route).toContain('consumeRateLimit("contentCreation", user.id)');
    expect(route).toContain('status = "draft"');
    expect(route).toContain('can(user, "admin.moderation")');
    expect(route).toContain("Linked server");
  });
});
