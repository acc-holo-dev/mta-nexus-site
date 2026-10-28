import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

assert.equal(process.env.GITHUB_ACTIONS, "true");
assert.equal(process.env.RUNNER_ENVIRONMENT, "github-hosted");
assert(process.env.NEXUS_BROWSER_TOOLS, "The browser tool directory is required");
assert(process.env.NEXUS_BROWSER_REPORT_DIR, "A browser report directory is required");
assert.equal(
  process.env.NEXUS_BROWSER_BASE_URL,
  "https://nexus-ci.test:8443",
  "Only the disposable CI site may be tested",
);
assert(process.env.NEXUS_BROWSER_HOME, "A disposable browser HOME is required");

const require = createRequire(join(resolve(process.env.NEXUS_BROWSER_TOOLS), "package.json"));
const { defineConfig } = require("@playwright/test");
const reportRoot = resolve(process.env.NEXUS_BROWSER_REPORT_DIR);

export default defineConfig({
  testDir: "./scripts/tests",
  testMatch: "**/*.playwright.mjs",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  preserveOutput: "failures-only",
  outputDir: join(reportRoot, "playwright-results"),
  reporter: [["line"], ["json", { outputFile: join(reportRoot, "playwright-report.json") }]],
  use: {
    baseURL: process.env.NEXUS_BROWSER_BASE_URL,
    ignoreHTTPSErrors: false,
    locale: "en-GB",
    timezoneId: "UTC",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    launchOptions: {
      args: ["--host-resolver-rules=MAP nexus-ci.test 127.0.0.1"],
      env: {
        ...process.env,
        HOME: process.env.NEXUS_BROWSER_HOME,
      },
    },
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
