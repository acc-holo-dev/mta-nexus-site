import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resourceReleaseWatchesCopy } from "../../src/features/resources/resource-release-watches-i18n";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("release-watch acquire wallet honesty", () => {
  it("gates paid detail release-watch acquire copy on walletPaidAcquire", () => {
    const control = read(
      "site/src/features/resources/components/resource-release-watch-control.tsx",
    );
    const detail = read("site/src/features/resources/server/detail-page.tsx");
    const i18n = read("site/src/features/resources/resource-release-watches-i18n.ts");

    expect(control).toContain("walletPaidAcquire");
    expect(control).toContain("acquireRequiredWallet");
    expect(detail).toContain('data-acquire-intent="wallet"');
    expect(detail).toContain("walletPaidAcquire");
    expect(i18n).toContain("acquireRequiredWallet");
  });

  it("keeps free claim acquireRequired by default and names site-wallet settle for paid", () => {
    const en = resourceReleaseWatchesCopy("en");
    const ru = resourceReleaseWatchesCopy("ru");

    expect(en.acquireRequired).toMatch(/free/i);
    expect(en.acquireRequiredWallet).toMatch(/site wallet/i);
    expect(en.acquireRequiredWallet).not.toMatch(/free/i);
    expect(ru.acquireRequired).toMatch(/бесплатн/i);
    expect(ru.acquireRequiredWallet).toMatch(/site wallet/i);
    expect(ru.acquireRequiredWallet).not.toMatch(/бесплатн/i);
  });
});
