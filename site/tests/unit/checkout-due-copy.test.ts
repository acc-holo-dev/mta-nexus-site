import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const dueKeys = [
  "checkoutDueEstimate",
  "checkoutDueUnavailable",
  "checkoutDueDust",
  "checkoutDueInvalid",
  "checkoutDueNone",
] as const;

describe("checkout due estimate copy", () => {
  it("shows checkout due wording on the amount due and keeps the discount on recorded rates", () => {
    const checkout = read("site/src/features/commerce/components/wallet-checkout-button.tsx");
    const i18n = read("site/src/features/commerce/wallet-i18n.ts");
    const due = checkout.indexOf("<CheckoutDueEstimate");
    const discount = checkout.indexOf('purpose="discount"');

    expect(due).toBeGreaterThan(0);
    expect(discount).toBeGreaterThan(due);
    expect(checkout).toContain("publicPriceEstimates");
    expect(checkout).not.toContain("recordedRateEstimate");
    expect(checkout).toContain("<RecordedRateEstimate");
    for (const key of dueKeys) {
      expect(checkout).toContain(key);
      expect(i18n.match(new RegExp(`${key}:`, "g"))).toHaveLength(2);
    }
    expect(i18n).toContain("About {quote}. The wallet still pays in {base}.");
    expect(i18n).toContain("Примерно {quote}. Кошелёк всё равно платит в {base}.");
    expect(i18n).toContain("No recorded rate from {base} to {quote}.");
    expect(i18n).toContain("Записанного курса из {base} в {quote} нет.");
    expect(i18n).toContain("The recorded rate from {base} to {quote} is too small to show.");
    expect(i18n).toContain("Записанный курс из {base} в {quote} слишком мал, чтобы его показать.");
    expect(i18n).toContain("The recorded rate from {base} to {quote} cannot be shown.");
    expect(i18n).toContain("Записанный курс из {base} в {quote} нельзя показать.");
    expect(i18n).toContain("Recorded rates could not be loaded. The charge is unchanged.");
    expect(i18n).toContain("Записанные курсы не загрузились. Сумма списания не изменилась.");
  });
});
