import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("paid draft replay and lifecycle wallet honesty", () => {
  it("gates create-draft replay and lifecycle free-only refusals on the wallet engine", () => {
    const products = read("site/packages/db/src/repositories/products.ts");
    const lifecycle = read("site/packages/db/src/repositories/product-lifecycle.ts");
    const service = read("site/src/lib/services/commerce/product-service.ts");

    expect(products).toContain("findCreatedDraftForReplay(");
    expect(products).toContain("allowPaid?: boolean");
    expect(products).toContain('eq(products.licenseModel, "single_server")');
    expect(lifecycle).toContain("allowPaid?: boolean");
    expect(lifecycle).toContain('product?.licenseModel === "single_server"');
    expect(service).toContain("allowPaid: isWalletEngineEnabled()");
    expect(service).toContain(
      "productRepository.findCreatedDraftForReplay(slug, actor.id, currentToken, {",
    );
  });
});
