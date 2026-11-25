import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("purchase detail recorded-rate honesty", () => {
  it("states missing recorded rates once for the header and once for the line list", () => {
    const screen = read("site/src/features/commerce/server/purchase-detail-screen.tsx");
    expect(screen).toContain("if (rates === null) return null");
    const notes = screen.match(/walletCopy\.recordedRateUnavailable/g) ?? [];
    expect(notes).toHaveLength(2);
    expect(screen).toContain('id="order-items"');
    expect(screen).toContain('purpose="discount"');
    expect(screen).toContain("formatHistoryAmount(order.totalAmount, order.currency, typedLocale)");
    expect(screen).toContain("formatHistoryAmount(item.unitPrice, item.currency, typedLocale)");
  });
});
