import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { checkoutApiCopy } from "../../src/features/commerce/checkout-api-copy";
import { productsApiCopy } from "../../src/features/resources/products-api-copy";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("paid create and card checkout wallet honesty", () => {
  it("stops blaming a missing live payment provider for paid create and card checkout", () => {
    expect(productsApiCopy("en").paidDisabled).not.toMatch(/payment provider is configured/i);
    expect(productsApiCopy("ru").paidDisabled).not.toMatch(/пока не настроен платёжный провайдер/i);
    expect(checkoutApiCopy("en").disabled).not.toMatch(/open free beta/i);
    expect(checkoutApiCopy("en").disabled).toContain("site-wallet");

    const publishingEn = read("site/src/lib/i18n/en/publishing.ts");
    const publishingRu = read("site/src/lib/i18n/ru/publishing.ts");
    const service = read("site/src/lib/services/commerce/product-service.ts");
    expect(publishingEn).toContain("site wallet engine and a single-server listing");
    expect(publishingEn).not.toContain(
      "Paid resource publishing is unavailable during the open free beta.",
    );
    expect(publishingRu).toContain("site wallet engine");
    expect(publishingRu).not.toContain("открытой бесплатной бета-версии");
    expect(service).not.toContain("disabled during the open free beta");
    expect(service).toContain("single-server listings when the site wallet engine is on");
  });
});
