import { describe, expect, it } from "vitest";
import {
  buildReverseDependencySummary,
  reverseDependencyLimits,
} from "../apps/web/src/lib/reverse-dependency-summary";

describe("reverse dependency summary", () => {
  it("removes self references, de-duplicates slugs and bounds visible results", () => {
    const dependents = [
      {
        id: "prd_self",
        slug: "core-ui",
        title: "Core UI",
        type: "ui" as const,
        currentVersion: "1.0.0",
      },
      ...Array.from(
        { length: reverseDependencyLimits.visible + 2 },
        (_, index) => ({
          id: `prd_${index}`,
          slug: `dependent-${index}`,
          title: `Dependent ${index}`,
          type: "script" as const,
          currentVersion: "1.0.0",
        }),
      ),
      {
        id: "prd_duplicate",
        slug: "dependent-0",
        title: "Duplicate",
        type: "script" as const,
        currentVersion: "9.9.9",
      },
    ];

    const summary = buildReverseDependencySummary("core-ui", dependents);

    expect(summary.products).toHaveLength(reverseDependencyLimits.visible);
    expect(summary.limitReached).toBe(true);
    expect(summary.products.some((item) => item.slug === "core-ui")).toBe(false);
    expect(
      summary.products.filter((item) => item.slug === "dependent-0"),
    ).toHaveLength(1);
  });

  it("returns a neutral empty result", () => {
    expect(buildReverseDependencySummary("core-ui", [])).toEqual({
      totalVisible: 0,
      limitReached: false,
      products: [],
    });
  });
});
