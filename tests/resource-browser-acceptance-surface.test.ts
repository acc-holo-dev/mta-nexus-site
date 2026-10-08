import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resourceBrowserAcceptance } from "../scripts/resource-browser-acceptance.mjs";

describe("J5 resource browser acceptance contract", () => {
  it("declares only real Playwright journeys that exist in the repository", () => {
    const specs = [...resourceBrowserAcceptance.playwrightSpecs];

    expect(specs).toHaveLength(4);
    expect(new Set(specs).size).toBe(specs.length);

    for (const spec of specs) {
      expect(spec).toMatch(/^scripts\/tests\/.+\.playwright\.mjs$/u);
      expect(existsSync(resolve(process.cwd(), spec)), spec).toBe(true);
    }
  });

  it("starts without an entitlement and requires exactly one claim/library increment", () => {
    expect(resourceBrowserAcceptance.fixture).toMatchObject({
      initialEntitlements: 0,
      productStatus: "published",
      buildStatus: "published",
      scanStatus: "clean",
    });
    expect(resourceBrowserAcceptance.postconditions).toEqual({
      entitlements: 1,
      salesCount: 1,
    });
  });

  it("does not depend on a test-only application API namespace", () => {
    expect(
      existsSync(
        resolve(process.cwd(), "apps/web/src/app/api/test"),
      ),
    ).toBe(false);
  });
});
