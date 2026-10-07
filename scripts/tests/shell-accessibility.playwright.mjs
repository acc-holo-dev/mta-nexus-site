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
    const discoverCopy = dictionary.discover;
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await context.addCookies([{ name: "nexus_locale", value: locale, url: process.env.NEXUS_BROWSER_BASE_URL, secure: true, sameSite: "Lax" }]);
    await page.goto("/market");
    const searchTrigger = page
      .getByRole("banner")
      .getByRole("link", { name: dictionary.nav.search, exact: true });
    // Test the skip link from the first actual Tab, rather than programmatic focus.
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: dictionary.nav.skipToContent, exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("main")).toBeFocused();
    await expect(searchTrigger).toBeVisible();
    await expect(searchTrigger).toHaveAttribute("href", "/discover");
    await searchTrigger.focus();
    await expect(searchTrigger).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/discover(?:\?.*)?$/u);

    const discoverTabs = page.getByRole("navigation", {
      name: discoverCopy.tabsLabel,
      exact: true,
    });
    const resourcesTab = discoverTabs.getByRole("link", {
      name: discoverCopy.resources,
      exact: true,
    });
    await resourcesTab.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/discover\?type=resources(?:&.*)?$/u);

    const discoverSearch = page.getByRole("search", {
      name: discoverCopy.searchLabel,
      exact: true,
    });
    const input = discoverSearch.getByRole("searchbox", {
      name: discoverCopy.searchLabel,
      exact: true,
    });
    await input.focus();
    await expect(input).toBeFocused();
    await input.fill(process.env.NEXUS_RESOURCE_BROWSER_PRODUCT_TITLE);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/discover\?type=resources&q=/u);

    const escapedTitle = process.env.NEXUS_RESOURCE_BROWSER_PRODUCT_TITLE.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );
    const result = page
      .getByRole("main")
      .getByRole("link", { name: new RegExp(escapedTitle, "u") })
      .first();
    await expect(result).toBeVisible();
    await result.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(
      new RegExp(`/market/${process.env.NEXUS_RESOURCE_BROWSER_PRODUCT_SLUG}$`, "u"),
    );
    evidence.push(
      `${locale}: skip link and ordinary keyboard search navigation through Discover to a real resource`,
    );

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

    const headings = { "/market": dictionary.market.title, "/discover": dictionary.discover.title,
      "/workspace": dictionary.workspace.signInRequired, "/workspace/resources": dictionary.workspace.signInRequired,
      "/notifications": dictionary.notifications.title, "/settings": dictionary.settings.signInRequired,
      "/support": dictionary.support.title, "/auth/login": dictionary.auth.loginTitle };
    const routes = Object.keys(headings);
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      for (const route of routes) {
        const response = await page.goto(route);
        assert.equal(response.status(), 200, `${locale} ${width} ${route}`);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(page.getByRole("main").getByRole("heading", { level: 1, name: headings[route], exact: true })).toBeVisible();
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `Horizontal overflow: ${locale} ${width} ${route}`);
        // Every visible form field needs an accessible label.
        const unlabeled = await page.locator('main input:not([type="hidden"]), main select, main textarea').evaluateAll((elements) => elements.filter((element) => element.getClientRects().length && !element.getAttribute("aria-label") && !element.getAttribute("aria-labelledby") && !element.labels?.length).map((element) => element.name || element.id));
        assert.deepEqual(unlabeled, [], `${route} unlabeled fields`);
        if (width < 1024) {
          const navigation = page.getByRole("navigation", { name: dictionary.nav.ecosystem, exact: true });
          await expect(navigation.getByRole("link", { name: dictionary.nav.mobileMarket, exact: true })).toBeVisible();
          await expect(navigation.getByRole("button", { name: dictionary.nav.more, exact: true })).toBeVisible();
          if (route.startsWith("/workspace")) await expect(navigation.getByRole("button", { name: dictionary.nav.more, exact: true })).toHaveAttribute("aria-current", "page");
        }
      }
      evidence.push(`${locale}: eight core routes at ${width}px, localized headings, labeled fields and mobile current-route state`);
    }
    await page.setViewportSize({ width: 390, height: 480 });
    await page.goto("/market");
    const mobileNavigation = page.getByRole("navigation", {
      name: dictionary.nav.ecosystem,
      exact: true,
    });
    const moreButton = mobileNavigation.getByRole("button", {
      name: dictionary.nav.more,
      exact: true,
    });
    await moreButton.focus();
    await page.keyboard.press("Enter");
    const moreDialog = page.getByRole("dialog", {
      name: dictionary.nav.more,
      exact: true,
    });
    await expect(
      moreDialog.getByRole("link", {
        name: dictionary.nav.explore,
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      moreDialog.getByRole("link", {
        name: dictionary.nav.notifications,
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      moreDialog.getByRole("link", {
        name: dictionary.nav.mobileWorkspace,
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      moreDialog.getByRole("link", {
        name: dictionary.nav.support,
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      moreDialog.getByRole("link", {
        name: dictionary.nav.settings,
        exact: true,
      }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(moreDialog).toHaveCount(0);
    await expect(moreButton).toBeFocused();

    await page.keyboard.press("Enter");
    const reopenedMoreDialog = page.getByRole("dialog", {
      name: dictionary.nav.more,
      exact: true,
    });
    await reopenedMoreDialog
      .getByRole("link", {
        name: dictionary.nav.support,
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(/\/support$/u);
    await expect(
      page.getByRole("main").getByRole("heading", {
        level: 1,
        name: dictionary.support.title,
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("main").getByRole("link", {
        name: dictionary.support.signIn,
        exact: true,
      }),
    ).toHaveAttribute("href", "/auth/login");
    evidence.push(
      `${locale}: mobile More menu restores focus and routes guests to the real Support sign-in state`,
    );

    await page.goto("/market");
    const mobileSearchTrigger = page
      .getByRole("banner")
      .getByRole("link", { name: dictionary.nav.search, exact: true });
    await expect(mobileSearchTrigger).toHaveAttribute("href", "/discover");
    await mobileSearchTrigger.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/discover(?:\?.*)?$/u);
    await expect(
      page.getByRole("searchbox", {
        name: discoverCopy.searchLabel,
        exact: true,
      }),
    ).toBeVisible();
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      `Horizontal overflow: ${locale} short mobile Discover`,
    );
    assert.deepEqual(errors, []);
    evidence.push(
      `${locale}: ordinary Discover search remains keyboard reachable and fits a short mobile viewport; no uncaught browser errors`,
    );
  });
}
