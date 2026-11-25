vi.mock("server-only", () => ({}));

import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatHistoryAmount } from "../../src/features/commerce/commerce-history-format";
import { getCommerceHistoryCopy } from "../../src/features/commerce/commerce-history-i18n";

const state = vi.hoisted(() => ({
  user: { id: "usr_seller", role: "user" } as { id: string; role: "user" } | null,
  locale: "en" as "en" | "ru",
  seller: vi.fn(),
  rates: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "session" }) }),
}));
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children, ...rest }: { href: string; children: ReactNode }) =>
      React.createElement("a", { href, ...rest }, children),
  };
});
vi.mock("@nexus/db", () => ({
  orderRepository: { pageSellerHistory: state.seller },
  walletTopupRepository: {},
  walletWithdrawalRepository: {},
  ledgerRepository: {},
  walletOrderSettlementRepository: {},
  productRepository: {},
  walletSellerHoldRepository: {},
  orderOperationsRepository: {},
  buildRepository: {},
  promoCodeRepository: {},
  walletFxRateRepository: { list: state.rates },
}));
vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: { getSession: async () => state.user },
}));
vi.mock("../../src/lib/i18n/server", () => ({
  getRequestLocale: async () => state.locale,
}));

import { SalesHistoryScreen } from "../../src/features/commerce/sales-history-server";

const date = new Date("2026-10-09T10:00:00.000Z");
const sale = {
  id: "itm_1",
  orderNumber: "ORD-1",
  productTitle: "Seller kit",
  unitPrice: 250,
  currency: "USD",
  createdAt: date,
};

describe("seller sales history recorded-rate estimate", () => {
  const previous = process.env.NEXUS_WALLET_ENGINE;

  beforeEach(() => {
    state.user = { id: "usr_seller", role: "user" };
    state.locale = "en";
    state.seller.mockReset().mockResolvedValue({
      sales: [sale],
      total: 1,
      page: 1,
      totalPages: 1,
      pageSize: 20,
    });
    state.rates
      .mockReset()
      .mockResolvedValue([
        { baseCurrency: "USD", quoteCurrency: "EUR", baseAmount: 100, quoteAmount: 90 },
      ]);
    process.env.NEXUS_WALLET_ENGINE = "1";
  });

  afterEach(() => {
    if (previous === undefined) delete process.env.NEXUS_WALLET_ENGINE;
    else process.env.NEXUS_WALLET_ENGINE = previous;
  });

  async function html() {
    const element = await SalesHistoryScreen({ query: {} });
    return renderToStaticMarkup(element);
  }

  it("shows a display-only recorded-rate estimate beside the stored gross line", async () => {
    const copy = getCommerceHistoryCopy("en");
    const markup = await html();
    expect(markup).toContain(formatHistoryAmount(250, "USD", "en"));
    expect(markup).toContain(
      copy.saleLineEstimate
        .replace("{amount}", formatHistoryAmount(225, "EUR", "en"))
        .replace("{base}", formatHistoryAmount(250, "USD", "en")),
    );
    expect(markup).toContain(
      copy.saleLineEstimateNone.replace("{base}", "USD").replace("{quote}", "RUB"),
    );
    expect(markup).not.toContain(copy.saleLineEstimateUnavailable);
  });

  it("keeps the stored line and an unavailable note when the rate read fails", async () => {
    state.rates.mockRejectedValue(new Error("fx down"));
    const copy = getCommerceHistoryCopy("en");
    const markup = await html();
    expect(markup).toContain(formatHistoryAmount(250, "USD", "en"));
    expect(markup).toContain(copy.saleLineEstimateUnavailable);
    expect(markup).not.toContain(copy.saleLineEstimateNone.replace("{base}", "USD"));
  });

  it("uses a missing-pair sentence when the read succeeds with no pair", async () => {
    state.rates.mockResolvedValue([]);
    const copy = getCommerceHistoryCopy("en");
    const markup = await html();
    expect(markup).toContain(
      copy.saleLineEstimateNone.replace("{base}", "USD").replace("{quote}", "EUR"),
    );
    expect(markup).toContain(
      copy.saleLineEstimateNone.replace("{base}", "USD").replace("{quote}", "RUB"),
    );
    expect(markup).not.toContain(copy.saleLineEstimateUnavailable);
  });

  it("uses dust and invalid sentences for those pairs", async () => {
    state.rates.mockResolvedValue([
      { baseCurrency: "USD", quoteCurrency: "EUR", baseAmount: 100_000, quoteAmount: 1 },
      { baseCurrency: "USD", quoteCurrency: "RUB", baseAmount: 1, quoteAmount: 100_000_000 },
    ]);
    const copy = getCommerceHistoryCopy("en");
    const markup = await html();
    expect(markup).toContain(
      copy.saleLineEstimateDust.replace("{base}", "USD").replace("{quote}", "EUR"),
    );
    expect(markup).toContain(
      copy.saleLineEstimateInvalid.replace("{base}", "USD").replace("{quote}", "RUB"),
    );
    expect(markup).not.toContain(copy.saleLineEstimateUnavailable);
  });

  it("uses the Russian sentences", async () => {
    state.locale = "ru";
    state.rates.mockResolvedValue([]);
    const copy = getCommerceHistoryCopy("ru");
    const markup = await html();
    expect(markup).toContain(
      copy.saleLineEstimateNone.replace("{base}", "USD").replace("{quote}", "EUR"),
    );
    expect(markup).toContain("Записанного курса");
    expect(copy.saleLineEstimateDust).not.toBe(copy.saleLineEstimateNone);
    expect(copy.saleLineEstimateInvalid).not.toBe(copy.saleLineEstimateDust);
    expect(copy.saleLineEstimateUnavailable).not.toBe(copy.saleLineEstimateNone);
  });

  it("leaves the stored line alone when the wallet engine is off", async () => {
    delete process.env.NEXUS_WALLET_ENGINE;
    const copy = getCommerceHistoryCopy("en");
    const markup = await html();
    expect(markup).toContain(formatHistoryAmount(250, "USD", "en"));
    expect(markup).not.toContain(copy.saleLineEstimateUnavailable);
    expect(markup).not.toContain("recorded rate");
    expect(state.rates).not.toHaveBeenCalled();
  });
});
