import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("OPERATIONS site-wallet companion honesty", () => {
  it("documents dark flags and admin batch endpoints without claiming paid commerce is disabled", () => {
    const operations = read("docs/OPERATIONS.md");
    const envExample = read("config/env/.env.example");
    const commerceReadme = read("site/src/features/commerce/README.md");

    expect(operations).not.toContain("Paid commerce remains disabled.");
    expect(operations).toContain("### Site wallet (dark flags)");
    expect(operations).toContain("NEXUS_WALLET_ENGINE");
    expect(operations).toContain("NEXUS_WALLET_WITHDRAW");
    expect(operations).toContain("POST /api/admin/commerce/wallet-holds/release-matured");
    expect(operations).toContain("POST /api/admin/commerce/wallet-topups/expire-stale");
    expect(operations).toContain("POST /api/admin/commerce/wallet-orders/expire-stale");
    expect(operations).toContain("POST /api/admin/commerce/wallet-withdrawals/expire-stale");
    expect(operations).toContain("eligible-count preview");
    expect(operations).toContain("read-only recent top-up/withdrawal intent list");
    expect(operations).toContain("read-only previews of the exact rows");
    expect(operations).toContain("top-up expire");
    expect(operations).toContain("withdrawal expire");
    expect(operations).toContain("not a production deploy");
    expect(operations).toContain("CHECKOUT_DISABLED");

    expect(envExample).toContain("NEXUS_WALLET_ENGINE=");
    expect(envExample).toContain("NEXUS_WALLET_WITHDRAW=");
    expect(envExample).toContain("docs/OPERATIONS.md");

    expect(commerceReadme).toContain("docs/OPERATIONS.md#site-wallet-dark-flags");
  });
});
