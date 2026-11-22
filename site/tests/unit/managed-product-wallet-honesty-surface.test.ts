import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("managed product wallet honesty", () => {
  it("gates managed find/page/update free-only price filters on the wallet engine", () => {
    const service = read("site/src/lib/services/commerce/product-service.ts");
    const repo = read("site/packages/db/src/repositories/products.ts");

    expect(service).toContain("allowPaid: isWalletEngineEnabled()");
    expect(service).toContain("findManaged(id, actor,");
    expect(service).toContain("pageManaged(actor, status, page,");
    expect(service).toContain("{ allowPaid }");
    expect(repo).toContain("allowPaid ? undefined : eq(products.price, 0)");
    expect(repo).toContain("options: { allowPaid?: boolean } = {}");
  });
});
