import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { LocaleProvider } from "./locale-context";
import { ResourceDownloadButton } from "./resource-download-button";

it.each(["en", "ru"] as const)("renders latest download intent in %s", (locale) => {
  const html = renderToStaticMarkup(
    <LocaleProvider locale={locale}>
      <ResourceDownloadButton productId="product" version="1.2.3" intent="latest" />
    </LocaleProvider>,
  );
  expect(html).toContain('type="button"');
  expect(html).toContain('aria-busy="false"');
  expect(html).toContain('data-download-intent="latest"');
  expect(html).toContain("rounded-lg");
  expect(html).toContain("bg-success-solid");
  expect(html).toContain(locale === "ru" ? "Скачать последнюю" : "Download latest");
  expect(html).toContain("v1.2.3");
  expect(html).toContain(
    locale === "ru" ? "не проверяет сохранение" : "does not verify that the file was saved",
  );
  expect(html).not.toContain("/api/products/");
});

it.each(["en", "ru"] as const)("renders selected download intent with build id in %s", (locale) => {
  const html = renderToStaticMarkup(
    <LocaleProvider locale={locale}>
      <ResourceDownloadButton
        productId="product"
        version="1.0.0"
        buildId="bld_fixed"
        intent="selected"
      />
    </LocaleProvider>,
  );
  expect(html).toContain('data-download-intent="selected"');
  expect(html).toContain('data-build-id="bld_fixed"');
  expect(html).toContain(locale === "ru" ? "Скачать выбранную" : "Download selected");
  expect(html).toContain("v1.0.0");
});

it.each(["en", "ru"] as const)("explains unavailable fixed selection without a download action in %s", (locale) => {
  const reason =
    locale === "ru"
      ? "Выбранная сборка недоступна"
      : "The selected build is unavailable";
  const html = renderToStaticMarkup(
    <LocaleProvider locale={locale}>
      <ResourceDownloadButton
        productId="product"
        version="1.0.0"
        buildId="bld_fixed"
        intent="selected"
        unavailableReason={reason}
      />
    </LocaleProvider>,
  );
  expect(html).toContain(reason);
  expect(html).not.toContain('type="button"');
  expect(html).not.toContain("data-download-intent");
});
