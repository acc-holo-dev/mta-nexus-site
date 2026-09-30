import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("J5 resource browser acceptance contract", () => {
  it("reuses the disposable production stack and native Playwright runner", () => {
    const harness = read("scripts/check-resource-browser.sh");
    const workflow = read(".github/workflows/resource-browser.yml");

    expect(harness).toContain('source "$(dirname "$0")/check-production-startup.sh"');
    expect(harness).toContain("--config=playwright.ci.config.mjs");
    expect(workflow).toContain("bash scripts/check-resource-browser.sh");
    expect(workflow).toContain("@playwright/test@1.62.1");
  });

  it("seeds only the resource fixture, not the player entitlement", () => {
    const harness = read("scripts/check-resource-browser.sh");

    expect(harness).toContain("INSERT INTO users");
    expect(harness).toContain("INSERT INTO products");
    expect(harness).toContain("INSERT INTO builds");
    expect(harness).not.toContain("INSERT INTO entitlements");
    expect(harness).toContain("'published'");
    expect(harness).toContain("'clean'");
  });

  it("claims through the real acquisition UI and downloads through the product UI", () => {
    const browser = read("scripts/tests/resource-claim-download.playwright.mjs");

    expect(browser).toContain("page.goto(`/market/${productSlug}`)");
    expect(browser).toContain('getByRole("link", { name: "Add to library", exact: true })');
    expect(browser).toContain('response.url().endsWith("/api/resources/claim")');
    expect(browser).toContain('page.goto("/workspace")');
    expect(browser).toContain('"Download Build v1.0.0"');
    expect(browser).toContain('page.waitForEvent("download")');
    expect(browser).toContain('getByRole("alert")');
    expect(browser).toContain("BUILD_ARTIFACT_MISMATCH");
    expect(browser).toContain("/acquire");
    expect(browser).toContain('createHash("sha256")');
    expect(browser).toContain("assert.equal(actualSha256, expectedSha256)");
  });

  it("verifies one entitlement and one library-addition increment after the browser journey", () => {
    const harness = read("scripts/check-resource-browser.sh");

    expect(harness).toContain("SELECT count(*) FROM entitlements WHERE resource_id = '$product_id'");
    expect(harness).toContain('[[ "$claims" == 1 ]]');
    expect(harness).toContain("SELECT sales_count FROM products WHERE id = '$product_id'");
    expect(harness).toContain('[[ "$sales" == 1 ]]');
  });

  it("does not introduce a test-only application endpoint", () => {
    const workflow = read(".github/workflows/resource-browser.yml");
    const harness = read("scripts/check-resource-browser.sh");

    expect(workflow).not.toContain("/api/test/");
    expect(harness).not.toContain("/api/test/");
    expect(harness).not.toContain("TEST_ONLY");
  });
});
