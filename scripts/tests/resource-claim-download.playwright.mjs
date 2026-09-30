import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";

assert.equal(process.env.GITHUB_ACTIONS, "true");
assert.equal(process.env.RUNNER_ENVIRONMENT, "github-hosted");
assert(process.env.NEXUS_BROWSER_TOOLS);
assert(process.env.NEXUS_BROWSER_REPORT_DIR);
assert(process.env.NEXUS_BROWSER_HOME);
assert.equal(
  process.env.NEXUS_BROWSER_BASE_URL,
  "https://nexus-ci.test:8443",
  "Only the disposable CI site may be tested",
);
assert(process.env.NEXUS_RESOURCE_BROWSER_PRODUCT_ID);
assert(process.env.NEXUS_RESOURCE_BROWSER_PRODUCT_SLUG);
assert(process.env.NEXUS_RESOURCE_BROWSER_PRODUCT_TITLE);
assert.match(
  process.env.NEXUS_RESOURCE_BROWSER_EXPECTED_SHA256 ?? "",
  /^[a-f0-9]{64}$/u,
);

const require = createRequire(
  join(resolve(process.env.NEXUS_BROWSER_TOOLS), "package.json"),
);
const { test, expect } = require("@playwright/test");
const output = resolve(process.env.NEXUS_BROWSER_REPORT_DIR);
const productId = process.env.NEXUS_RESOURCE_BROWSER_PRODUCT_ID;
const productSlug = process.env.NEXUS_RESOURCE_BROWSER_PRODUCT_SLUG;
const productTitle = process.env.NEXUS_RESOURCE_BROWSER_PRODUCT_TITLE;
const expectedSha256 = process.env.NEXUS_RESOURCE_BROWSER_EXPECTED_SHA256;
const results = [];

test.afterAll(async () => {
  await mkdir(output, { recursive: true });
  const report = {
    commit: process.env.GITHUB_SHA ?? null,
    productSlug,
    expectedSha256,
    results,
    limitations:
      "Disposable production stack, real auth/database/entitlement/local-storage/download route. Product/build are seeded fixtures; author publishing and moderator approval are covered separately.",
  };
  await writeFile(
    join(output, "resource-results.json"),
    JSON.stringify(report, null, 2),
  );
  await writeFile(
    join(output, "resource-summary.md"),
    [
      "# J5 free resource browser journey",
      "",
      `Commit: ${process.env.GITHUB_SHA ?? "unknown"}`,
      "",
      ...results.map((item) => `- ${item.status}: ${item.name}`),
      "",
      report.limitations,
      "",
    ].join("\n"),
  );
});

test("J5 claim -> workspace -> download exact published build", async ({
  page,
}) => {
  const name = "claim published free resource and download exact bytes";
  let status = "FAIL";
  const browserErrors = [];

  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });

  try {
    const nonce = randomBytes(6).toString("hex");
    const password = `Ci-${randomBytes(24).toString("hex")}`;
    const account = {
      email: `resource-player-${nonce}@example.invalid`,
      username: `resource_player_${nonce}`,
      password,
    };

    await page.goto("/auth/login");
    const registration = await page.evaluate(async (input) => {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return {
        status: response.status,
        data: await response.json(),
      };
    }, account);

    assert.equal(registration.status, 201);
    assert(registration.data.user?.id);
    assert(!("passwordHash" in registration.data.user));

    await page.goto(`/market/${productSlug}`);
    await expect(
      page.getByRole("link", { name: "Add to library", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Download Build/u }),
    ).toHaveCount(0);

    await page
      .getByRole("link", { name: "Add to library", exact: true })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/acquire\\?productId=${productId}$`, "u"),
    );
    await expect(
      page.getByRole("heading", { name: "Add resource to library", exact: true }),
    ).toBeVisible();
    await expect(page.getByText(productTitle, { exact: true })).toBeVisible();

    const claimResponsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/resources/claim") &&
        response.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Add to library", exact: true })
      .click();
    const claimResponse = await claimResponsePromise;
    assert.equal(claimResponse.status(), 201);

    await expect(
      page.getByRole("heading", { name: "Resource added", exact: true }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Open resource", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/market/${productSlug}$`, "u"));
    await expect(page.getByText("In your library", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Download Build v1.0.0",
        exact: true,
      }),
    ).toBeVisible();

    await page.goto("/workspace");
    await expect(
      page.getByRole("heading", { name: "Workspace", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Resource library", exact: true }),
    ).toBeVisible();
    await expect(page.getByText(productTitle, { exact: true })).toBeVisible();

    await page.goto(`/market/${productSlug}`);
    const downloadPattern = "**/api/products/*/download";
    await page.route(downloadPattern, (route) => route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ code: "BUILD_ARTIFACT_MISMATCH" }),
    }));
    await page.getByRole("button", { name: "Download Build v1.0.0", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("This build cannot be downloaded right now");
    await expect(page).toHaveURL(new RegExp(`/market/${productSlug}$`, "u"));
    await page.unroute(downloadPattern);

    const downloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", {
        name: "Download Build v1.0.0",
        exact: true,
      })
      .click();
    const download = await downloadPromise;

    assert.equal(
      download.suggestedFilename(),
      `${productSlug}-1.0.0.zip`,
    );

    const savedPath = join(output, "j5-browser-download.zip");
    await download.saveAs(savedPath);
    const bytes = await readFile(savedPath);
    const actualSha256 = createHash("sha256").update(bytes).digest("hex");
    assert.equal(actualSha256, expectedSha256);

    assert.deepEqual(
      browserErrors,
      [],
      "Unexpected JavaScript, hydration or console errors",
    );

    status = "PASS";
  } finally {
    results.push({ name, status });
  }
});
