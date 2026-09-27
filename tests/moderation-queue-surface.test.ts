import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("moderation queues", () => {
  it("exposes pending resource builds only inside the protected admin surface", () => {
    const repository = read(
      "packages/db/src/repositories/builds.ts",
    );
    const page = read("apps/web/src/app/admin/page.tsx");

    expect(repository).toContain("listPendingReview");
    expect(repository).toContain(
      'eq(builds.status, "pending_review")',
    );
    expect(page).toContain("buildRepository.listPendingReviewPage(buildPage)");
    expect(page).toContain("buildRepository.countPendingReview()");
    expect(page).toContain("copy.resourceBuildQueue");
    expect(page).toContain("copy.buildsAwaitingReview");
    expect(page).toContain('can(currentUser, "admin.access")');
  });
});
