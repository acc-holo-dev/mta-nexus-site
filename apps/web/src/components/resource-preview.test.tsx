import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { PRODUCT_TYPES, type Product } from "@nexus/domain";
import { getDictionary } from "../lib/i18n";
import { PRODUCT_PUBLISHING_KEYS } from "../lib/product-type-labels";
import { ResourcePreview } from "./resource-preview";
import { ProductCard } from "./product-card";

it.each([undefined, "", "javascript:alert(1)", "data:image/png,bad", "https://user:pass@example.com/a.png", "https://example.com/\na.png"])("uses a fallback for unsafe or missing preview %s", (src) => {
  const html = renderToStaticMarkup(createElement(ResourcePreview, { src, title: "Example", fallback: "Нет превью" }));
  expect(html).toContain("Нет превью");
  expect(html).not.toContain("<img");
});

it("preserves safe image URLs and prioritizes only the detail preview", () => {
  const props = { src: "https://example.com/image.png", title: "Resource", fallback: "No preview" };
  const card = renderToStaticMarkup(createElement(ResourcePreview, props));
  const detail = renderToStaticMarkup(createElement(ResourcePreview, { ...props, priority: true }));
  expect(card).toContain('loading="lazy"');
  expect(detail).toContain('fetchPriority="high"');
  expect(detail).toContain('alt="Resource"');
  expect(detail).toContain('src="https://example.com/image.png"');
});

it.each(["en", "ru"] as const)("localizes every resource category in cards in %s", (locale) => {
  for (const type of PRODUCT_TYPES) {
    const product: Product = { id: "example", slug: "example", title: "Example", description: "Description", type, status: "published", authorId: "author", price: 0, currency: "USD", licenseModel: "unlimited", isFeatured: false, screenshots: [], compatibility: {}, createdAt: new Date("2026-01-01"), tags: [], updatedAt: new Date("2026-01-01"), ratingAverage: 0, ratingCount: 0, salesCount: 0, currentVersion: "1.0.0" };
    const html = renderToStaticMarkup(createElement(ProductCard, { product, locale }));
    expect(html).toContain(getDictionary(locale).publishing[PRODUCT_PUBLISHING_KEYS[type]]);
    expect(html).toContain(getDictionary(locale).market.noPreview);
  }
});
