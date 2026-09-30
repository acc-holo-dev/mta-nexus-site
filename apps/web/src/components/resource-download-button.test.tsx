import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { LocaleProvider } from "./locale-context";
import { ResourceDownloadButton } from "./resource-download-button";

it.each(["en", "ru"] as const)("renders an accessible download button in %s", (locale) => {
  const html = renderToStaticMarkup(
    <LocaleProvider locale={locale}>
      <ResourceDownloadButton productId="product" version="1.2.3" />
    </LocaleProvider>,
  );
  expect(html).toContain('type="button"');
  expect(html).toContain('aria-busy="false"');
  expect(html).toContain(locale === "ru" ? "Скачать сборку" : "Download Build");
  expect(html).toContain("v1.2.3");
  expect(html).not.toContain("/api/products/");
});
