import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resourceActivityCsv } from "../../src/features/resources/resource-activity-csv";
import { getResourceActivityCopy } from "../../src/features/resources/resource-activity-i18n";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("acquisition activity wallet honesty", () => {
  it("gates buyer history and publisher activity free-grant dialect on the wallet engine", () => {
    const history = read("site/src/features/resources/server/publisher-acquisitions-screen.tsx");
    const activity = read("site/src/features/resources/server/resource-activity-screen.tsx");
    const i18n = read("site/src/features/resources/resource-activity-i18n.ts");
    const service = read("site/src/lib/services/resources/resource-activity-service.ts");
    const repo = read("site/packages/db/src/repositories/resource-activity.ts");
    const csv = read("site/src/features/resources/resource-activity-csv.ts");
    const exportRoute = read("site/src/app/api/products/[id]/activity/export/route.ts");

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
    expect(service).toContain("allowPaid: isWalletEngineEnabled()");
    expect(repo).toContain("allowPaid");
    expect(repo).toContain("eq(products.price, 0)");
    expect(csv).toContain("walletEnabled");
    expect(csv).toContain("free_acquisitions");
    expect(exportRoute).toContain("walletEnabled: isWalletEngineEnabled()");
  });

  it("exports acquisitions CSV header when wallet-enabled and free_acquisitions by default", () => {
    const report = {
      product: { id: "prd_a", title: "A", status: "published" as const },
      days: 7 as const,
      from: new Date("2026-10-04T00:00:00Z"),
      through: new Date("2026-10-10T12:00:00Z"),
      acquisitions: 1,
      direct: 1,
      cart: 0,
      retainedGrants: 1,
      downloadStarts: 0,
      timeline: [{ day: "2026-10-10", acquisitions: 1, downloadStarts: 0 }],
    };
    expect(resourceActivityCsv(report)).toContain("utc_day,free_acquisitions,download_starts");
    expect(resourceActivityCsv(report, { walletEnabled: true })).toContain(
      "utc_day,acquisitions,download_starts",
    );
    expect(resourceActivityCsv(report, { walletEnabled: true })).not.toContain("free_acquisitions");
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
