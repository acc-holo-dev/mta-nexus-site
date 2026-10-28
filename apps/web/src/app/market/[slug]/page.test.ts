import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ thumbnail: "", missing: false, locale: "en" as "en" | "ru" }));
vi.mock("../../../lib/services/product-service", () => ({
  productService: {
    getProductBySlug: async () =>
      state.missing
        ? null
        : {
            title: "Resource",
            slug: "saved-slug",
            shortDescription: "Description",
            thumbnailUrl: state.thumbnail,
          },
  },
}));
vi.mock("../../../lib/services/content-service", () => ({ contentService: {} }));
vi.mock("../../../lib/services/auth-service", () => ({ authService: {} }));
vi.mock("../../../lib/services/commerce-service", () => ({ commerceService: {} }));
vi.mock("../../../lib/i18n-server", () => ({ getRequestLocale: async () => state.locale }));
import { generateMetadata } from "./page";
const input = () => ({ params: Promise.resolve({ slug: "requested-slug" }) });
beforeEach(() => {
  state.thumbnail = "";
  state.missing = false;
  state.locale = "en";
});
it.each([
  "javascript:alert(1)",
  "data:image/png,bad",
  "https://user:pass@example.com/a.png",
  "https://example.com/\na.png",
])("hides unsafe Open Graph preview %s", async (thumbnail) => {
  state.thumbnail = thumbnail;
  expect((await generateMetadata(input())).openGraph).toMatchObject({ images: undefined });
});
it("preserves safe previews and the canonical saved slug", async () => {
  state.thumbnail = "https://example.com/image.png";
  expect(await generateMetadata(input())).toMatchObject({
    alternates: { canonical: "/market/saved-slug" },
    openGraph: { images: [{ url: state.thumbnail }] },
  });
});
it.each(["en", "ru"] as const)("does not index missing resources in %s", async (locale) => {
  state.locale = locale;
  state.missing = true;
  expect(await generateMetadata(input())).toMatchObject({
    robots: { index: false, follow: false },
  });
});
