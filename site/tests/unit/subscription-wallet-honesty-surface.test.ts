import { describe, expect, it } from "vitest";
import { getCommercialCopy } from "../../src/features/commerce/commercial-i18n";
import { subscriptionsCopy } from "../../src/features/commerce/subscriptions-i18n";

describe("subscription wallet honesty surface", () => {
  it("does not claim paid plans only wait on a missing payment provider", () => {
    for (const locale of ["en", "ru"] as const) {
      const subscriptions = subscriptionsCopy(locale);
      const commercial = getCommercialCopy(locale);
      expect(subscriptions.notice.toLowerCase()).toContain("site wallet");
      expect(subscriptions.paymentRequired.toLowerCase()).toContain("site wallet");
      expect(commercial.planNote.toLowerCase()).toContain("site wallet");
      expect(subscriptions.notice).not.toMatch(/awaits a payment provider/i);
      expect(subscriptions.paymentRequired).not.toMatch(/requires a payment provider/i);
      expect(commercial.planNote).not.toMatch(/until a payment provider is integrated/i);
    }
  });
});
