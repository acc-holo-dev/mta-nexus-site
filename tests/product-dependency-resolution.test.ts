import { describe, expect, it } from "vitest";
import {
  buildProductDependencyResolution,
  normalizeDependencySlugs,
} from "../apps/web/src/lib/product-dependency-resolution";

describe("product dependency resolution model", () => {
  it("normalizes, deduplicates and bounds declared slugs", () => {
    const values = [
      " Core-UI ",
      "core-ui",
      ...Array.from({ length: 40 }, (_, index) => `dep-${index}`),
    ];
    const normalized = normalizeDependencySlugs(values);

    expect(normalized[0]).toBe("core-ui");
    expect(new Set(normalized).size).toBe(normalized.length);
    expect(normalized).toHaveLength(25);
  });

  it("preserves declared order and separates available, missing and self references", () => {
    const resolution = buildProductDependencyResolution(
      {
        slug: "race-mode",
        compatibility: {
          dependencies: ["core-ui", "missing-pack", "race-mode"],
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

    expect(resolution).toEqual({
      declaredCount: 3,
      availableCount: 1,
      unresolvedCount: 1,
      selfReferenceCount: 1,
      dependencies: [
        {
          slug: "core-ui",
          status: "available",
          product: {
            id: "prd_core",
            slug: "core-ui",
            title: "Core UI",
            type: "ui",
            currentVersion: "2.1.0",
          },
        },
        {
          slug: "missing-pack",
          status: "unresolved",
          product: null,
        },
        {
          slug: "race-mode",
          status: "self_reference",
          product: null,
        },
      ],
    });
  });

  it("does not treat catalogue presence as compatibility proof", () => {
    const source = buildProductDependencyResolution(
      {
        slug: "resource-a",
        compatibility: { dependencies: ["resource-b"] },
      },
      [
        {
          id: "prd_b",
          slug: "resource-b",
          title: "Resource B",
          type: "script",
          currentVersion: "1.0.0",
        },
      ],
    );

    expect(source.dependencies[0]?.status).toBe("available");
    expect(JSON.stringify(source)).not.toMatch(
      /compatible|verified|guaranteed/iu,
    );
  });
});
