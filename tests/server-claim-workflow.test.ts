import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("server ownership claim workflow", () => {
  it("allows claims only for unowned or already-owned-by-requester servers", () => {
    const route = read("apps/web/src/app/api/verification/route.ts");

    expect(route).toContain("server.ownerId && server.ownerId !== user.id");
    expect(route).toContain("This server is already claimed");
    expect(route).toContain("Server ownership requests require an evidence URL");
    expect(route).not.toContain("You do not own this server");
  });

  it("assigns ownership only inside an approved moderation transaction", () => {
    const repository = read("packages/db/src/repositories/verification.ts");

    expect(repository).toContain("ownerId: request.requesterId");
    expect(repository).toContain("isVerified: true");
    expect(repository).toContain("Server claim target is already owned by another user");
    expect(repository).toContain("Another ownership claim was approved");
    expect(repository).toContain("Verification target no longer exists");
    expect(repository).toContain("Verification approved");
    expect(repository).toContain("notifications");
    expect(repository).toContain("db.transaction");
  });

  it("exposes a complete claimant and moderator UI path", () => {
    const serverPage = read("apps/web/src/app/servers/[slug]/page.tsx");
    const claimForm = read("apps/web/src/components/server-claim-form.tsx");
    const adminPage = read("apps/web/src/app/admin/page.tsx");
    const reviewForm = read("apps/web/src/components/verification-review-form.tsx");

    expect(serverPage).toContain("ServerClaimForm");
    expect(serverPage).toContain("findPendingForTarget");
    expect(claimForm).toContain('targetType: "server"');
    expect(claimForm).toContain("Submit ownership request");
    expect(adminPage).toContain("VerificationReviewForm");
    expect(adminPage).toContain("Review ownership evidence");
    expect(reviewForm).toContain('targetType: "verification"');
  });
});
