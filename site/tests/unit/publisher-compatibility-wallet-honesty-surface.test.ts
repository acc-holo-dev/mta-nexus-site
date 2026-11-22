import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("publisher compatibility wallet honesty", () => {
  it("gates compatibility update free-only price check on the wallet engine", () => {
    const service = read("site/src/lib/services/resources/resource-management-service.ts");
    const repo = read("site/packages/db/src/repositories/resource-compatibility.ts");

    expect(service).toContain("allowPaid: isWalletEngineEnabled()");
    expect(repo).toContain("allowPaid?: boolean");
    expect(repo).toContain("product.price !== 0 && !allowPaid");
  });
});
