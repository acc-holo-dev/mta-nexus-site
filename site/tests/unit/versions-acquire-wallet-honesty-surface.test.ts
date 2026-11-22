import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getReleaseHistoryCopy } from "../../src/features/resources/public-release-history";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("versions acquire wallet honesty", () => {
  it("gates versions acquire CTA copy on wallet-paid single-server listings", () => {
    const page = read("site/src/features/resources/server/versions-page.tsx");
    const history = read("site/src/features/resources/public-release-history.ts");

    expect(page).toContain("isWalletEngineEnabled");
    expect(page).toContain("acquireWallet");
    expect(page).toContain("walletPaidAcquire");
    expect(history).toContain("acquireWallet");
  });

  it("keeps free claim acquire copy by default and points paid wallet listings to site-wallet settle", () => {
    const en = getReleaseHistoryCopy("en");
    const ru = getReleaseHistoryCopy("ru");

    expect(en.acquire).toMatch(/free/i);
    expect(en.acquireWallet).toMatch(/site-wallet/i);
    expect(en.acquireWallet).not.toMatch(/free/i);
    expect(ru.acquire).toMatch(/бесплатн/i);
    expect(ru.acquireWallet).toMatch(/site wallet/i);
    expect(ru.acquireWallet).not.toMatch(/бесплатн/i);
  });
});
