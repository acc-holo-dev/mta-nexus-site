import type { Product } from "@nexus/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getDictionary } from "../../../lib/i18n";
import { ProductCard } from "./product-card";

vi.mock("next/link", async () => {
  const ReactModule = await import("react");
  return {
    default: ({
      href,
      children,
      ...props
    }: {
      href: string;
      children?: React.ReactNode;
      [key: string]: unknown;
    }) => ReactModule.createElement("a", { href, ...props }, children),
  };
});

vi.mock("./resource-preview", () => ({
  ResourcePreview: ({ title }: { title: string }) => <div data-testid="preview">{title}</div>,
}));

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: "prd_card",
    title: "Race Utils",
    slug: "race-utils",
    description: "Utility scripts for race maps.",
    shortDescription: "Race helpers",
    type: "script",
    status: "published",
    authorId: "usr_author",
    price: 0,
    currency: "USD",
    licenseModel: "unlimited",
    tags: ["race", "utils"],
    currentVersion: "1.2.0",
    ratingAverage: 0,
    ratingCount: 0,
    salesCount: 3,
    isFeatured: false,
    screenshots: [],
    compatibility: {},
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-02-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("ProductCard attribution and honest metrics", () => {
  it("shows zero-review copy instead of a fake 0.0 score", () => {
    const html = renderToStaticMarkup(<ProductCard product={product()} locale="en" />);
    const market = getDictionary("en").market;

    expect(html).toContain(market.noReviewsYet);
    expect(html).not.toContain(">0.0<");
    expect(html).toContain(`class="sr-only"`);
    expect(html).toContain(`${market.libraryAdditions}: 3`);
    expect(html).not.toMatch(/install/i);
  });

  it("keeps Russian zero-review wording and separates author from the card media link", () => {
    const html = renderToStaticMarkup(
      <ProductCard
        product={product({ ratingAverage: 40, ratingCount: 2 })}
        locale="ru"
        attribution={{
          organization: null,
          author: {
            displayName: "Автор Тест",
            username: "author_test",
            href: "/developers/author_test",
          },
        }}
      />,
    );

    expect(html).toContain("4.0");
    expect(html).toContain("(2)");
    expect(html).toContain('href="/developers/author_test"');
    expect(html).toContain("Автор Тест");
    expect(html).not.toContain("usr_author");
    expect(html).not.toMatch(/@|email|\.com/i);
    expect(html.match(/<a\b/g)?.length).toBeGreaterThanOrEqual(2);
    expect(html).toContain("<article");
    expect(html).toContain(
      'class="group flex flex-col overflow-hidden nexus-panel transition-all hover:border-strong hover:shadow-nexus h-full"',
    );
    expect(html).toContain("mt-auto flex items-center justify-between border-t");
  });

  it("prefers organization attribution without nesting it inside the media anchor", () => {
    const html = renderToStaticMarkup(
      <ProductCard
        product={product()}
        attribution={{
          organization: { name: "Studio One", slug: "studio-one" },
          author: {
            displayName: "Hidden On Card",
            username: "hidden",
            href: "/developers/hidden",
          },
        }}
      />,
    );

    expect(html).toContain('href="/organizations/studio-one"');
    expect(html).toContain("Studio One");
    expect(html).not.toContain("Hidden On Card");
    expect(html).not.toContain(getDictionary("en").market.publisherUnavailable);
  });

  it("uses an honest fallback when attribution is missing", () => {
    const html = renderToStaticMarkup(<ProductCard product={product()} locale="en" />);
    expect(html).toContain(getDictionary("en").market.publisherUnavailable);
    expect(html).not.toContain("usr_author");
  });

  it("keeps Free for zero-price listings and never labels paid lines Free", () => {
    const free = getDictionary("en").market.free;
    const freeHtml = renderToStaticMarkup(<ProductCard product={product()} locale="en" />);
    expect(freeHtml).toContain(free);

    const paidHtml = renderToStaticMarkup(
      <ProductCard
        product={product({ price: 499, currency: "EUR", licenseModel: "single_server" })}
        locale="en"
      />,
    );
    expect(paidHtml).toContain("€4.99");
    expect(paidHtml).not.toContain(free);

    const paidRu = renderToStaticMarkup(
      <ProductCard
        product={product({ price: 25000, currency: "RUB", licenseModel: "single_server" })}
        locale="ru"
      />,
    );
    expect(paidRu).toContain("250,00");
    expect(paidRu).toContain("₽");
    expect(paidRu).not.toContain(getDictionary("ru").market.free);
  });

  it("shows a recorded-rate estimate without replacing the listing price", () => {
    const html = renderToStaticMarkup(
      <ProductCard
        product={product({ price: 499, currency: "EUR", licenseModel: "single_server" })}
        locale="en"
        priceEstimates={[{ kind: "quote", base: "EUR", quote: "USD", amount: 550 }]}
      />,
    );
    expect(html).toContain("€4.99");
    expect(html).toContain("About $5.50 at the recorded rate");
  });

  it("says the rate read failed without calling the paid price free", () => {
    const html = renderToStaticMarkup(
      <ProductCard
        product={product({ price: 499, currency: "EUR", licenseModel: "single_server" })}
        locale="en"
        priceEstimates={null}
      />,
    );
    expect(html).toContain("€4.99");
    expect(html).toContain(getDictionary("en").market.priceEstimateUnavailable);
    expect(html).not.toContain(getDictionary("en").market.free);
  });
});
