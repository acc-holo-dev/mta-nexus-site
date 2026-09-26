import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("content moderation workflow", () => {
  it("lets moderators publish or archive drafts through an audited service path", () => {
    const route = read(
      "apps/web/src/app/api/admin/actions/route.ts",
    );
    const service = read(
      "apps/web/src/lib/services/content-service.ts",
    );
    const repository = read(
      "packages/db/src/repositories/content.ts",
    );
    const page = read("apps/web/src/app/admin/page.tsx");

    expect(route).toContain('z.literal("content")');
    expect(route).toContain(
      'z.enum(["publish", "archive"])',
    );
    expect(route).toContain("contentService.moderateContent");
    expect(service).toContain(
      'can(actor, "admin.moderation")',
    );
    expect(service).toContain(
      'action: decision === "publish" ? "content.published" : "content.archived"',
    );
    expect(repository).toContain("listByStatus");
    expect(repository).toContain("updateStatus");
    expect(repository).toContain("expectedStatus");
    expect(service).toContain("CONTENT_STATE_CHANGED");
    expect(page).toContain(
      'contentRepository.listByStatus("draft", 100)',
    );
    expect(page).toContain("copy.communityQueue");
    expect(page).toContain("copy.draftsAwaitingModeration");
  });
});
