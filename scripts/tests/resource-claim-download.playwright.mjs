import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { startBrowserMemoryProbe } from "../browser-memory.mjs";

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
assert(process.env.NEXUS_RESOURCE_BROWSER_PAID_PRODUCT_ID);
assert(process.env.NEXUS_RESOURCE_BROWSER_PAID_PRODUCT_SLUG);
assert(process.env.NEXUS_RESOURCE_BROWSER_PAID_PRODUCT_TITLE);
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
const paidProductId = process.env.NEXUS_RESOURCE_BROWSER_PAID_PRODUCT_ID;
const paidProductSlug = process.env.NEXUS_RESOURCE_BROWSER_PAID_PRODUCT_SLUG;
const paidProductTitle = process.env.NEXUS_RESOURCE_BROWSER_PAID_PRODUCT_TITLE;
const expectedSha256 = process.env.NEXUS_RESOURCE_BROWSER_EXPECTED_SHA256;
const expectedSize = Number(process.env.NEXUS_RESOURCE_BROWSER_EXPECTED_SIZE);
assert.equal(expectedSize, 64 * 1024 * 1024, "Exercise the maximum supported download size");
async function assertNoHorizontalOverflow(page, label) {
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    `Horizontal overflow: ${label}`,
  );
}

async function verifyDownloadedFile(path) {
  assert.equal((await stat(path)).size, expectedSize);
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  const actualSha256 = hash.digest("hex");
  assert.equal(actualSha256, expectedSha256);
  await rm(path);
}
const results = [];

test.afterAll(async () => {
  await mkdir(output, { recursive: true });
  const report = {
    commit: process.env.GITHUB_SHA ?? null,
    productSlug,
    expectedSha256,
    expectedSize,
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
  page, browser,
}) => {
  const name = "claim published free resource and download exact bytes";
  let status = "FAIL";
  const browserErrors = [];
  const downloads = [];
  page.on("download", (download) => downloads.push(download));
  await page.clock.install();
  // A successful HTTP response with undecodable image bytes exercises the
  // preview error event without treating an intentional 404 as a console fault.
  await page.route("**/ci-preview.png", (route) => route.fulfill({
    status: 200, contentType: "image/png", body: "Synthetic broken preview",
  }));

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
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(
        page.getByRole("heading", { level: 1, name: productTitle, exact: true }),
      ).toBeVisible();
      await assertNoHorizontalOverflow(
        page,
        `resource detail at ${width}px before acquisition`,
      );
    }
    await page.setViewportSize({ width: 1280, height: 844 });
    await expect(page.getByText("Preview unavailable", { exact: true })).toBeVisible();
    await expect(page.getByRole("img", { name: productTitle, exact: true })).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Add to library", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Download Build/u }),
    ).toHaveCount(0);

    const addToLibraryLink = page.getByRole("link", {
      name: "Add to library",
      exact: true,
    });
    await addToLibraryLink.focus();
    await expect(addToLibraryLink).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(
      new RegExp(`/acquire\\?productId=${productId}$`, "u"),
    );
    await expect(
      page.getByRole("heading", { name: "Add resource to library", exact: true }),
    ).toBeVisible();
    await expect(page.getByText(productTitle, { exact: true })).toBeVisible();

    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await assertNoHorizontalOverflow(page, `acquire page at ${width}px`);
    }
    await page.setViewportSize({ width: 1280, height: 844 });

    const claimResponsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/resources/claim") &&
        response.request().method() === "POST",
    );
    const claimButton = page.getByRole("button", {
      name: "Add to library",
      exact: true,
    });
    await claimButton.focus();
    await expect(claimButton).toBeFocused();
    await page.keyboard.press("Enter");
    const claimResponse = await claimResponsePromise;
    assert.equal(claimResponse.status(), 201);

    await expect(
      page.getByRole("heading", { name: "Resource added", exact: true }),
    ).toBeVisible();

    const openResourceLink = page.getByRole("link", {
      name: "Open resource",
      exact: true,
    });
    await openResourceLink.focus();
    await expect(openResourceLink).toBeFocused();
    await page.keyboard.press("Enter");
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
    const keyboardDownload = page.getByRole("button", {
      name: "Download Build v1.0.0",
      exact: true,
    });
    await keyboardDownload.focus();
    await expect(keyboardDownload).toBeFocused();
    await page.keyboard.press("Enter");
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
    const cancelDownload = page.getByRole("button", {
      name: "Cancel download",
      exact: true,
    });
    await cancelDownload.focus();
    await expect(cancelDownload).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status").filter({ hasText: "Download cancelled. You can try again." })).toBeVisible();
    await expect(downloadButton).toBeEnabled();
    await page.clock.fastForward(60_001);
    await expect(page.getByRole("alert").filter({ hasText: "The download stopped responding" })).toHaveCount(0);
    assert.equal(downloads.length, 0, "Cancelled requests must not save a file");

    const stopMemoryProbe = await startBrowserMemoryProbe(browser);
    let memory;
    try {
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
      await verifyDownloadedFile(savedPath);
      // Release the handoff URL and record the post-release state as well.
      await page.clock.fastForward(60_001);
    } finally {
      memory = await stopMemoryProbe();
      await writeFile(join(output, "download-browser-memory.json"), JSON.stringify({
        commit: process.env.GITHUB_SHA, archiveBytes: expectedSize, ...memory,
        growthBudgetKiB: 384 * 1024,
      }, null, 2));
    }
    assert(memory.samples.length >= 3, "Sample the actual 64 MiB browser transfer");
    assert(memory.growthKiB < 384 * 1024, "Chromium RSS growth exceeded the regression budget");
    results.push({ name: `64 MiB Chromium RSS growth: ${memory.growthKiB} KiB`, status: "PASS" });

    // Exercise the actual language control, including the server-rendered reload.
    await page.getByRole("button", { name: "Language", exact: true }).click();
    const russianDownload = page.getByRole("button", { name: "Скачать сборку v1.0.0", exact: true });
    await expect(russianDownload).toBeVisible();
    await expect(page.getByText("Превью недоступно", { exact: true })).toBeVisible();
    await expect(page.getByRole("img", { name: productTitle, exact: true })).toHaveCount(0);
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
          headers: {
            "Content-Length": "8",
            "Content-Type": "application/zip",
            // Download client rejects responses without a checksum before progress updates.
            "X-Content-SHA256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          },
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
    await verifyDownloadedFile(russianPath);
    results.push({ name: "RU/EN timeout, cancellation, partial-stream cleanup and exact-byte retries", status: "PASS" });
    results.push({
      name: "Keyboard-only free acquisition/download actions and 320/390px reflow",
      status: "PASS",
    });

    for (const failure of ["truncated", "stream-error"]) {
      await page.evaluate(({ id, failure }) => {
        const originalFetch = window.fetch;
        window.fetch = (input, init) => {
          if (input !== `/api/products/${encodeURIComponent(id)}/download`) return originalFetch(input, init);
          window.fetch = originalFetch;
          const body = new ReadableStream({
            start(stream) {
              stream.enqueue(new Uint8Array([80, 75, 3, 4]));
              if (failure === "truncated") stream.close();
              else setTimeout(() => stream.error(new TypeError("Synthetic interrupted stream")), 10);
            },
          });
          return Promise.resolve(new Response(body, {
            headers: { "Content-Length": "8", "Content-Type": "application/zip" },
          }));
        };
      }, { id: productId, failure });
      await russianDownload.click();
      await page.clock.fastForward(20);
      await expect(page.getByRole("alert").filter({ hasText: "Не удалось завершить скачивание" })).toBeVisible();
      await expect(russianDownload).toBeEnabled();
      assert.equal(downloads.length, 2, "Incomplete/error responses must not save a file");
    }
    results.push({ name: "64 MiB exact-byte downloads and rejection of truncated/error responses", status: "PASS" });

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


test("J5 paid resource stays fail-closed and accessibly explained", async ({
  page,
}) => {
  const name = "paid resource closed-beta accessibility without payment mutation";
  let status = "FAIL";
  const mutationRequests = [];

  page.on("request", (request) => {
    if (
      request.method() !== "GET" &&
      (
        request.url().includes("/api/checkout") ||
        request.url().includes("/api/resources/claim")
      )
    ) {
      mutationRequests.push({
        method: request.method(),
        url: request.url(),
      });
    }
  });

  try {
    await page.goto(
      `/acquire?productId=${encodeURIComponent(paidProductId)}`,
    );
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Add resource to library",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText(paidProductTitle, { exact: true }),
    ).toBeVisible();

    const paidStatus = page.getByRole("status").filter({
      hasText: "Paid resources disabled",
    });
    await expect(paidStatus).toBeVisible();
    const paidDescription = page.getByText(
      "Paid resources are disabled during the closed beta. No payment attempt will be created.",
      { exact: true },
    );
    await expect(paidDescription).toBeVisible();

    const paidButton = page.getByRole("button", {
      name: "Paid resources unavailable",
      exact: true,
    });
    await expect(paidButton).toBeDisabled();
    const describedBy = await paidButton.getAttribute("aria-describedby");
    assert(describedBy);
    await expect(paidDescription).toHaveAttribute("id", describedBy);

    const summary = page.locator("dl");
    await expect(summary.getByText("Resource", { exact: true })).toBeVisible();
    await expect(summary.getByText("Price", { exact: true })).toBeVisible();
    await expect(summary.getByText("Version", { exact: true })).toBeVisible();
    await expect(summary.getByText("$25.00", { exact: true })).toBeVisible();

    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await assertNoHorizontalOverflow(
        page,
        `paid acquire page at ${width}px`,
      );
    }

    await page.getByRole("button", { name: "Language", exact: true }).click();
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Добавить ресурс в библиотеку",
        exact: true,
      }),
    ).toBeVisible();
    const russianPaidDescription = page.getByText(
      "Платные ресурсы отключены на время закрытой беты. Попытка оплаты не создаётся.",
      { exact: true },
    );
    await expect(russianPaidDescription).toBeVisible();
    const russianPaidButton = page.getByRole("button", {
      name: "Платные ресурсы недоступны",
      exact: true,
    });
    await expect(russianPaidButton).toBeDisabled();
    const russianDescribedBy =
      await russianPaidButton.getAttribute("aria-describedby");
    assert(russianDescribedBy);
    await expect(russianPaidDescription).toHaveAttribute(
      "id",
      russianDescribedBy,
    );

    assert.deepEqual(
      mutationRequests,
      [],
      "Paid closed-beta screen must not create checkout or free-claim mutations",
    );

    results.push({
      name:
        "RU/EN paid-disabled summary, explanation, disabled action and 320/390px reflow",
      status: "PASS",
    });
    status = "PASS";
  } finally {
    results.push({ name, status });
  }
});
