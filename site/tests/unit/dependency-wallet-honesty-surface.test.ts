import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("dependency resolution wallet honesty", () => {
  it("gates published dependency and reverse-dependent free-only filters on the wallet engine", () => {
    const repo = read("site/packages/db/src/repositories/products.ts");
    const service = read("site/src/lib/services/commerce/product-service.ts");

    expect(repo).toContain("async findPublishedFreeBySlugs(");
    expect(repo).toContain("async listPublishedFreeDependingOnSlug(");
    expect(repo).toContain("includeWalletPaidSingleServer?: boolean");
    expect(repo).toContain('eq(products.licenseModel, "single_server")');
    expect(service).toContain("includeWalletPaidSingleServer: isWalletEngineEnabled()");
    expect(service).toContain("{ includeWalletPaidSingleServer: isWalletEngineEnabled() }");
  });
});
