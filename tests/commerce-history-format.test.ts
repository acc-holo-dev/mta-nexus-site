import { describe, expect, it, vi } from "vitest";
import { historyPageBounds } from "../packages/db/src/repositories/history-pagination";
import {
  effectiveLicenseStatus,
  formatHistoryAmount,
  formatHistoryDate,
  licenseStatusLabel,
  orderStatusLabel,
  parseHistoryPage,
} from "../apps/web/src/lib/commerce-history-format";
import { commerceHistoryCopy } from "../apps/web/src/lib/commerce-history-i18n";

describe("bounded private commerce history", () => {
  it("bounds pages without accepting large or malformed offsets", () => {
    expect(historyPageBounds(0, 100)).toEqual({
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 1,
      offset: 0,
    });
    expect(historyPageBounds(21, 1)).toMatchObject({ page: 1, offset: 0, totalPages: 2 });
    expect(historyPageBounds(21, 2)).toMatchObject({ page: 2, offset: 20, totalPages: 2 });
    expect(historyPageBounds(21, 999_999)).toMatchObject({ page: 2, offset: 20 });
    for (const value of [NaN, Infinity, 2.5, -1, 0]) {
      expect(historyPageBounds(21, value).page).toBe(1);
    }
    expect(() => historyPageBounds(-1)).toThrow(RangeError);
    expect(() => historyPageBounds(Infinity)).toThrow(RangeError);
  });

  it("accepts only bounded, canonical page query strings", () => {
    expect(parseHistoryPage("12")).toBe(12);
    for (const value of ["0", "-1", "1.5", "2e4", " 2", "0001", "1000000", ["2", "3"], undefined]) {
      expect(parseHistoryPage(value)).toBe(1);
    }
  });

  it("formats integer minor currency units with the currency's fraction digits", () => {
    expect(formatHistoryAmount(12345, "USD", "en")).toContain("123.45");
    expect(formatHistoryAmount(12345, "JPY", "en")).toContain("12,345");
    expect(formatHistoryAmount(12345, "KWD", "en")).toContain("12.345");
    expect(formatHistoryAmount(12345, "USD", "ru")).toContain("123");
    expect(formatHistoryAmount(NaN, "USD", "en")).toBe("—");
    expect(formatHistoryAmount(13.5, "USD", "en")).toBe("—");
    expect(formatHistoryAmount(3, "INVALID", "en")).toBe("—");
  });

  it("fails closed when the formatter does not report currency fraction digits", () => {
    const options = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).resolvedOptions();
    const spy = vi
      .spyOn(Intl.NumberFormat.prototype, "resolvedOptions")
      .mockReturnValue({ ...options, maximumFractionDigits: undefined });
    try {
      expect(formatHistoryAmount(12345, "USD", "en")).toBe("—");
    } finally {
      spy.mockRestore();
    }
  });

  it("calculates effective expiry without changing the stored license status", () => {
    const now = new Date("2026-10-09T00:00:00.000Z");
    const prior = new Date("2026-10-08T23:59:59.000Z");
    const future = new Date("2026-10-10T00:00:00.000Z");
    expect(effectiveLicenseStatus("active", prior, now)).toBe("expired");
    expect(effectiveLicenseStatus("active", now, now)).toBe("expired");
    expect(effectiveLicenseStatus("active", future, now)).toBe("active");
    expect(effectiveLicenseStatus("active", null, now)).toBe("active");
    expect(effectiveLicenseStatus("revoked", future, now)).toBe("revoked");
    expect(effectiveLicenseStatus("suspended", prior, now)).toBe("suspended");
  });

  it.each(["en", "ru"] as const)(
    "provides localized status, navigation and stable dates in %s",
    (locale) => {
      const copy = commerceHistoryCopy[locale];
      expect(orderStatusLabel("completed", copy.orderStatuses)).toBe(copy.orderStatuses.completed);
      expect(licenseStatusLabel("expired", copy.licenseStatuses)).toBe(
        copy.licenseStatuses.expired,
      );
      expect(orderStatusLabel("future_status", copy.orderStatuses)).toBe("future_status");
      expect(licenseStatusLabel("future_status", copy.licenseStatuses)).toBe("future_status");
      expect(copy.tabs.purchases).not.toBe("");
      expect(copy.tabs.sales).not.toBe("");
      expect(formatHistoryDate(new Date("2026-10-09T22:00:00Z"), locale)).toContain("2026");
    },
  );
});
