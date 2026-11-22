import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getResourceActivityCopy } from "../../src/features/resources/resource-activity-i18n";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("acquisition activity wallet honesty", () => {
  it("gates buyer history and publisher activity free-grant dialect on the wallet engine", () => {
    const history = read("site/src/features/resources/server/publisher-acquisitions-screen.tsx");
    const activity = read("site/src/features/resources/server/resource-activity-screen.tsx");
    const i18n = read("site/src/features/resources/resource-activity-i18n.ts");

    expect(history).toContain("isWalletEngineEnabled");
    expect(history).toContain("walletHistoryNote");
    expect(history).toContain("walletEnabled ? copy.walletHistoryNote : copy.historyNote");
    expect(activity).toContain("isWalletEngineEnabled");
    expect(activity).toContain("walletAnalyticsNote");
    expect(activity).toContain("walletAcquisitions");
    expect(activity).toContain("walletEnabled ? copy.walletAnalyticsNote : copy.analyticsNote");
    expect(activity).toContain("walletEnabled ? copy.walletAcquisitions : copy.acquisitions");
    expect(i18n).toContain("walletHistoryNote");
    expect(i18n).toContain("walletAnalyticsNote");
    expect(i18n).toContain("walletAcquisitions");
  });

  it("keeps free-grant dialect by default and admits paid site-wallet grants when wallet keys are used", () => {
    const en = getResourceActivityCopy("en");
    const ru = getResourceActivityCopy("ru");

    expect(en.historyNote).toMatch(/free grants/i);
    expect(en.historyNote).not.toMatch(/site-wallet/i);
    expect(en.walletHistoryNote).toMatch(/site-wallet/i);
    expect(en.walletHistoryNote).toMatch(/payment ledger/i);
    expect(en.analyticsNote).toMatch(/free grants/i);
    expect(en.walletAnalyticsNote).toMatch(/site-wallet/i);
    expect(en.walletAnalyticsNote).not.toMatch(/recorded free grants/i);
    expect(en.acquisitions).toMatch(/free/i);
    expect(en.walletAcquisitions).not.toMatch(/free/i);

    expect(ru.historyNote).toMatch(/бесплатн/i);
    expect(ru.walletHistoryNote).toMatch(/site wallet/i);
    expect(ru.walletHistoryNote).toMatch(/ledger/i);
    expect(ru.analyticsNote).toMatch(/бесплатн/i);
    expect(ru.walletAnalyticsNote).toMatch(/site wallet/i);
    expect(ru.acquisitions).toMatch(/бесплатн/i);
    expect(ru.walletAcquisitions).not.toMatch(/бесплатн/i);
  });
});
