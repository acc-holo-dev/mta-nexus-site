import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ReportEvidenceLinks } from "./report-evidence-links";

it("omits empty and invalid legacy evidence", () => {
  for (const urls of [
    [],
    [
      "javascript:alert(1)",
      "https://user:pass@example.com",
      "https://",
      "https://example.com/\npath",
    ],
  ]) {
    expect(renderToStaticMarkup(<ReportEvidenceLinks urls={urls} label="Evidence" />)).toBe("");
  }
});
it.each(["Evidence", "Доказательства"])(
  "normalizes, deduplicates and labels safe evidence: %s",
  (label) => {
    const html = renderToStaticMarkup(
      <ReportEvidenceLinks
        label={label}
        urls={[
          "https://EXAMPLE.com",
          "https://example.com/",
          "http://example.com/proof",
          "data:text/html,bad",
        ]}
      />,
    );
    expect(html.match(/<a /g)).toHaveLength(2);
    expect(html).toContain('href="https://example.com/"');
    expect(html).toContain(`aria-label="${label} 2: http://example.com/proof"`);
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toContain("data:text");
  },
);
it("bounds legacy evidence to five entries", () => {
  const html = renderToStaticMarkup(
    <ReportEvidenceLinks
      label="Evidence"
      urls={Array.from({ length: 8 }, (_, i) => `https://example.com/${i}`)}
    />,
  );
  expect(html.match(/<a /g)).toHaveLength(5);
  expect(html).not.toContain('href="https://example.com/5"');
});
