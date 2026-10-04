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
      "Disposable production stack, real auth/database/entitlement/local-storage/download route. Timeout/cancellation use a synthetic stalled fetch and browser clock; they do not simulate a real TCP interruption. Product/build are seeded fixtures; author publishing and moderator approval are covered separately.",
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
  const downloads = [];
  page.on("download", (download) => downloads.push(download));
  await page.clock.install();

  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    // Only the deliberately intercepted download may report the expected 409.
    const expectedConflict = message.text() ===
      "Failed to load resource: the server responded with a status of 409 (Conflict)" &&
      message.location().url ===
        `${process.env.NEXUS_BROWSER_BASE_URL}/api/products/${productId}/download`;
    if (!expectedConflict) browserErrors.push(message.text());
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
    await expect(page.getByRole("alert").filter({ hasText: "This build cannot be downloaded right now" })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/market/${productSlug}$`, "u"));
    await page.unroute(downloadPattern);

    // Stall exactly one download in the browser. Restore fetch immediately so
    // subsequent retries and unrelated requests use the real production stack.
    const stallNextDownload = () => page.evaluate((id) => {
      const originalFetch = window.fetch;
      window.fetch = (input, init) => {
        if (input !== `/api/products/${encodeURIComponent(id)}/download`) {
          return originalFetch(input, init);
        }
        window.fetch = originalFetch;
        return new Promise((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) {
            reject(new Error("Download must provide an AbortSignal"));
            return;
          }
          if (signal.aborted) reject(signal.reason);
          else signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        });
      };
    }, productId);
    const downloadButton = page.getByRole("button", { name: "Download Build v1.0.0", exact: true });
    const preparingButton = page.getByRole("button", { name: "Preparing download…", exact: true });

    await stallNextDownload();
    await downloadButton.click();
    await expect(preparingButton).toBeDisabled();
    await page.clock.fastForward(60_001);
    await expect(page.getByRole("alert").filter({ hasText: "The download stopped responding" })).toBeVisible();
    await expect(downloadButton).toBeEnabled();
    assert.equal(downloads.length, 0, "Timed-out requests must not save a file");

    await stallNextDownload();
    await downloadButton.click();
    await expect(preparingButton).toBeDisabled();
    await page.getByRole("button", { name: "Cancel download", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Download cancelled. You can try again." })).toBeVisible();
    await expect(downloadButton).toBeEnabled();
    await page.clock.fastForward(60_001);
    await expect(page.getByRole("alert").filter({ hasText: "The download stopped responding" })).toHaveCount(0);
    assert.equal(downloads.length, 0, "Cancelled requests must not save a file");

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

    // Exercise the actual language control, including the server-rendered reload.
    await page.getByRole("button", { name: "Language", exact: true }).click();
    const russianDownload = page.getByRole("button", { name: "Скачать сборку v1.0.0", exact: true });
    await expect(russianDownload).toBeVisible();
    const stallMidStream = () => page.evaluate((id) => {
      const originalFetch = window.fetch;
      window.fetch = (input, init) => {
        if (input !== `/api/products/${encodeURIComponent(id)}/download`) {
          return originalFetch(input, init);
        }
        window.fetch = originalFetch;
        window.nexusDownloadCancelled = false;
        const body = new ReadableStream({
          start(stream) { stream.enqueue(new Uint8Array([80, 75, 3, 4])); },
          cancel() { window.nexusDownloadCancelled = true; },
        });
        return Promise.resolve(new Response(body, {
          headers: { "Content-Length": "8", "Content-Type": "application/zip" },
        }));
      };
    }, productId);

    for (const reason of ["timeout", "cancel"]) {
      await stallMidStream();
      await russianDownload.click();
      await expect(page.getByRole("progressbar", { name: "Прогресс скачивания" })).toHaveAttribute("value", "50");
      await expect(page.getByRole("button", { name: "Подготовка скачивания…", exact: true })).toBeDisabled();
      if (reason === "timeout") {
        await page.clock.fastForward(60_001);
        await expect(page.getByRole("alert").filter({ hasText: "Скачивание не отвечает" })).toBeVisible();
      } else {
        await page.getByRole("button", { name: "Отменить скачивание", exact: true }).click();
        await expect(page.getByRole("status").filter({ hasText: "Скачивание отменено. Можно попробовать снова." })).toBeVisible();
        await page.clock.fastForward(60_001);
        await expect(page.getByRole("alert").filter({ hasText: "Скачивание не отвечает" })).toHaveCount(0);
      }
      await expect(russianDownload).toBeEnabled();
      await expect(page.getByRole("progressbar", { name: "Прогресс скачивания" })).toHaveCount(0);
      assert.equal(await page.evaluate(() => window.nexusDownloadCancelled), true, "Partial response reader must be cancelled");
      assert.equal(downloads.length, 1, "A partial response must not create another download");
    }

    const russianDownloadPromise = page.waitForEvent("download");
    await russianDownload.click();
    const russianFile = await russianDownloadPromise;
    assert.equal(russianFile.suggestedFilename(), `${productSlug}-1.0.0.zip`);
    const russianPath = join(output, "j5-browser-download-ru.zip");
    await russianFile.saveAs(russianPath);
    assert.equal(createHash("sha256").update(await readFile(russianPath)).digest("hex"), expectedSha256);
    results.push({ name: "RU/EN timeout, cancellation, partial-stream cleanup and exact-byte retries", status: "PASS" });

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
