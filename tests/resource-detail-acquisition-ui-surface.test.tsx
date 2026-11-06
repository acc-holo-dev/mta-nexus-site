import { describe, expect, it, vi } from "vitest";

// Keep unit classification: entry-level full mock cuts the @nexus/db import edge.
vi.mock("@nexus/db", () => ({
  resourceMediaRepository: { publicItems: async () => [], managed: async () => ({ items: [] }) },
  notificationRepository: {
    getPreferences: vi.fn(async () => ({
      followsEnabled: true,
      contentEnabled: true,
      serverEnabled: true,
      commerceEnabled: true,
      systemEnabled: true,
    })),
  },
  followWorkspaceRepository: {
    states: vi.fn(async () => [] as string[]),
    muteState: vi.fn(async () => ({ muted: false, mutedUntil: null })),
  },
}));

import "./helpers/resource-detail-acquisition-ui-harness";
import ProductDetailPage from "../apps/web/src/app/market/[slug]/page";
import { getDictionary } from "../apps/web/src/lib/i18n";
import { licenseModelLabel } from "../apps/web/src/lib/license-model-i18n";
import {
  build,
  product,
  productService,
  renderPage,
  setupResourceDetailAcquisitionUi,
  state,
} from "./helpers/resource-detail-acquisition-ui-state";

setupResourceDetailAcquisitionUi();

describe("resource detail acquisition surface", () => {
  it.each(["en", "ru"] as const)(
    "routes an unclaimed free resource through acquisition in %s",
    async (locale) => {
      state.locale = locale;
      const copy = getDictionary(locale).product;
      const html = renderPage(
        await ProductDetailPage({
          params: Promise.resolve({ slug: "detail-resource" }),
        }),
      );

      expect(html).toContain("Detail Resource");
      expect(html).toContain(licenseModelLabel(locale, "unlimited"));
      expect(html).not.toContain("multiple_servers");
      expect(html).toContain('href="/acquire?productId=prd_detail"');
      expect(html).toContain(copy.addToLibrary);
      expect(html).toContain(copy.latestBuildNotice);
      expect(html).toContain('href="/market/detail-resource/versions"');
      expect(html).toContain('data-acquire-intent="single"');
      expect(html).toContain("focus-visible:outline-white");
      expect(html).toContain('data-testid="resource-release-watch"');
      expect(html).toContain('data-guest="true"');
      expect((html.match(/data-testid="build-provenance"/gu) ?? []).length).toBe(2);
      expect(html).not.toContain('data-testid="resource-download"');
      expect(html).not.toContain(getDictionary(locale).checkout.paidDisabled);
      // Narrow viewports follow DOM order; acquisition must precede deep content.
      expect(html.indexOf('data-testid="resource-acquisition-panel"')).toBeGreaterThan(-1);
      expect(html.indexOf('data-testid="resource-acquisition-panel"')).toBeLessThan(
        html.indexOf('data-testid="resource-detail-content"'),
      );
      expect(html).toContain("lg:order-2");
      expect(html).toContain("lg:order-1 lg:col-span-2");
      expect((html.match(/data-acquire-intent="single"/gu) ?? []).length).toBe(1);
      expect((html.match(/data-testid="resource-release-watch"/gu) ?? []).length).toBe(1);
    },
  );

  it("keeps paid free-beta resources visibly disabled without acquisition mutations", async () => {
    state.product = product(1999);
    const dictionary = getDictionary("en");

    const html = renderPage(
      await ProductDetailPage({
        params: Promise.resolve({ slug: "detail-resource" }),
      }),
    );

    expect(html).toContain(dictionary.checkout.paidUnavailable);
    expect(html).toContain(dictionary.checkout.paidDisabled);
    expect(html).not.toContain("/acquire?productId=prd_detail");
    expect(html).not.toContain("/checkout?productId=prd_detail");
    expect(html).not.toContain('data-testid="resource-download"');
  });

  it("renders exactly one latest-build download action for an entitled user regardless of build history length", async () => {
    state.user = {
      id: "usr_entitled",
      username: "entitled",
      role: "user",
    };
    state.entitled = true;

    const html = renderPage(
      await ProductDetailPage({
        params: Promise.resolve({ slug: "detail-resource" }),
      }),
    );

    expect(productService.getProductBuilds).toHaveBeenCalledWith("prd_detail", false);
    expect((html.match(/data-testid="resource-download"/gu) ?? []).length).toBe(1);
    expect(html).toContain('data-product-id="prd_detail"');
    expect(html).toContain('data-version="2.0.0"');
    expect(html).toContain('data-download-intent="latest"');
    expect(html).toContain('data-testid="resource-release-watch"');
    expect(html).toContain('data-has-access="true"');
    expect(html).toContain('href="/workspace/library"');
    expect(html).not.toMatch(/href="\/workspace"/u);
    expect(html).not.toContain("/acquire?productId=prd_detail");
    // History list (2) + download aside for published current version (1).
    expect((html.match(/data-testid="build-provenance"/gu) ?? []).length).toBe(3);
    expect(html).toContain('data-build-id="bld_latest"');
    expect(html.indexOf('data-testid="resource-acquisition-panel"')).toBeLessThan(
      html.indexOf('data-testid="resource-detail-content"'),
    );
    expect(html.indexOf('data-testid="resource-download"')).toBeLessThan(
      html.indexOf(getDictionary("en").product.releaseHistory),
    );
  });

  it("lets a current manager inspect builds and download without entitlement", async () => {
    state.user = {
      id: "usr_manager",
      username: "manager",
      role: "user",
    };
    state.canManage = true;

    const html = renderPage(
      await ProductDetailPage({
        params: Promise.resolve({ slug: "detail-resource" }),
      }),
    );

    expect(productService.getProductBuilds).toHaveBeenCalledWith("prd_detail", true);
    expect((html.match(/data-testid="resource-download"/gu) ?? []).length).toBe(1);
    expect(html).toContain(getDictionary("en").product.managementAccess);
  });

  it("shows public author attribution and honest zero-review copy without private ids", async () => {
    state.product = product(0);
    state.product.ratingCount = 0;
    state.product.ratingAverage = 0;
    const copy = getDictionary("en").product;

    const html = renderPage(
      await ProductDetailPage({
        params: Promise.resolve({ slug: "detail-resource" }),
      }),
    );

    expect(productService.getPublicAttribution).toHaveBeenCalledWith("prd_detail");
    expect(html).toContain('href="/developers/detail_author"');
    expect(html).toContain("focus-visible:outline-[var(--nexus-accent)]");
    expect(html).toContain("Detail Author");
    expect(html).toContain(copy.noReviewsYet);
    expect(html).toContain(copy.libraryAdditions);
    expect(html).not.toContain(">0.0 / 5.0");
    expect(html).not.toMatch(/usr_|install/i);
  });

  it("shows version-scoped help for the published download version", async () => {
    const productId = `prd_${"c".repeat(24)}`;
    const buildId = `bld_${"d".repeat(24)}`;
    state.product = {
      ...product(0),
      id: productId,
      shortDescription: "Scoped purpose",
    };
    state.builds = [
      {
        ...build(buildId, "2.0.0"),
        releaseNotes: "Configure cache\n```cfg\nset fpslimit 60\n```",
      },
      build("bld_old", "1.0.0"),
    ];

    const copy = getDictionary("en").versionHelpUi;
    const html = renderPage(
      await ProductDetailPage({
        params: Promise.resolve({ slug: "detail-resource" }),
      }),
    );

    expect(html).toContain('data-testid="resource-version-help"');
    expect(html).toContain('data-version="2.0.0"');
    expect(html).toContain("Scoped purpose");
    expect(html).toContain("set fpslimit 60");
    expect(html).toContain(copy.acquireDisclaimer);
    expect(html).toContain('href="#resource-qa"');
    expect(html).toContain("/support?category=resource");
    expect(html).not.toMatch(/incompatible|guaranteed/iu);
  });

  it("shows missing instruction copy without inventing setup for another version", async () => {
    state.product = { ...product(0), shortDescription: "" };
    state.builds = [build("bld_latest", "2.0.0")];
    const copy = getDictionary("en").versionHelpUi;

    const html = renderPage(
      await ProductDetailPage({
        params: Promise.resolve({ slug: "detail-resource" }),
      }),
    );

    expect(html).toContain("The author has not added version-specific setup notes yet");
    expect(html).not.toContain(copy.sections.setup);
    expect(html).not.toContain("set fpslimit 60");
  });
});
