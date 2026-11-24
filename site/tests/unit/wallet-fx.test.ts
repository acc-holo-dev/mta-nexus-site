import { AppError, explicitFxLines, publicPriceEstimates, quoteExplicitFx } from "@nexus/domain";
import { describe, expect, it } from "vitest";

describe("explicit exchange quote", () => {
  it("floors a recorded pair and keeps zero at zero", () => {
    expect(quoteExplicitFx({ sourceAmount: 10_000, baseAmount: 100, quoteAmount: 9_000 })).toBe(
      900_000,
    );
    expect(quoteExplicitFx({ sourceAmount: 150, baseAmount: 100, quoteAmount: 9_000 })).toBe(
      13_500,
    );
    expect(quoteExplicitFx({ sourceAmount: 1, baseAmount: 100, quoteAmount: 9_000 })).toBe(90);
    expect(quoteExplicitFx({ sourceAmount: 0, baseAmount: 100, quoteAmount: 9_000 })).toBe(0);
  });

  it("rejects a positive amount that floors to nothing and an oversized result", () => {
    expect(() => quoteExplicitFx({ sourceAmount: 1, baseAmount: 10_000, quoteAmount: 1 })).toThrow(
      AppError,
    );
    try {
      quoteExplicitFx({ sourceAmount: 1, baseAmount: 10_000, quoteAmount: 1 });
    } catch (error) {
      expect(error).toMatchObject({ code: "FX_DUST" });
    }
    expect(() =>
      quoteExplicitFx({ sourceAmount: 100_000_000, baseAmount: 1, quoteAmount: 2 }),
    ).toThrow(AppError);
  });

  it("keeps a missing listing-price direction distinct from a quote", () => {
    expect(
      explicitFxLines({ currency: "EUR", amount: 250 }, [
        { baseCurrency: "EUR", quoteCurrency: "USD", baseAmount: 100, quoteAmount: 110 },
      ]),
    ).toEqual([
      { kind: "quote", base: "EUR", quote: "USD", amount: 275 },
      { kind: "none", base: "EUR", quote: "RUB" },
    ]);
  });

  it("leaves a free card alone and marks a failed rate read", () => {
    const rates = [
      {
        baseCurrency: "EUR" as const,
        quoteCurrency: "USD" as const,
        baseAmount: 100,
        quoteAmount: 110,
      },
    ];
    expect(publicPriceEstimates({ price: 0, currency: "EUR" }, rates)).toBeUndefined();
    expect(publicPriceEstimates({ price: 250, currency: "EUR" }, undefined)).toBeUndefined();
    expect(publicPriceEstimates({ price: 250, currency: "EUR" }, null)).toBeNull();
    expect(publicPriceEstimates({ price: 250, currency: "EUR" }, rates)).toEqual([
      { kind: "quote", base: "EUR", quote: "USD", amount: 275 },
      { kind: "none", base: "EUR", quote: "RUB" },
    ]);
  });
});
