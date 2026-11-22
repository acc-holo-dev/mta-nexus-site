import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("published catalog count/list wallet honesty", () => {
  it("shares a catalog price helper and wires admin/discovery/content callers", () => {
    const repo = read("site/packages/db/src/repositories/products.ts");
    const admin = read("site/src/lib/services/moderation/admin-service.ts");
    const discovery = read("site/src/lib/services/discovery/discovery-service.ts");
    const content = read("site/src/lib/services/community/content-service.ts");

    expect(repo).toContain("export function publishedCatalogPriceCondition");
    expect(repo).toContain("async countPublishedFree(");
    expect(repo).toContain("includeWalletPaidSingleServer?: boolean");
    expect(repo).toContain("publishedCatalogPriceCondition(options.includeWalletPaidSingleServer)");
    expect(repo).toContain("async listPublishedByOrganization(");
    expect(repo).toContain("async listPublishedFreeByAuthor(");
    expect(repo).toContain("async listPublishedFreeByIds(");
    expect(admin).toContain("includeWalletPaidSingleServer: isWalletEngineEnabled()");
    expect(discovery).toContain("includeWalletPaidSingleServer: isWalletEngineEnabled()");
    expect(content).toContain("includeWalletPaidSingleServer: true");
    expect(content).toContain("isWalletEngineEnabled()");
  });
});
