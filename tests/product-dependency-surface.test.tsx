import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "../apps/web/src/lib/i18n";
import { buildResourceVersionHelp, splitInstructionPlainText } from "@nexus/domain";
import { buildProductDependencyResolution } from "../apps/web/src/lib/product-dependency-resolution";
import { ProductDependencyList } from "../apps/web/src/components/product-dependency-list";
import { ResourceVersionHelpSection } from "../apps/web/src/components/resource-version-help-section";

const mocks = vi.hoisted(() => ({
  findPublishedFreeBySlugs: vi.fn(),
}));

vi.mock("@nexus/db", () => ({
  productRepository: {
    findPublishedFreeBySlugs: mocks.findPublishedFreeBySlugs,
    listPublishedFreeDependingOnSlug: vi.fn(async () => []),
  },
  buildRepository: {},
  organizationRepository: {},
}));

vi.mock("@nexus/security", () => ({
  generateId: vi.fn((prefix: string) => `${prefix}_test`),
  can: vi.fn(() => false),
}));

import { ProductService } from "../apps/web/src/lib/services/product-service";

describe("resource dependency resolution behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves declared dependencies through one normalized repository lookup", async () => {
    mocks.findPublishedFreeBySlugs.mockResolvedValue([
      {
        id: "prd_core",
        slug: "core-ui",
        title: "Core UI",
        type: "ui",
        currentVersion: "2.1.0",
      },
    ]);
    const service = new ProductService();

    const result = await service.getDependencyResolution({
      slug: "vehicle-pack",
      compatibility: {
        dependencies: [" Core-UI ", "core-ui", "missing-pack"],
      },
    });

    expect(mocks.findPublishedFreeBySlugs).toHaveBeenCalledOnce();
    expect(mocks.findPublishedFreeBySlugs).toHaveBeenCalledWith([
      " Core-UI ",
      "core-ui",
      "missing-pack",
    ]);
    expect(result).toMatchObject({
      declaredCount: 2,
      availableCount: 1,
      unresolvedCount: 1,
      dependencies: [
        {
          slug: "core-ui",
          status: "available",
        },
        {
          slug: "missing-pack",
          status: "unresolved",
        },
      ],
    });
  });

  it("skips the repository entirely when nothing was declared", async () => {
    const service = new ProductService();

    await expect(
      service.getDependencyResolution({
        slug: "empty-pack",
        compatibility: { dependencies: [] },
      }),
    ).resolves.toEqual({
      declaredCount: 0,
      availableCount: 0,
      unresolvedCount: 0,
      selfReferenceCount: 0,
      dependencies: [],
    });
    expect(mocks.findPublishedFreeBySlugs).not.toHaveBeenCalled();
  });

  it.each(["en", "ru"] as const)(
    "renders resolved, missing and self-reference states in %s without compatibility claims",
    (locale) => {
      const resolution = buildProductDependencyResolution(
        {
          slug: "vehicle-pack",
          compatibility: {
            dependencies: ["core-ui", "missing-pack", "vehicle-pack"],
          },
        },
        [
          {
            id: "prd_core",
            slug: "core-ui",
            title: "Core UI",
            type: "ui",
            currentVersion: "2.1.0",
          },
        ],
      );
      const copy = getDictionary(locale).dependencyUi;

      const markup = renderToStaticMarkup(
        <ProductDependencyList
          declared={["core-ui", "missing-pack", "vehicle-pack"]}
          resolution={resolution}
          locale={locale}
        />,
      );

      expect(markup).toContain('href="/market/core-ui"');
      expect(markup).toContain("v2.1.0");
      expect(markup).toContain("missing-pack");
      expect(markup).toContain(copy.notFound);
      expect(markup).toContain("vehicle-pack");
      expect(markup).toContain(copy.selfReference);
      expect(markup).toContain(copy.resolutionNotice);
      expect(markup).not.toMatch(/compatible|incompatible|guaranteed|verified/iu);
    },
  );

  it("renders explicit unavailable and empty states instead of inventing dependency status", () => {
    const copy = getDictionary("en").dependencyUi;
    const unavailable = renderToStaticMarkup(
      <ProductDependencyList
        declared={["core-ui", "missing-pack"]}
        resolution={null}
        locale="en"
      />,
    );
    expect(unavailable).toContain("core-ui, missing-pack");
    expect(unavailable).toContain(copy.resolutionUnavailable);

    const empty = renderToStaticMarkup(
      <ProductDependencyList declared={[]} resolution={null} locale="en" />,
    );
    expect(empty).toContain(copy.noneDeclared);
  });
});

describe("resource version help projection", () => {
  const productId = `prd_${"a".repeat(24)}`;
  const buildId = `bld_${"b".repeat(24)}`;

  it("keeps fenced setup code as plain text and omits automatic incompatibility", () => {
    const projection = buildResourceVersionHelp({
      version: "2.0.0",
      shortDescription: "Utility helpers",
      description: "Longer catalog description",
      licenseModel: "unlimited",
      compatibility: {},
      releaseNotes: "Run setup:\n```lua\n<script>alert(1)</script>\n```",
      mtaVersionTarget: null,
      productId,
      buildId,
    });

    expect(projection.version).toBe("2.0.0");
    expect(projection.setup?.codeBlocks).toEqual(['<script>alert(1)</script>']);
    expect(projection.limits.find((line) => line.key === "catalogMtaMin")).toMatchObject({
      known: false,
    });
    expect(projection.support).toEqual({ productId, buildId });
  });

  it.each(["en", "ru"] as const)(
    "renders version-scoped help without executing author markup in %s",
    (locale) => {
      const copy = getDictionary(locale).versionHelpUi;
      const projection = buildResourceVersionHelp({
        version: "1.4.0",
        shortDescription: "Purpose line",
        description: "Description body",
        licenseModel: "unlimited",
        compatibility: { mtaMinVersion: "1.6.0", dependencies: [] },
        releaseNotes: "```lua\n<script>alert(1)</script>\n```",
        mtaVersionTarget: "1.6.0",
        productId,
        buildId,
      });
      const markup = renderToStaticMarkup(
        <ResourceVersionHelpSection projection={projection} locale={locale} />,
      );

      expect(markup).toContain('data-version="1.4.0"');
      expect(markup).toContain(copy.sections.setup);
      expect(markup).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
      expect(markup).not.toMatch(/<script>alert/iu);
      expect(markup).toContain('href="#resource-qa"');
      expect(markup).toContain("/support?category=resource");
      expect(markup).not.toMatch(/incompatible|guaranteed/iu);
    },
  );

  it("reports missing author instructions when purpose and setup are empty", () => {
    const projection = buildResourceVersionHelp({
      version: "3.0.0",
      shortDescription: "  ",
      description: "Catalog description only",
      licenseModel: "unlimited",
      compatibility: null,
      releaseNotes: null,
      mtaVersionTarget: null,
      productId,
      buildId: null,
    });
    expect(projection.missingAuthorContent).toBe(true);
    expect(splitInstructionPlainText("```sh\necho hi\n```").codeBlocks).toEqual(["echo hi"]);
  });
});
