import { AppError } from "@nexus/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  page: vi.fn(),
  attributions: vi.fn(),
  viewer: vi.fn(),
  states: vi.fn(),
  muteStates: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/discover" }));
vi.mock("@nexus/db", () => ({
  followWorkspaceRepository: { states: mocks.states, muteStates: mocks.muteStates },
}));
vi.mock("../../src/lib/services/auth-service", () => ({
  authService: { getSession: mocks.viewer },
}));
vi.mock("../../src/lib/services/discovery-service", () => ({
  discoveryService: { page: mocks.page },
}));
vi.mock("../../src/lib/services/mta-master-directory-service", () => ({
  mtaMasterDirectoryService: { getDirectory: async () => null },
  indexMtaObservations: () => () => null,
}));
vi.mock("../../src/lib/services/product-service", () => ({
  productService: { getPublicAttributions: mocks.attributions },
}));
vi.mock("../../src/lib/i18n-server", () => ({
  getRequestLocale: async () => "en",
}));

import DiscoverPage from "../../src/app/discover/page";
import { DirectoryFilters, DirectoryResults } from "../../src/components/discovery-directory";
import { LocaleProvider } from "../../src/components/locale-context";
import { parseDiscoverQuery } from "../../src/lib/discover-query";
import { discoveryCopy } from "../../src/lib/discovery-copy";
import { getDictionary } from "../../src/lib/i18n";

function resourceProduct() {
  return {
    id: "prd_discover",
    slug: "discover-resource",
    title: "Discover Resource Pack",
    shortDescription: "Public free resource for Discover hits.",
    description: "Longer description for the Discover resources journey.",
    thumbnailUrl: null,
    type: "script" as const,
    price: 0,
    currency: "USD",
    licenseModel: "unlimited" as const,
    currentVersion: "1.2.0",
    status: "published" as const,
    tags: ["drift"],
    compatibility: { mtaMinVersion: "1.6.0", dependencies: [] },
    salesCount: 3,
    ratingAverage: 0,
    ratingCount: 0,
    updatedAt: "2026-11-04T00:00:00.000Z",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.viewer.mockResolvedValue(null);
  mocks.states.mockResolvedValue([]);
  mocks.muteStates.mockResolvedValue([]);
  mocks.attributions.mockResolvedValue(new Map());
  mocks.page.mockResolvedValue({ type: "resources", items: [], page: 1, hasMore: false });
});

describe("Discover resources primary journey", () => {
  it.each(["en", "ru"] as const)(
    "links a resources hit to the public market detail in %s",
    async (locale) => {
      const product = resourceProduct();
      mocks.page.mockResolvedValue({
        type: "resources",
        items: [product],
        page: 1,
        hasMore: false,
      });
      const state = parseDiscoverQuery({ type: "resources", q: "Discover Resource" });
      const html = renderToStaticMarkup(
        <LocaleProvider locale={locale}>
          {await DirectoryResults({ state, locale })}
        </LocaleProvider>,
      );

      expect(mocks.page).toHaveBeenCalledWith(state);
      expect(html).toContain(`href="/market/${product.slug}"`);
      expect(html).toContain(product.title);
      expect(html).toContain(getDictionary(locale).market.free);
      expect(html).not.toContain('role="alert"');
      expect(html).not.toContain(discoveryCopy(locale).empty);
      expect(html).not.toContain(discoveryCopy(locale).emptyFiltered);
    },
  );

  it.each(["en", "ru"] as const)(
    "shows confirmed filtered empty with clear actions for resources in %s",
    async (locale) => {
      const copy = discoveryCopy(locale);
      const state = parseDiscoverQuery({ type: "resources", q: "no-such-pack" });
      mocks.page.mockResolvedValue({ type: "resources", items: [], page: 1, hasMore: false });
      const filters = renderToStaticMarkup(<DirectoryFilters state={state} locale={locale} />);
      const results = renderToStaticMarkup(await DirectoryResults({ state, locale }));

      expect(filters).toContain(`aria-label="${copy.filter}"`);
      expect(filters).toContain(copy.clearQuery);
      expect(filters).toContain(copy.reset);
      expect(filters).toContain('href="/discover?type=resources"');
      expect(filters).toContain("min-w-0 flex-1 sm:min-w-48");
      expect(results).toContain(copy.empty);
      expect(results).toContain(copy.emptyFiltered);
      expect(results).toContain(copy.activeFilters);
      expect(results).toContain(copy.clearQuery);
      expect(results).toContain(copy.reset);
      expect(results).not.toContain('role="alert"');
      expect(results).not.toContain(copy.unavailable);
    },
  );

  it("keeps reset hidden until a Discover filter is active", () => {
    const idle = parseDiscoverQuery({ type: "resources" });
    const html = renderToStaticMarkup(<DirectoryFilters state={idle} locale="en" />);
    expect(html).not.toContain(discoveryCopy("en").reset);
    expect(html).not.toContain(discoveryCopy("en").clearQuery);
  });

  it("shows resource directory failures as alerts, not empty catalogs", async () => {
    mocks.page.mockRejectedValue(new AppError("db down", 503, "INTERNAL_ERROR"));
    const html = renderToStaticMarkup(
      await DirectoryResults({
        state: parseDiscoverQuery({ type: "resources", q: "pack" }),
        locale: "en",
      }),
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain(discoveryCopy("en").unavailable);
    expect(html).not.toContain(discoveryCopy("en").empty);
    expect(html).not.toContain(discoveryCopy("en").emptyFiltered);
    expect(html).not.toContain("db down");
  });

  it("keeps the Discover page shell clipped and resources tab wired", async () => {
    mocks.page.mockResolvedValue({
      type: "resources",
      items: [resourceProduct()],
      page: 1,
      hasMore: false,
    });
    const html = renderToStaticMarkup(
      <LocaleProvider locale="en">
        {
          await DiscoverPage({
            searchParams: Promise.resolve({ type: "resources", q: "Discover Resource" }),
          })
        }
      </LocaleProvider>,
    );
    expect(html).toContain("min-w-0 space-y-7 overflow-x-clip");
    expect(html).toContain(getDictionary("en").discover.title);
    expect(html).toContain('href="/discover?type=resources&amp;q=Discover+Resource"');
    expect(html).toContain('href="/market/discover-resource"');
    expect(html).toContain(discoveryCopy("en").filter);
  });
});
