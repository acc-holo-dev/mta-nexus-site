import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("public portfolio wallet honesty", () => {
  it("gates author/org portfolio free-only paging on the wallet engine", () => {
    const repo = read("site/packages/db/src/repositories/products.ts");
    const developer = read("site/src/features/accounts/server/developer-profile-screen.tsx");
    const user = read("site/src/features/accounts/server/user-profile-screen.tsx");
    const organization = read("site/src/features/organizations/server/public-profile.tsx");

    expect(repo).toContain("includeWalletPaidSingleServer");
    expect(repo).toContain('eq(products.licenseModel, "single_server")');
    expect(developer).toContain("includeWalletPaidSingleServer: walletEnabled");
    expect(user).toContain("includeWalletPaidSingleServer: walletEnabled");
    expect(organization).toContain("includeWalletPaidSingleServer: walletEnabled");
  });
});
