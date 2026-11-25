import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { getWalletCopy } from "../commerce/wallet-i18n";
import { OrganizationListingRateNote } from "./organization-listing-rate-note";

it("states a missing recorded rate when the organization price has no quote line", () => {
  const html = renderToStaticMarkup(
    <OrganizationListingRateNote price={500} currency="EUR" rates={[]} locale="en" />,
  );
  expect(html).toContain(getWalletCopy("en").recordedRateNone);
});

it("leaves quote and failed rate reads to the product card", () => {
  const quoted = renderToStaticMarkup(
    <OrganizationListingRateNote
      price={500}
      currency="EUR"
      locale="en"
      rates={[{ baseCurrency: "EUR", quoteCurrency: "USD", baseAmount: 100, quoteAmount: 110 }]}
    />,
  );
  const failed = renderToStaticMarkup(
    <OrganizationListingRateNote price={500} currency="EUR" rates={null} locale="ru" />,
  );
  expect(quoted).toBe("");
  expect(failed).toBe("");
  expect(quoted).not.toContain(getWalletCopy("en").recordedRateEstimate);
});
