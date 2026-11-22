import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("library requirements CTA wallet honesty", () => {
  it("gates canReviewRequirements on the wallet engine for inventory and release pages", () => {
    const projection = read("site/packages/db/src/repositories/library-release-projection.ts");
    const inventory = read("site/packages/db/src/repositories/library-collection-inventory.ts");
    const collections = read("site/src/lib/services/library/library-collections-service.ts");
    const releases = read("site/src/lib/services/resources/resource-release-control-service.ts");

    expect(projection).toContain("allowPaid?: boolean");
    expect(projection).toContain("product.license_model = 'single_server'");
    expect(inventory).toContain("libraryReleaseProjection(userId, sql`refs.id`, options)");
    expect(collections).toContain("allowPaid: isWalletEngineEnabled()");
    expect(releases).toContain("allowPaid: isWalletEngineEnabled()");
  });
});
