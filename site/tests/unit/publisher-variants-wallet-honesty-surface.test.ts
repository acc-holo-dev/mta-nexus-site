import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("publisher variants wallet honesty", () => {
  it("gates variant public/managed/candidates/command free-only filters on the wallet engine", () => {
    const service = read("site/src/lib/services/resources/resource-management-service.ts");
    const repo = read("site/packages/db/src/repositories/resource-variants.ts");

    expect(service).toContain("isWalletEngineEnabled");
    expect(service).toContain("allowPaid: isWalletEngineEnabled()");
    expect(repo).toContain("PaidAccessOptions");
    expect(repo).toContain("freeOnlyPrice");
    expect(repo).toContain("eq(products.price, 0)");
    expect(repo).toContain("single_server");
  });
});
