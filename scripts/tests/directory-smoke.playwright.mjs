import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

assert.equal(process.env.GITHUB_ACTIONS, "true");
assert.equal(process.env.RUNNER_ENVIRONMENT, "github-hosted");
assert(process.env.NEXUS_BROWSER_TOOLS, "The browser tool directory is required");
assert.equal(
  process.env.NEXUS_BROWSER_BASE_URL,
  "https://nexus-ci.test:8443",
  "Only the disposable CI site may be tested",
);

const require = createRequire(
  join(resolve(process.env.NEXUS_BROWSER_TOOLS), "package.json"),
);
const { test, expect } = require("@playwright/test");

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

function directoryData(extra = {}) {
  return {
    servers,
    total: servers.length,
    offset: 0,
    limit: 50,
    fetchedAt,
    isStale: true,
    ...extra,
  };
}

test("J1 native-runner smoke: honest counts, freshness and connection actions", async ({
  page,
  context,
}) => {
  const browserErrors = [];

  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });

  await context.route(routePattern, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(directoryData()),
    }),
  );

  const response = await page.goto("/servers");
  expect(response?.status()).toBe(200);

  await expect(
    page.getByRole("heading", { name: "Multi Theft Auto servers" }),
  ).toBeVisible();

  const directory = page.getByRole("region", { name: "Server directory" });
  await expect(
    page.getByRole("article", { name: "Nexus Drift" }),
  ).toContainText("12 players / 100 slots");
  await expect(
    page.getByRole("article", { name: "Unknown Population" }),
  ).toContainText("Player count unknown");
  await expect(
    page.getByRole("article", { name: "Empty But Known" }),
  ).toContainText("0 players / 32 slots");
  await expect(directory).toContainText("Updates are delayed");
  await expect(directory.locator("time")).toHaveAttribute("datetime", fetchedAt);
  await expect(
    page.getByRole("link", {
      name: "Connect to Nexus Drift",
      exact: true,
    }),
  ).toHaveAttribute("href", "mtasa://192.0.2.1:22003");
  await expect(
    page.getByRole("textbox", {
      name: "Server address for Nexus Drift",
      exact: true,
    }),
  ).toHaveValue("192.0.2.1:22003");

  await expect(
    page.locator("[data-nextjs-dialog], .vite-error-overlay"),
  ).toHaveCount(0);
  assert.deepEqual(
    browserErrors,
    [],
    "Unexpected JavaScript, hydration or console errors",
  );
});
