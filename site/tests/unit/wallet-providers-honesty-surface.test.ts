import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../..");

describe("wallet providers honesty surface", () => {
  it("exposes GET /api/wallet/providers for session capability matrix", () => {
    const route = readFileSync(path.join(root, "src/app/api/wallet/providers/route.ts"), "utf8");
    expect(route).toContain("capabilityMatrix");
    expect(route).toContain("withdrawEnabled");
    expect(route).toContain("export function GET");
  });

  it("loads providers before hardcoding stub on top-up and withdraw forms", () => {
    const topUp = readFileSync(
      path.join(root, "src/features/commerce/components/wallet-topup-form.tsx"),
      "utf8",
    );
    const withdraw = readFileSync(
      path.join(root, "src/features/commerce/components/wallet-withdraw-form.tsx"),
      "utf8",
    );
    const hook = readFileSync(
      path.join(root, "src/features/commerce/components/use-wallet-provider-selection.ts"),
      "utf8",
    );
    expect(hook).toContain("/api/wallet/providers");
    expect(topUp).toContain("useWalletProviderSelection");
    expect(topUp).not.toMatch(/providerId:\s*"stub"/);
    expect(withdraw).toContain("useWalletProviderSelection");
    expect(withdraw).not.toMatch(/providerId:\s*"stub"/);
  });
});
