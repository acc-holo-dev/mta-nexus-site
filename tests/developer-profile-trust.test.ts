import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("creator profile trust signals", () => {
  it("bounds the public developer directory and uses honest identity labels", () => {
    const page = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/developers/page.tsx"),
      "utf8"
    );

    expect(page).toContain("authService.listDevelopers(100)");
    expect(page).toContain("copy.verifiedIdentity");
    expect(page).toContain("copy.creatorProfile");
    expect(page).not.toContain("Verified Seller");
    expect(page).not.toContain("Verified Developer");
  });

  it("requires a developer role and avoids synthetic reputation claims", () => {
    const page = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/developers/[username]/page.tsx"),
      "utf8"
    );

    expect(page).toContain("authService.getUserByUsername(username)");
    expect(page).toContain('user.role !== "developer"');
    expect(page).toContain('user.role !== "admin"');
    expect(page).toContain("productRepository.listPublishedFreeByAuthor(user.id)");
    expect(page).not.toContain("allProducts.filter");
    expect(page).not.toContain("100%");
    expect(page).not.toContain("Reputation");
    expect(page).not.toContain("Verified Member");
  });

  it("filters developer reads at the repository boundary", () => {
    const repository = readFileSync(
      resolve(process.cwd(), "packages/db/src/repositories/users.ts"),
      "utf8"
    );

    expect(repository).toContain("listDevelopers");
    expect(repository).toContain('eq(users.role, "developer")');
    expect(repository).toContain(".limit(boundedLimit)");
  });
});
