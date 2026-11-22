import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("publisher inventory wallet honesty", () => {
  it("gates publisher inventory free-only price filter on the wallet engine", () => {
    const service = read("site/src/lib/services/resources/resource-publisher-service.ts");
    const repo = read("site/packages/db/src/repositories/resource-publisher.ts");

    expect(service).toContain("isWalletEngineEnabled");
    expect(service).toContain("allowPaid: isWalletEngineEnabled()");
    expect(repo).toContain("allowPaid");
    expect(repo).toContain("eq(products.price, 0)");
    expect(repo).toContain("allowPaid ? undefined : eq(products.price, 0)");
  });
});
