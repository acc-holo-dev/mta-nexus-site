import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("article comment persistence", () => {
  // HTTP auth/validation/post-response notification behavior is covered by
  // content-comment-notification-http.test.ts. This remaining source contract
  // is limited to the transaction implementation that has no cheap unit seam.
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
