import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

// Test tools are installed outside the application workspace, at exact CI versions.
assert(process.env.NEXUS_BROWSER_TOOLS, "The browser tool directory is required");
const require = createRequire(join(resolve(process.env.NEXUS_BROWSER_TOOLS), "package.json"));
const { chromium, expect } = require("@playwright/test");
const baseURL = process.env.NEXUS_BROWSER_BASE_URL;
assert.equal(baseURL, "https://nexus-ci.test:8443", "Only the disposable CI site may be tested");
const output = resolve(process.env.NEXUS_BROWSER_REPORT_DIR);
const execute = promisify(execFile);
const routePattern = "**/api/servers/directory?*";
const fetchedAt = "2026-09-23T12:00:00.000Z";
const servers = [
  {
    address: "192.0.2.1",
    port: 22003,
    name: "Nexus Drift",
    gameMode: "Drift",
    players: 12,
    maxPlayers: 100,
  },
  {
    address: "192.0.2.2",
    port: 22003,
    name: "Unknown Population",
    gameMode: "Race",
    maxPlayers: 64,
  },
  {
    address: "192.0.2.3",
    port: 22003,
    name: "Empty But Known",
    gameMode: "Race",
    players: 0,
    maxPlayers: 32,
  },
];
const results = [];
let browser;

function data(items = servers, extra = {}) {
  return {
    servers: items,
    total: items.length,
    offset: 0,
    limit: 50,
    fetchedAt,
    isStale: false,
    ...extra,
  };
}
const respond = (route, body = data()) =>
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

before(async () => {
  await mkdir(output, { recursive: true });
  browser = await chromium.launch({
    headless: true,
    args: ["--host-resolver-rules=MAP nexus-ci.test 127.0.0.1", "--remote-debugging-port=9222"],
    // Chromium reads the disposable NSS trust store prepared by the smoke script.
    env: { ...process.env, HOME: process.env.NEXUS_BROWSER_HOME },
  });
  console.log(
    `Browser: ${browser.version()}; Playwright: ${require("@playwright/test/package.json").version}`,
  );
});

after(async () => {
  if (browser) await browser.close();
  await writeFile(
    join(output, "results.json"),
    JSON.stringify({ commit: process.env.GITHUB_SHA, results }, null, 2),
  );
  const lines = results.map((result) => `- ${result.status}: ${result.name}`);
  await writeFile(
    join(output, "summary.md"),
    `# BETA-004 browser acceptance\n\nCommit: ${process.env.GITHUB_SHA}\n\n${lines.join("\n")}\n\nReal production page and Chromium; directory API responses are controlled fixtures. Not a live-master-list, API-filtering, MTA-client, full accessibility or localization certification.\n`,
  );
});

function check(name, body, options = {}) {
  test(name, { timeout: 60_000 }, async () => {
    const context = await browser.newContext({
      baseURL,
      ignoreHTTPSErrors: false,
      locale: "en-GB",
      timezoneId: "UTC",
      viewport: options.viewport ?? { width: 1440, height: 1000 },
    });
    const page = await context.newPage();
    const errors = [];
    const expectedNetworkErrors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      if (options.networkFailure && /Failed to load resource/.test(message.text())) {
        expectedNetworkErrors.push(message.text());
      } else errors.push(message.text());
    });
    let status = "FAIL";
    try {
      await context.route(routePattern, options.route ?? ((route) => respond(route)));
      await body({ page, context });
      assert.deepEqual(errors, [], "Unexpected JavaScript, hydration or console errors");
      await expect(page.locator("[data-nextjs-dialog], .vite-error-overlay")).toHaveCount(0);
      status = "PASS";
    } finally {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      if (status === "FAIL" || options.capture) {
        await page
          .screenshot({ path: join(output, `${slug}.png`) })
          .catch((error) => console.error(`Screenshot failed: ${error.message}`));
        await writeFile(
          join(output, `${slug}.aria.txt`),
          await page
            .locator("body")
            .ariaSnapshot()
            .catch(() => "Snapshot unavailable"),
        );
      }
      results.push({ name, status, errors, expectedNetworkErrors });
      await context.close();
    }
  });
}

const open = async (page) => {
  const response = await page.goto("/servers");
  assert.equal(response.status(), 200);
  await expect(page.getByRole("heading", { name: "Multi Theft Auto servers" })).toBeVisible();
};
const region = (page) => page.getByRole("region", { name: "Server directory" });

check(
  "J1-01 honest player counts, stale data and connection actions",
  async ({ page }) => {
    await open(page);
    await expect(page.getByRole("article", { name: "Nexus Drift" })).toContainText(
      "12 players / 100 slots",
    );
    await expect(page.getByRole("article", { name: "Unknown Population" })).toContainText(
      "Player count unknown",
    );
    await expect(page.getByRole("article", { name: "Empty But Known" })).toContainText(
      "0 players / 32 slots",
    );
    await expect(region(page)).toContainText("Updates are delayed");
    await expect(region(page).locator("time")).toHaveAttribute("datetime", fetchedAt);
    await expect(
      page.getByRole("link", { name: "Connect: Nexus Drift", exact: true }),
    ).toHaveAttribute("href", "mtasa://192.0.2.1:22003");
    await expect(
      page.getByRole("textbox", { name: "Server address: Nexus Drift", exact: true }),
    ).toHaveValue("192.0.2.1:22003");
  },
  { route: (route) => respond(route, data(servers, { isStale: true })), capture: true },
);

check(
  "J1-02 search, pagination and filter reset use the correct request",
  async ({ page }) => {
    await open(page);
    await expect(region(page)).toContainText("Page 1 of 2");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(region(page)).toContainText("Page 2 of 2");
    await expect(page.getByRole("article", { name: "Server 51", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "Previous", exact: true }).click();
    await expect(region(page)).toContainText("Page 1 of 2");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(region(page)).toContainText("Page 2 of 2");
    await page.getByRole("searchbox", { name: "Search servers" }).fill("Drift");
    await expect(page.getByRole("article", { name: "Nexus Drift" })).toBeVisible();
    await expect(region(page).getByRole("article")).toHaveCount(1);
    await page.getByRole("combobox", { name: "Minimum players" }).selectOption("50");
    await expect(region(page)).toContainText("No public MTA servers match these filters");
    await page.getByRole("button", { name: "Reset filters" }).click();
    await expect(region(page)).toContainText("Page 1 of 2");
    await expect(page.getByRole("searchbox", { name: "Search servers" })).toHaveValue("");
    await expect(page.getByRole("combobox", { name: "Minimum players" })).toHaveValue("0");
  },
  {
    route: (route) => {
      const params = new URL(route.request().url()).searchParams;
      assert.equal(params.get("limit"), "50");
      const offset = Number(params.get("offset"));
      if (params.get("query") === "Drift") {
        assert.equal(offset, 0, "Search must reset pagination");
        return respond(route, data(params.get("minPlayers") === "50" ? [] : [servers[0]]));
      }
      const items = Array.from({ length: 52 }, (_, index) => ({
        ...servers[0],
        address: `192.0.2.${index + 1}`,
        name: `Server ${index + 1}`,
      }));
      return respond(route, data(items.slice(offset, offset + 50), { total: 52, offset }));
    },
  },
);

check(
  "J1-03 empty source has an actionable retry",
  async ({ page }) => {
    await open(page);
    await expect(region(page)).toContainText("No public MTA servers are available right now");
    await expect(region(page).getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(region(page)).not.toContainText("Loading servers");
  },
  { route: (route) => respond(route, data([])) },
);

check(
  "J1-04 HTTP failure can be retried without reloading the page",
  async ({ page, context }) => {
    await open(page);
    await expect(region(page).getByRole("alert")).toContainText("temporarily unavailable");
    await expect(region(page)).not.toContainText("Loading servers");
    await context.unroute(routePattern);
    await context.route(routePattern, (route) => respond(route));
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("article", { name: "Nexus Drift" })).toBeVisible();
    await expect(region(page).getByRole("alert")).toHaveCount(0);
  },
  {
    route: (route) => route.fulfill({ status: 503, json: { error: "Fixture: unavailable" } }),
    networkFailure: true,
  },
);

check(
  "J1-05 a request timeout stops loading and offers retry",
  async ({ page, context }) => {
    await page.clock.install();
    const requested = page.waitForRequest(routePattern);
    await open(page);
    await page.clock.runFor(300);
    await requested;
    await page.clock.runFor(12_100);
    await expect(region(page).getByRole("alert")).toContainText("too long to respond");
    await expect(region(page)).not.toContainText("Loading servers");
    await context.unroute(routePattern);
    await context.route(routePattern, (route) => respond(route));
    await page.getByRole("button", { name: "Try again" }).click();
    await page.clock.runFor(300);
    await expect(page.getByRole("article", { name: "Nexus Drift" })).toBeVisible();
  },
  { route: () => {}, networkFailure: true },
);

check(
  "J1-06 superseded search requests cannot overwrite the latest results",
  async ({ page }) => {
    await open(page);
    await expect(page.getByRole("article", { name: "Nexus Drift" })).toBeVisible();
    const requested = page.waitForRequest(
      (request) => new URL(request.url()).searchParams.get("query") === "old",
    );
    await page.getByRole("searchbox", { name: "Search servers" }).fill("old");
    await requested;
    await page.getByRole("searchbox", { name: "Search servers" }).fill("new");
    await expect(page.getByRole("article", { name: "Latest Result" })).toBeVisible();
    await expect(region(page).getByRole("alert")).toHaveCount(0);
    await expect(region(page)).not.toContainText("Loading servers");
  },
  {
    route: (route) => {
      const query = new URL(route.request().url()).searchParams.get("query");
      if (query === "old") return; // The next query must abort this pending browser request.
      return respond(
        route,
        query === "new" ? data([{ ...servers[0], name: "Latest Result" }]) : data(),
      );
    },
  },
);

check("J1-07 keyboard connection and actual clipboard copy", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseURL });
  await open(page);
  const address = page.getByRole("textbox", { name: "Server address: Nexus Drift", exact: true });
  await address.focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Connect: Nexus Drift", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Copy address: Nexus Drift", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("article", { name: "Nexus Drift" })).toContainText("Address copied");
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), "192.0.2.1:22003");
});

check("J1-08 denied clipboard selects a manual-copy fallback", async ({ page }) => {
  // Deliberately reject just the clipboard API, not the application copy handler.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.reject(new DOMException("Denied", "NotAllowedError")) },
    });
  });
  await open(page);
  await page.getByRole("button", { name: "Copy address: Nexus Drift", exact: true }).click();
  const address = page.getByRole("textbox", { name: "Server address: Nexus Drift", exact: true });
  await expect(address).toBeFocused();
  await expect(page.getByRole("article", { name: "Nexus Drift" })).toContainText(
    "copy it manually",
  );
  assert.deepEqual(await address.evaluate((input) => [input.selectionStart, input.selectionEnd]), [
    0,
    "192.0.2.1:22003".length,
  ]);
});

check(
  "J1-09 narrow screen and light theme keep the directory usable",
  async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("nexus-theme", "light"));
    await open(page);
    await expect(page.getByRole("article")).toBeVisible();
    await expect(page.getByRole("searchbox", { name: "Search servers" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Copy address/ })).toBeVisible();
    assert(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      "Page overflows the narrow viewport",
    );
    assert(
      await region(page).evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
      "Directory overflows its container",
    );
    assert.notEqual(
      await page
        .getByRole("heading", { level: 1 })
        .evaluate((element) => getComputedStyle(element).color),
      "rgb(255, 255, 255)",
      "Light-theme heading is white",
    );
    await page.getByRole("searchbox", { name: "Search servers" }).focus();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("combobox", { name: "Minimum players" })).toBeFocused();
  },
  {
    viewport: { width: 390, height: 844 },
    capture: true,
    route: (route) =>
      respond(
        route,
        data([{ ...servers[0], name: "LongServerName".repeat(18), mapName: "LongMap".repeat(15) }]),
      ),
  },
);

let listShrank = false;
check(
  "J1-10 shrinking list returns to a valid page",
  async ({ page }) => {
    await open(page);
    await expect(region(page)).toContainText("Page 1 of 2");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(region(page).getByRole("navigation")).toHaveCount(0);
    await expect(page.getByRole("article", { name: "Nexus Drift" })).toBeVisible();
  },
  {
    route: (route) => {
      const offset = Number(new URL(route.request().url()).searchParams.get("offset"));
      if (offset) listShrank = true;
      return respond(
        route,
        offset
          ? data([], { total: 1, offset })
          : data([servers[0]], { total: listShrank ? 1 : 51 }),
      );
    },
  },
);

// Use the browser automation CLI against the same real, fixture-controlled page.
// Async subprocesses keep Playwright's routing event loop available while CDP runs.
check(
  "J1-11 agent-browser navigation, snapshot and screenshot",
  async ({ page }) => {
    await open(page);
    await expect(page.getByRole("article", { name: "Nexus Drift" })).toBeVisible();
    const cli = join(process.env.NEXUS_BROWSER_TOOLS, "node_modules/.bin/agent-browser");
    const agent = async (...args) =>
      execute(cli, ["--session", "nexus-directory-ci", "--cdp", "9222", ...args], {
        timeout: 25_000,
        maxBuffer: 1024 * 1024,
        env: { ...process.env, HOME: process.env.NEXUS_BROWSER_HOME },
      });
    try {
      await agent("open", `${baseURL}/servers`);
      await expect(page.getByRole("article", { name: "Nexus Drift" })).toBeVisible();
      const { stdout } = await agent("snapshot", "-i");
      assert.match(stdout, /Search servers/);
      assert.match(stdout, /Copy address: Nexus Drift/);
      await writeFile(join(output, "agent-browser-snapshot.txt"), stdout);
      await agent("screenshot", join(output, "agent-browser-directory.png"));
      console.log(`Agent-browser snapshot:\n${stdout}`);
    } finally {
      await agent("close");
    }
  },
  { capture: true },
);
