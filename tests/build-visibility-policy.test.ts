import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("resource build visibility", () => {
  it("shows only published builds publicly and keeps lifecycle details to owners/admins", () => {
    const repository = readFileSync(
      resolve(process.cwd(), "packages/db/src/repositories/builds.ts"),
      "utf8"
    );
    const service = readFileSync(
      resolve(process.cwd(), "apps/web/src/lib/services/product-service.ts"),
      "utf8"
    );
    const page = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/market/[slug]/page.tsx"),
      "utf8"
    );

    expect(repository).toContain("listPublishedByProduct");
    expect(service).toContain("includeNonPublic = false");
    expect(service).toContain("buildRepository.listPublishedByProduct");
    expect(page).toContain("const canInspectBuilds = isAuthor || isAdmin");
    expect(page).toContain("b.status === \"published\"");
  });
});
