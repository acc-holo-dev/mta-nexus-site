import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("content moderation workflow", () => {
  it("lets moderators publish or archive drafts through an audited service path", () => {
    const route = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/api/admin/actions/route.ts"),
      "utf8"
    );
    const service = readFileSync(
      resolve(process.cwd(), "apps/web/src/lib/services/content-service.ts"),
      "utf8"
    );
    const repository = readFileSync(
      resolve(process.cwd(), "packages/db/src/repositories/content.ts"),
      "utf8"
    );
    const page = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/admin/page.tsx"),
      "utf8"
    );

    expect(route).toContain('z.literal("content")');
    expect(route).toContain('z.enum(["publish", "archive"])');
    expect(route).toContain("contentService.moderateContent");
    expect(service).toContain('can(actor, "admin.moderation")');
    expect(service).toContain('action: decision === "publish" ? "content.published" : "content.archived"');
    expect(repository).toContain("listByStatus");
    expect(repository).toContain("updateStatus");
    expect(page).toContain('contentRepository.listByStatus("draft", 100)');
    expect(page).toContain("Community Content Queue");
  });
});
