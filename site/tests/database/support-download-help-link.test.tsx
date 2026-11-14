import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { SupportDownloadHelpLink } from "../../src/components/support-download-help-link";

const productId = `prd_${"a".repeat(24)}`;
const buildId = `bld_${"b".repeat(24)}`;
const receiptId = `dlv_${"c".repeat(24)}`;

it("links a verified download to a resource support case", () => {
  const html = renderToStaticMarkup(
    <SupportDownloadHelpLink
      productId={productId}
      buildId={buildId}
      receiptId={receiptId}
      label="Ask about this download"
    />,
  );
  expect(html).toContain('href="/support?category=resource"');
  expect(html).toContain("Ask about this download");
  expect(html).toContain("focus-visible:outline-2");
});

it("omits the support link when download ids are not verified", () => {
  const html = renderToStaticMarkup(
    <SupportDownloadHelpLink
      productId="prd_a"
      buildId="bld_old"
      receiptId="dlv_a"
      label="Ask about this download"
    />,
  );
  expect(html).toBe("");
});
