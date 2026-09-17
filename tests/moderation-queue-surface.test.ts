import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("moderation queues", () => {
  it("exposes pending resource builds only inside the protected admin surface", () => {
    const repository = readFileSync(
      resolve(process.cwd(), "packages/db/src/repositories/builds.ts"),
      "utf8"
    );
    const page = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/admin/page.tsx"),
      "utf8"
    );

    expect(repository).toContain("listPendingReview");
    expect(repository).toContain('eq(builds.status, "pending_review")');
    expect(page).toContain("const pendingBuilds = await buildRepository.listPendingReview()");
    expect(page).toContain("Resource Build Queue");
    expect(page).toContain('can(currentUser, "admin.access")');
  });
});
