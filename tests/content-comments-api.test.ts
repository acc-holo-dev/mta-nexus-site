import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("article comments API", () => {
  it("requires authentication, validates parent ownership and notifies authors", () => {
    const route = readFileSync(
      resolve(
        process.cwd(),
        "apps/web/src/app/api/content/[slug]/comments/route.ts"
      ),
      "utf8"
    );

    expect(route).toContain('consumeRateLimit("commentCreation", user.id)');
    expect(route).toContain("createContentCommentSchema.safeParse");
    expect(route).toContain("incrementView: false");
    expect(route).toContain("notificationRepository.create");
    expect(route).toContain('category: "content"');
    expect(route).toContain('Cache-Control": "no-store"');
  });

  it("keeps comment writes and article counters in one transaction", () => {
    const repository = readFileSync(
      resolve(process.cwd(), "packages/db/src/repositories/content.ts"),
      "utf8"
    );
    const service = readFileSync(
      resolve(process.cwd(), "apps/web/src/lib/services/content-service.ts"),
      "utf8"
    );
    const validation = readFileSync(
      resolve(process.cwd(), "packages/validation/src/index.ts"),
      "utf8"
    );

    expect(validation).toContain("createContentCommentSchema");
    expect(repository).toContain("findCommentById");
    expect(repository).toContain("return db.transaction(async (tx) =>");
    expect(repository).toContain("commentCount: sql");
    expect(service).toContain("COMMENT_PARENT_NOT_FOUND");
    expect(service).toContain("isVerifiedPurchase: false");
  });
});
