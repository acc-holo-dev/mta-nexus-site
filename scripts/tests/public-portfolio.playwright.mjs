import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { getDictionary } from "../../apps/web/src/lib/i18n.ts";

assert.equal(process.env.GITHUB_ACTIONS, "true");
assert.equal(process.env.RUNNER_ENVIRONMENT, "github-hosted");
assert.equal(process.env.NEXUS_BROWSER_BASE_URL, "https://nexus-ci.test:8443");
const require = createRequire(join(resolve(process.env.NEXUS_BROWSER_TOOLS), "package.json"));
const { test, expect } = require("@playwright/test");
const results = [];
test.afterAll(async () => {
  const output = resolve(process.env.NEXUS_BROWSER_REPORT_DIR);
  await mkdir(output, { recursive: true });
  await writeFile(join(output, "portfolio-results.json"), JSON.stringify({ commit: process.env.GITHUB_SHA, results,
    scope: "Real production-rendered developer, user and organization portfolios: 125 safe resources and 25 articles; guest Chromium RU/EN on mobile and desktop." }, null, 2));
  await writeFile(join(output, "portfolio-summary.md"), ["# Large public portfolio acceptance", "", ...results.map(r => `- ${r.status}: ${r.name}`), ""].join("\n"));
});

for (const locale of ["en", "ru"]) {
  test(`large public portfolios in ${locale}`, async ({ page, context }) => {
    test.setTimeout(150_000);
    const name = `${locale}: 125 resources, tie ordering, deep/stale pages, hidden rows, independent article navigation and viewport fit`;
    let status = "FAIL";
    try {
      const dictionary = getDictionary(locale);
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await context.addCookies([{ name: "nexus_locale", value: locale, url: process.env.NEXUS_BROWSER_BASE_URL, secure: true, sameSite: "Lax" }]);
      const titles = async () => page.locator("#resources h3").allTextContents();
      const expectedTitles = (high, low) => Array.from({ length: high - low + 1 }, (_, i) => `Portfolio resource ${String(high - i).padStart(3, "0")}`);
      for (const [path, title] of [
        ["/developers/portfolio_ci", "Portfolio CI Author"],
        ["/users/portfolio_ci", "Portfolio CI Author"],
        ["/organizations/portfolio-ci", "Portfolio CI Organization"],
      ]) {
        for (const width of [390, 1280]) {
          await page.setViewportSize({ width, height: 900 });
          await page.goto(path);
          await expect(page.getByRole("heading", { level: 1, name: title, exact: true })).toBeVisible();
          assert.deepEqual(await titles(), expectedTitles(125, 102));
          const nav = page.locator("#resources").getByRole("navigation");
          await expect(nav).toContainText(`${dictionary.market.pageLabel} 1 / 6`);
          await nav.getByRole("link", { name: dictionary.market.nextPage, exact: true }).click();
          await expect(nav).toContainText(`${dictionary.market.pageLabel} 2 / 6`);
          assert.deepEqual(await titles(), expectedTitles(101, 78));
          await page.goto(`${path}?page=5`);
          assert.deepEqual(await titles(), expectedTitles(29, 6));
          await page.goto(`${path}?page=999999999`);
          await expect(nav).toContainText(`${dictionary.market.pageLabel} 6 / 6`);
          assert.deepEqual(await titles(), expectedTitles(5, 1));
          await expect(nav.getByRole("link", { name: dictionary.market.nextPage, exact: true })).toHaveCount(0);
          await page.goto(`${path}?page=invalid`);
          assert.deepEqual(await titles(), expectedTitles(125, 102));
          await expect(page.getByText(/Hidden (draft|paid|missing|rejected|foreign)/u)).toHaveCount(0);
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${path} overflows at ${width}`);
          await page.screenshot({ path: join(process.env.NEXUS_BROWSER_REPORT_DIR, `portfolio-${locale}-${path.split("/")[1]}-${width}.png`), fullPage: true });
        }
      }
      await page.goto("/organizations/portfolio-ci?page=2&articlePage=2");
      const resourceNav = page.locator("#resources").getByRole("navigation");
      const articleNav = page.locator("#articles").getByRole("navigation");
      await expect(resourceNav).toContainText(`${dictionary.market.pageLabel} 2 / 6`);
      await expect(articleNav).toContainText(`${dictionary.market.pageLabel} 2 / 3`);
      assert.equal(await page.locator("#articles h3").count(), 12);
      await articleNav.getByRole("link", { name: dictionary.market.nextPage, exact: true }).click();
      await expect(page).toHaveURL(/page=2&articlePage=3#articles$/u);
      await expect(resourceNav).toContainText(`${dictionary.market.pageLabel} 2 / 6`);
      assert.deepEqual(await page.locator("#articles h3").allTextContents(), ["Portfolio article 001"]);
      await resourceNav.getByRole("link", { name: dictionary.market.nextPage, exact: true }).click();
      await expect(page).toHaveURL(/page=3&articlePage=3#resources$/u);
      await expect(articleNav).toContainText(`${dictionary.market.pageLabel} 3 / 3`);
      assert.deepEqual(errors, []);
      status = "PASS";
    } finally {
      results.push({ name, status });
    }
  });
}
