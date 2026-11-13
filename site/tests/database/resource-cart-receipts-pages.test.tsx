import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { LocaleProvider } from "../../src/components/locale-context";
import { ResourceCartControls } from "../../src/components/resource-cart-controls";

const state = vi.hoisted(() => ({
  user: { id: "usr_a" } as { id: string } | null,
  locale: "en" as "en" | "ru",
  page: vi.fn(),
  detail: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  usePathname: () => "/workspace/acquisitions/receipts",
}));
vi.mock("../../src/lib/i18n-server", () => ({
  getRequestLocale: async () => state.locale,
}));
vi.mock("../../src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.user },
}));
vi.mock("../../src/lib/services/resource-cart-receipts-service", () => ({
  resourceCartReceiptsService: { page: state.page, detail: state.detail },
}));
vi.mock("../../src/features/resources/download", () => ({
  ResourceDownloadButton: ({ productId, buildId }: { productId: string; buildId: string }) => (
    <button type="button">
      {productId}:{buildId}
    </button>
  ),
}));

import Detail from "../../src/app/workspace/acquisitions/receipts/[id]/page";
import DetailLoading from "../../src/app/workspace/acquisitions/receipts/[id]/loading";
import Page, { generateMetadata } from "../../src/app/workspace/acquisitions/receipts/page";
import ListLoading from "../../src/app/workspace/acquisitions/receipts/loading";
import { resourceCartReceiptsCopy } from "../../src/lib/resource-cart-receipts-i18n";

const requestId = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  vi.clearAllMocks();
  state.user = { id: "usr_a" };
  state.locale = "en";
  state.page.mockResolvedValue({
    items: [
      {
        requestId,
        reviewed: true,
        createdAt: new Date("2026-10-11T00:00:00Z"),
        itemCount: 1,
        userId: "DO_NOT_RENDER",
        reviewDigest: "DO_NOT_RENDER",
      },
    ],
    page: 2,
    totalPages: 3,
    total: 42,
  });
  state.detail.mockResolvedValue({
    requestId,
    createdAt: new Date("2026-10-11T00:00:00Z"),
    reviewed: true,
    items: [
      {
        productId: "prd_a",
        title: "<Original title>",
        version: "1.0.0",
        buildId: "bld_a",
        sha256Hash: "a".repeat(64),
        fileSizeBytes: 7,
        mtaMinVersion: null,
        dependencies: ["base_resource"],
        accessSource: "license",
        alreadyClaimed: true,
        recordedExpiresAt: "2026-11-01T00:00:00Z",
        downloadable: true,
        hasCurrentAccess: true,
        storageKey: "DO_NOT_RENDER",
      },
    ],
  });
});
it.each(["ru", "en"] as const)(
  "renders localized private archive and preserves filters (%s)",
  async (locale) => {
    state.locale = locale;
    const html = renderToStaticMarkup(
      await Page({
        searchParams: Promise.resolve({ page: "2", days: "30", evidence: "reviewed" }),
      }),
    );
    expect(html).toContain(
      locale === "ru" ? "Квитанции бесплатного получения" : "Free acquisition receipts",
    );
    expect(html).toContain("days=30&amp;evidence=reviewed");
    expect(html).toContain("receipts/export?");
    expect(html).not.toContain("DO_NOT_RENDER");
    expect((await generateMetadata()).robots).toEqual({ index: false, follow: false });
  },
);
it("distinguishes never-empty receipts from filtered or paginated empty pages", async () => {
  const copy = resourceCartReceiptsCopy("en");
  state.page.mockResolvedValueOnce({ items: [], page: 1, totalPages: 1, total: 0 });
  const never = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
  expect(never).toContain(copy.emptyNever);
  expect(never).not.toContain(copy.emptyFiltered);
  expect(never.split(copy.clear).length).toBe(2);

  state.page.mockResolvedValueOnce({ items: [], page: 1, totalPages: 1, total: 0 });
  const filtered = renderToStaticMarkup(
    await Page({ searchParams: Promise.resolve({ days: "7" }) }),
  );
  expect(filtered).toContain(copy.emptyFiltered);
  expect(filtered.split(copy.clear).length).toBe(3);
  expect(filtered).not.toContain(copy.emptyNever);

  state.page.mockResolvedValueOnce({ items: [], page: 3, totalPages: 3, total: 42 });
  const emptyPage = renderToStaticMarkup(
    await Page({ searchParams: Promise.resolve({ page: "3" }) }),
  );
  expect(emptyPage).toContain(copy.emptyFiltered);
  expect(emptyPage.split(copy.clear).length).toBe(3);
  expect(emptyPage).not.toContain(copy.emptyNever);
});
it("authenticates and rejects repeated filters before querying receipts", async () => {
  state.user = null;
  const html = renderToStaticMarkup(
    await Page({ searchParams: Promise.resolve({ userId: "other" }) }),
  );
  expect(html).toContain("/auth/login");
  expect(state.page).not.toHaveBeenCalled();
  state.user = { id: "usr_a" };
  const copy = resourceCartReceiptsCopy("en");
  const invalid = renderToStaticMarkup(
    await Page({ searchParams: Promise.resolve({ days: ["7", "30"] }) }),
  );
  expect(invalid).toContain(copy.invalid);
  expect(invalid).toContain('role="alert"');
  expect(invalid).toContain("bg-danger-soft");
  expect(invalid).toContain("overflow-x-clip");
  expect(invalid).toContain('href="/workspace/acquisitions/receipts"');
  expect(state.page).not.toHaveBeenCalled();
});
it("shows frozen evidence with an exact-build retry, without rendering private fields", async () => {
  const html = renderToStaticMarkup(await Detail({ params: Promise.resolve({ id: requestId }) }));
  expect(html).toContain("&lt;Original title&gt;");
  expect(html).toContain("prd_a:bld_a");
  expect(html).toContain("Existing access retained");
  expect(html).toContain("base_resource");
  expect(html).not.toContain("DO_NOT_RENDER");
});
it("revoked access removes download controls while preserving the buyer's recorded public snapshot", async () => {
  const receipt = await state.detail();
  receipt.items[0].downloadable = false;
  receipt.items[0].hasCurrentAccess = false;
  state.detail.mockResolvedValue(receipt);
  const html = renderToStaticMarkup(await Detail({ params: Promise.resolve({ id: requestId }) }));
  expect(html).toContain("&lt;Original title&gt;");
  expect(html).toContain("no longer have effective");
  expect(html).not.toContain("prd_a:bld_a");
  expect(html).not.toContain("/versions");
});
it("legacy receipts explicitly retain absent version evidence", async () => {
  state.detail.mockResolvedValue({
    requestId,
    createdAt: new Date(),
    reviewed: false,
    items: [],
    legacyProductCount: 2,
  });
  const html = renderToStaticMarkup(await Detail({ params: Promise.resolve({ id: requestId }) }));
  expect(html).toContain("no recorded version evidence");
  expect(html).not.toContain("SHA-256");
  expect(html).not.toContain("<button");
});
it.each(["en", "ru"] as const)(
  "requires a server review before rendering acquisition confirmation (%s)",
  (locale) => {
    const html = renderToStaticMarkup(
      <LocaleProvider locale={locale}>
        <ResourceCartControls
          initialCart={{
            items: [
              {
                productId: "prd_a",
                available: true,
                alreadyOwned: false,
                title: "Resource",
                slug: "resource",
                version: "1.0.0",
              },
            ],
            limit: 20,
          }}
        />
      </LocaleProvider>,
    );
    expect(html).toContain(
      locale === "ru" ? "Проверить выбранные версии" : "Review selected versions",
    );
    expect(html).not.toContain(
      locale === "ru" ? "Подтвердить просмотренные ресурсы" : "Confirm reviewed resources",
    );
    expect(html).toContain("/workspace/acquisitions/receipts");
  },
);
it("shows an honest recovery state when acquisition receipts fail to load", async () => {
  state.page.mockRejectedValueOnce(new Error("receipts unavailable"));
  const copy = resourceCartReceiptsCopy("en");
  const html = renderToStaticMarkup(
    await Page({ searchParams: Promise.resolve({ page: "2", days: "30" }) }),
  );
  expect(html).toContain('role="alert"');
  expect(html).toContain(copy.loadUnavailable);
  expect(html).toContain("overflow-x-clip");
  expect(html).toContain("days=30");
  expect(html).not.toContain("receipts unavailable");
});
it("shows an honest recovery state when a receipt detail fails to load", async () => {
  state.detail.mockRejectedValueOnce(new Error("receipt unavailable"));
  const copy = resourceCartReceiptsCopy("en");
  const html = renderToStaticMarkup(await Detail({ params: Promise.resolve({ id: requestId }) }));
  expect(html).toContain('role="alert"');
  expect(html).toContain(copy.loadUnavailable);
  expect(html).toContain("overflow-x-clip");
  expect(html).toContain(`href="/workspace/acquisitions/receipts/${requestId}"`);
});
it("clips honest receipt loading shells on narrow layouts", async () => {
  for (const Loading of [ListLoading, DetailLoading]) {
    const html = renderToStaticMarkup(await Loading());
    expect(html).toContain("min-w-0");
    expect(html).toContain("overflow-x-clip");
  }
});
