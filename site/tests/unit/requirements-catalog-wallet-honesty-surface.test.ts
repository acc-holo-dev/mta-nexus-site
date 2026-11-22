import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("resource requirements wallet honesty", () => {
  it("gates requirements and collection graph free-only filters on the wallet engine", () => {
    const repo = read("site/packages/db/src/repositories/resource-requirements.ts");
    const service = read("site/src/lib/services/resources/resource-requirements-service.ts");

    expect(repo).toContain("allowPaid?: boolean");
    expect(repo).toContain("publicCatalogPriceSql");
    expect(repo).toContain("p.license_model = 'single_server'");
    expect(repo).toContain(
      'includeWalletPaidSingleServer && product?.licenseModel === "single_server"',
    );
    expect(service).toContain("allowPaid: isWalletEngineEnabled()");
  });
});
