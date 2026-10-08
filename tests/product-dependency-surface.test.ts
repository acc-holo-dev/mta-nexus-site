import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "../apps/web/src/lib/i18n";
import { buildProductDependencyResolution } from "../apps/web/src/lib/product-dependency-resolution";
import { ProductDependencyList } from "../apps/web/src/components/product-dependency-list";

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
        dependencies: [
          " Core-UI ",
          "core-ui",
          "missing-pack",
        ],
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
            dependencies: [
              "core-ui",
              "missing-pack",
              "vehicle-pack",
            ],
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
          declared={[
            "core-ui",
            "missing-pack",
            "vehicle-pack",
          ]}
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
      expect(markup).not.toMatch(
        /compatible|incompatible|guaranteed|verified/iu,
      );
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
      <ProductDependencyList
        declared={[]}
        resolution={null}
        locale="en"
      />,
    );
    expect(empty).toContain(copy.noneDeclared);
  });
});
