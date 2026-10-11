import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LocaleProvider } from "../apps/web/src/components/locale-context";
import { ResourceCartControls } from "../apps/web/src/components/resource-cart-controls";
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
}));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => state.locale }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.user },
}));
vi.mock("../apps/web/src/lib/services/resource-cart-receipts-service", () => ({
  resourceCartReceiptsService: { page: state.page, detail: state.detail },
}));
vi.mock("../apps/web/src/components/resource-download-button", () => ({
  ResourceDownloadButton: ({ productId, buildId }: { productId: string; buildId: string }) => (
    <button type="button">
      {productId}:{buildId}
    </button>
  ),
}));
import Page, { generateMetadata } from "../apps/web/src/app/workspace/acquisitions/receipts/page";
import Detail from "../apps/web/src/app/workspace/acquisitions/receipts/[id]/page";
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
it("authenticates and rejects repeated filters before querying receipts", async () => {
  state.user = null;
  const html = renderToStaticMarkup(
    await Page({ searchParams: Promise.resolve({ userId: "other" }) }),
  );
  expect(html).toContain("/auth/login");
  expect(state.page).not.toHaveBeenCalled();
  state.user = { id: "usr_a" };
  expect(
    renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ days: ["7", "30"] }) })),
  ).toContain("Invalid receipt filters");
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
