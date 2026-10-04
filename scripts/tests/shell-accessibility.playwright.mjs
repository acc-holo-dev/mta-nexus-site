import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { getDictionary } from "../../apps/web/src/lib/i18n.ts";
assert.equal(process.env.GITHUB_ACTIONS, "true");
assert.equal(process.env.RUNNER_ENVIRONMENT, "github-hosted");
assert.equal(process.env.NEXUS_BROWSER_BASE_URL, "https://nexus-ci.test:8443");
assert(process.env.NEXUS_BROWSER_TOOLS);
assert(process.env.NEXUS_BROWSER_REPORT_DIR);
const require = createRequire(join(resolve(process.env.NEXUS_BROWSER_TOOLS), "package.json"));
const { test, expect } = require("@playwright/test");
const evidence = [];
test.afterAll(async () => {
  const output = resolve(process.env.NEXUS_BROWSER_REPORT_DIR);
  await mkdir(output, { recursive: true });
  await writeFile(join(output, "shell-results.json"), JSON.stringify({ commit: process.env.GITHUB_SHA, results: evidence,
    scope: "Chromium keyboard behavior, responsive widths, localization and visible form labels. This is scoped acceptance, not a full WCAG or screen-reader audit." }, null, 2));
  await writeFile(join(output, "shell-summary.md"), ["# Keyboard, mobile and locale acceptance", "", ...evidence.map((value) => `- PASS: ${value}`), ""].join("\n"));
});

async function containedTabbing(page, dialog) {
  for (const key of ["Tab", "Tab", "Tab", "Shift+Tab", "Shift+Tab", "Shift+Tab"]) {
    await page.keyboard.press(key);
    assert(await dialog.evaluate((element) => element.contains(document.activeElement)), `Focus escaped after ${key}`);
  }
}
for (const locale of ["en", "ru"]) {
  test(`shell keyboard and responsive routes in ${locale}`, async ({ page, context }) => {
    test.setTimeout(120_000);
    const dictionary = getDictionary(locale);
    const copy = dictionary.commandPalette;
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await context.addCookies([{ name: "nexus_locale", value: locale, url: process.env.NEXUS_BROWSER_BASE_URL, secure: true, sameSite: "Lax" }]);
    await page.goto("/market");
    const searchTrigger = page.getByRole("banner").getByRole("button", { name: new RegExp(dictionary.nav.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "u") });
    // Test the skip link from the first actual Tab, rather than programmatic focus.
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: dictionary.nav.skipToContent, exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("main")).toBeFocused();
    await searchTrigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: copy.dialogLabel, exact: true });
    const input = dialog.getByRole("combobox", { name: copy.searchLabel, exact: true });
    await expect(input).toBeFocused();
    await containedTabbing(page, dialog);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(searchTrigger).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(dialog).toBeVisible();
    await page.mouse.click(5, 5);
    await expect(dialog).toHaveCount(0);
    await expect(searchTrigger).toBeFocused();
    await page.keyboard.press("Control+k");
    await expect(input).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(dialog.getByRole("option", { name: copy.goServers, exact: true })).toHaveAttribute("aria-selected", "true");
    const activeId = await input.getAttribute("aria-activedescendant");
    assert.equal(await dialog.getByRole("option", { name: copy.goServers, exact: true }).getAttribute("id"), activeId);
    await page.keyboard.press("ArrowUp");
    await expect(dialog.getByRole("option", { name: copy.goMarket, exact: true })).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Enter");
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/\/market$/u);
    await page.keyboard.press("Control+k");
    await expect(input).toBeFocused();
    // Use a real seeded public resource search, then activate its result by keyboard.
    await input.fill(process.env.NEXUS_RESOURCE_BROWSER_PRODUCT_TITLE);
    const result = dialog.getByRole("option", { name: new RegExp(process.env.NEXUS_RESOURCE_BROWSER_PRODUCT_TITLE, "u") });
    await expect(result).toBeVisible();
    await expect(result).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/market/${process.env.NEXUS_RESOURCE_BROWSER_PRODUCT_SLUG}$`, "u"));
    evidence.push(`${locale}: skip link, modal focus containment/return, shortcut, arrows and real search result activation`);

    const bell = page.getByRole("banner").getByRole("button", { name: dictionary.notificationBell.title, exact: true });
    await bell.focus();
    await page.keyboard.press("Enter");
    const notices = page.getByRole("dialog", { name: dictionary.notificationBell.title, exact: true });
    await expect(notices.getByRole("button", { name: dictionary.notificationBell.close, exact: true })).toBeFocused();
    await containedTabbing(page, notices);
    await page.keyboard.press("Escape");
    await expect(notices).toHaveCount(0);
    await expect(bell).toBeFocused();
    evidence.push(`${locale}: notification modal contains focus and restores its trigger on Escape`);

    const routes = ["/market", "/workspace", "/workspace/resources", "/notifications", "/settings", "/auth/login"];
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      for (const route of routes) {
        const response = await page.goto(route);
        assert.equal(response.status(), 200, `${locale} ${width} ${route}`);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toBeVisible();
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `Horizontal overflow: ${locale} ${width} ${route}`);
        // Every visible form field needs an accessible label.
        const unlabeled = await page.locator('main input:not([type="hidden"]), main select, main textarea').evaluateAll((elements) => elements.filter((element) => element.getClientRects().length && !element.getAttribute("aria-label") && !element.getAttribute("aria-labelledby") && !element.labels?.length).map((element) => element.name || element.id));
        assert.deepEqual(unlabeled, [], `${route} unlabeled fields`);
        if (width < 1024) {
          const navigation = page.getByRole("navigation", { name: dictionary.nav.ecosystem, exact: true });
          await expect(navigation.getByRole("link", { name: dictionary.nav.mobileResources, exact: true })).toBeVisible();
          await expect(navigation.getByRole("link", { name: dictionary.nav.mobileWorkspace, exact: true })).toBeVisible();
          if (route.startsWith("/workspace")) await expect(navigation.getByRole("link", { name: dictionary.nav.mobileWorkspace, exact: true })).toHaveAttribute("aria-current", "page");
        }
      }
      evidence.push(`${locale}: six core routes at ${width}px, localized headings, labeled fields and mobile current-route state`);
    }
    await page.setViewportSize({ width: 390, height: 480 });
    await searchTrigger.focus();
    await page.keyboard.press("Enter");
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    assert(box.x >= 0 && box.y >= 0 && box.x + box.width <= 390 && box.y + box.height <= 480);
    await page.keyboard.press("Escape");
    assert.deepEqual(errors, []);
    evidence.push(`${locale}: command dialog stays within a short mobile viewport; no uncaught browser errors`);
  });
}
