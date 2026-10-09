import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { getDictionary } from "../../apps/web/src/lib/i18n.ts";
import { assertAxeAccessibility } from "../axe-accessibility.mjs";
assert.equal(process.env.GITHUB_ACTIONS, "true");
assert.equal(process.env.RUNNER_ENVIRONMENT, "github-hosted");
assert.equal(process.env.NEXUS_BROWSER_BASE_URL, "https://nexus-ci.test:8443");
assert(process.env.NEXUS_BROWSER_TOOLS);
assert(process.env.NEXUS_BROWSER_REPORT_DIR);
assert(process.env.NEXUS_AUTHOR_BROWSER_EMAIL);
assert(process.env.NEXUS_AUTHOR_BROWSER_PASSWORD);
assert(process.env.NEXUS_CLAIM_BROWSER_SERVER_SLUG);
assert(process.env.NEXUS_CLAIM_BROWSER_SERVER_NAME);
const require = createRequire(join(resolve(process.env.NEXUS_BROWSER_TOOLS), "package.json"));
const { test, expect } = require("@playwright/test");
const evidence = [];
test.afterAll(async () => {
  const output = resolve(process.env.NEXUS_BROWSER_REPORT_DIR);
  await mkdir(output, { recursive: true });
  await writeFile(join(output, "shell-results.json"), JSON.stringify({ commit: process.env.GITHUB_SHA, results: evidence,
    scope: "Chromium keyboard behavior, responsive widths, localization, visible form labels, ARIA IDREF integrity, button/link/image names, WCAG 2.5.8 control target size, WCAG 2.4.7 visible keyboard focus, logical tabindex order, hidden-focus safety, dialog naming, tab/tabpanel relations, aria-current validity, main/H1 structure and navigation landmark naming. This is scoped acceptance, not a full assistive-technology certification." }, null, 2));
  await writeFile(join(output, "shell-summary.md"), ["# Keyboard, mobile and locale acceptance", "", ...evidence.map((value) => `- PASS: ${value}`), ""].join("\n"));
});

async function assertValidAccessibilityReferences(page, label) {
  const result = await page.evaluate(() => {
    const counts = new Map();
    for (const element of document.querySelectorAll("[id]")) {
      const id = element.id;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    const duplicateIds = [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([id]) => id);

    const missingReferences = [];
    const attributes = [
      "aria-labelledby",
      "aria-describedby",
      "aria-errormessage",
      "aria-controls",
    ];
    for (const element of document.querySelectorAll(
      attributes.map((attribute) => `[${attribute}]`).join(","),
    )) {
      for (const attribute of attributes) {
        const value = element.getAttribute(attribute);
        if (!value) continue;
        for (const id of value.split(/\s+/u).filter(Boolean)) {
          if (!counts.has(id)) {
            missingReferences.push({
              attribute,
              id,
              element: element.tagName.toLowerCase(),
            });
          }
        }
      }
    }

    return { duplicateIds, missingReferences };
  });

  assert.deepEqual(result.duplicateIds, [], `${label}: duplicate DOM ids`);
  assert.deepEqual(
    result.missingReferences,
    [],
    `${label}: dangling ARIA ID references`,
  );
}

async function assertBasicAccessibleNames(page, label) {
  const result = await page.evaluate(() => {
    const visible = (element) =>
      element.getClientRects().length > 0 &&
      getComputedStyle(element).visibility !== "hidden";

    const unnamedButtons = [...document.querySelectorAll("button")]
      .filter(visible)
      .filter((button) => {
        if (button.getAttribute("aria-label")?.trim()) return false;
        if (button.getAttribute("aria-labelledby")?.trim()) return false;
        if (button.getAttribute("title")?.trim()) return false;
        if (button.textContent?.trim()) return false;
        if (
          [...button.querySelectorAll("img[alt]")].some((image) =>
            image.getAttribute("alt")?.trim(),
          )
        ) {
          return false;
        }
        return !button.querySelector("[aria-label]");
      })
      .map((button) => button.outerHTML.slice(0, 180));

    const unnamedLinks = [...document.querySelectorAll("a[href]")]
      .filter(visible)
      .filter((link) => {
        if (link.getAttribute("aria-label")?.trim()) return false;
        if (link.getAttribute("aria-labelledby")?.trim()) return false;
        if (link.getAttribute("title")?.trim()) return false;
        if (link.textContent?.trim()) return false;
        if (
          [...link.querySelectorAll("img[alt]")].some((image) =>
            image.getAttribute("alt")?.trim(),
          )
        ) {
          return false;
        }
        return !link.querySelector("[aria-label]");
      })
      .map((link) => link.outerHTML.slice(0, 180));

    const imagesWithoutAlt = [...document.querySelectorAll("img")]
      .filter(visible)
      .filter((image) => !image.hasAttribute("alt"))
      .map((image) => image.outerHTML.slice(0, 180));

    const positiveTabIndex = [
      ...document.querySelectorAll("[tabindex]"),
    ]
      .filter(visible)
      .filter((element) => element.tabIndex > 0)
      .map((element) => element.outerHTML.slice(0, 180));

    return {
      unnamedButtons,
      unnamedLinks,
      imagesWithoutAlt,
      positiveTabIndex,
    };
  });

  assert.deepEqual(
    result.unnamedButtons,
    [],
    `${label}: visible buttons without accessible names`,
  );
  assert.deepEqual(
    result.unnamedLinks,
    [],
    `${label}: visible links without accessible names`,
  );
  assert.deepEqual(
    result.imagesWithoutAlt,
    [],
    `${label}: visible images without alt attributes`,
  );
  assert.deepEqual(
    result.positiveTabIndex,
    [],
    `${label}: positive tabindex must not override logical focus order`,
  );
}

async function assertAdvancedAriaSemantics(page, label) {
  const result = await page.evaluate(() => {
    const visible = (element) =>
      element.getClientRects().length > 0 &&
      getComputedStyle(element).visibility !== "hidden";

    const focusableSelector = [
      "a[href]",
      "button:not(:disabled)",
      "input:not(:disabled)",
      "select:not(:disabled)",
      "textarea:not(:disabled)",
      "[tabindex]:not([tabindex=\"-1\"])",
    ].join(",");

    const focusableInsideHidden = [
      ...document.querySelectorAll('[aria-hidden="true"]'),
    ]
      .flatMap((hidden) => {
        const candidates = [];
        if (hidden.matches(focusableSelector)) candidates.push(hidden);
        candidates.push(...hidden.querySelectorAll(focusableSelector));
        return candidates;
      })
      .filter(visible)
      .map((element) => element.outerHTML.slice(0, 180));

    const unnamedDialogs = [
      ...document.querySelectorAll(
        'dialog, [role="dialog"], [role="alertdialog"]',
      ),
    ]
      .filter(visible)
      .filter((dialog) => {
        if (dialog.getAttribute("aria-label")?.trim()) return false;
        const labelledBy = dialog.getAttribute("aria-labelledby");
        if (!labelledBy) return true;
        return !labelledBy
          .split(/\s+/u)
          .filter(Boolean)
          .some((id) => document.getElementById(id)?.textContent?.trim());
      })
      .map((dialog) => dialog.outerHTML.slice(0, 180));

    const invalidTabs = [...document.querySelectorAll('[role="tab"]')]
      .filter(visible)
      .flatMap((tab) => {
        const problems = [];
        const controls = tab.getAttribute("aria-controls");
        const selected = tab.getAttribute("aria-selected");
        if (!controls) {
          problems.push("missing aria-controls");
        } else {
          const panel = document.getElementById(controls);
          if (!panel || panel.getAttribute("role") !== "tabpanel") {
            problems.push("aria-controls does not reference a tabpanel");
          }
        }
        if (selected !== "true" && selected !== "false") {
          problems.push("aria-selected must be true or false");
        }
        return problems.map(
          (problem) =>
            `${problem}: ${tab.outerHTML.slice(0, 150)}`,
        );
      });

    const invalidAriaCurrent = [...document.querySelectorAll("[aria-current]")]
      .filter(visible)
      .filter((element) => {
        const value = element.getAttribute("aria-current");
        return ![
          "page",
          "step",
          "location",
          "date",
          "time",
          "true",
          "false",
        ].includes(value ?? "");
      })
      .map((element) => element.outerHTML.slice(0, 180));

    return {
      focusableInsideHidden,
      unnamedDialogs,
      invalidTabs,
      invalidAriaCurrent,
    };
  });

  assert.deepEqual(
    result.focusableInsideHidden,
    [],
    `${label}: aria-hidden content must not expose focusable controls`,
  );
  assert.deepEqual(
    result.unnamedDialogs,
    [],
    `${label}: visible dialogs must have accessible names`,
  );
  assert.deepEqual(
    result.invalidTabs,
    [],
    `${label}: tabs must reference real tabpanels and expose selection state`,
  );
  assert.deepEqual(
    result.invalidAriaCurrent,
    [],
    `${label}: aria-current values must use valid tokens`,
  );
}

async function assertMinimumControlTargetSize(page, label) {
  const failures = await page.evaluate(() => {
    const visible = (element) =>
      element.getClientRects().length > 0 &&
      getComputedStyle(element).visibility !== "hidden";

    const controls = [
      ...document.querySelectorAll(
        [
          "button:not(:disabled)",
          "input:not([type=\"hidden\"]):not(:disabled)",
          "select:not(:disabled)",
          "textarea:not(:disabled)",
          "summary",
          '[role="tab"]',
          '[role="switch"]',
          '[role="checkbox"]',
          '[role="radio"]',
        ].join(","),
      ),
    ].filter(visible);

    return controls.flatMap((control) => {
      let target = control;
      if (
        control instanceof HTMLInputElement &&
        (control.type === "checkbox" || control.type === "radio")
      ) {
        const labelElement = [...control.labels].find(visible);
        if (labelElement) target = labelElement;
      }

      const rect = target.getBoundingClientRect();
      if (rect.width >= 24 && rect.height >= 24) return [];
      return [
        {
          element: control.outerHTML.slice(0, 180),
          width: Math.round(rect.width * 10) / 10,
          height: Math.round(rect.height * 10) / 10,
        },
      ];
    });
  });

  assert.deepEqual(
    failures,
    [],
    `${label}: visible controls require a minimum 24x24 CSS-pixel target`,
  );
}

async function assertDocumentStructure(page, label) {
  const result = await page.evaluate(() => {
    const visible = (element) =>
      element.getClientRects().length > 0 &&
      getComputedStyle(element).visibility !== "hidden";

    const mains = [...document.querySelectorAll("main")].filter(visible);
    const visibleHeadings = [
      ...document.querySelectorAll("h1, h2, h3, h4, h5, h6"),
    ].filter(visible);
    const h1s = mains.flatMap((main) =>
      [...main.querySelectorAll("h1")].filter(visible),
    );
    const emptyHeadings = visibleHeadings
      .filter((heading) => !heading.textContent?.trim())
      .map((heading) => heading.outerHTML.slice(0, 180));

    const navs = [...document.querySelectorAll("nav")].filter(visible);
    const unnamedNavs =
      navs.length <= 1
        ? []
        : navs
            .filter(
              (nav) =>
                !nav.getAttribute("aria-label")?.trim() &&
                !nav.getAttribute("aria-labelledby")?.trim(),
            )
            .map((nav) => nav.outerHTML.slice(0, 180));

    return {
      mainCount: mains.length,
      h1Count: h1s.length,
      emptyHeadings,
      unnamedNavs,
    };
  });

  assert.equal(result.mainCount, 1, `${label}: exactly one visible main`);
  assert.equal(result.h1Count, 1, `${label}: exactly one visible main h1`);
  assert.deepEqual(
    result.emptyHeadings,
    [],
    `${label}: visible headings require text`,
  );
  assert.deepEqual(
    result.unnamedNavs,
    [],
    `${label}: multiple visible nav landmarks require names`,
  );
}

async function assertVisibleFocusIndicator(locator, label) {
  const result = await locator.evaluate((element) => {
    const style = getComputedStyle(element);
    const outlineWidth = Number.parseFloat(style.outlineWidth) || 0;
    const transparent = new Set([
      "transparent",
      "rgba(0, 0, 0, 0)",
      "rgba(0,0,0,0)",
    ]);
    const hasOutline =
      style.outlineStyle !== "none" &&
      outlineWidth >= 2 &&
      !transparent.has(style.outlineColor);
    const hasBoxShadow =
      Boolean(style.boxShadow) &&
      style.boxShadow !== "none" &&
      !style.boxShadow.includes("0px 0px 0px 0px");

    return {
      focused: document.activeElement === element,
      hasOutline,
      hasBoxShadow,
      outlineStyle: style.outlineStyle,
      outlineWidth,
      outlineColor: style.outlineColor,
      boxShadow: style.boxShadow,
    };
  });

  assert.equal(result.focused, true, `${label}: element must be focused`);
  assert(
    result.hasOutline || result.hasBoxShadow,
    `${label}: keyboard focus requires a visible outline or focus ring; got ${JSON.stringify(
      result,
    )}`,
  );
}

async function containedTabbing(page, dialog) {
  for (const key of ["Tab", "Tab", "Tab", "Shift+Tab", "Shift+Tab", "Shift+Tab"]) {
    await page.keyboard.press(key);
    assert(
      await dialog.evaluate((element) =>
        element.contains(document.activeElement),
      ),
      `Focus escaped after ${key}`,
    );
    const active = page.locator(":focus");
    await assertVisibleFocusIndicator(
      active,
      `dialog focus after ${key}`,
    );
  }
}
for (const locale of ["en", "ru"]) {
  test(`shell keyboard and responsive routes in ${locale}`, async ({ page, context }, testInfo) => {
    test.setTimeout(120_000);
    const dictionary = getDictionary(locale);
    const discoverCopy = dictionary.discover;
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await context.addCookies([{ name: "nexus_locale", value: locale, url: process.env.NEXUS_BROWSER_BASE_URL, secure: true, sameSite: "Lax" }]);
    await page.goto("/market");
    const reducedMotion = await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.style.animationDuration = "5s";
      probe.style.animationIterationCount = "infinite";
      probe.style.transitionDuration = "5s";
      document.body.append(probe);
      const probeStyle = getComputedStyle(probe);
      const previousScrollBehavior = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = "smooth";
      const htmlStyle = getComputedStyle(document.documentElement);
      const result = {
        animationDuration: probeStyle.animationDuration,
        animationIterationCount: probeStyle.animationIterationCount,
        transitionDuration: probeStyle.transitionDuration,
        scrollBehavior: htmlStyle.scrollBehavior,
      };
      document.documentElement.style.scrollBehavior = previousScrollBehavior;
      probe.remove();
      return result;
    });
    assert.equal(reducedMotion.animationDuration, "0.01ms");
    assert.equal(reducedMotion.animationIterationCount, "1");
    assert.equal(reducedMotion.transitionDuration, "0.01ms");
    assert.equal(reducedMotion.scrollBehavior, "auto");
    evidence.push(
      `${locale}: reduced-motion media query stops repeated animation, shortens transitions and disables smooth scrolling`,
    );
    const searchTrigger = page
      .getByRole("banner")
      .getByRole("link", { name: dictionary.nav.search, exact: true });
    // Test the skip link from the first actual Tab, rather than programmatic focus.
    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", {
      name: dictionary.nav.skipToContent,
      exact: true,
    });
    await expect(skipLink).toBeFocused();
    await assertVisibleFocusIndicator(
      skipLink,
      `${locale} skip link`,
    );
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
    await expect(bell).toHaveAttribute("aria-expanded", "false");
    await expect(bell).not.toHaveAttribute("aria-controls", /.+/u);
    await bell.focus();
    await page.keyboard.press("Enter");
    await expect(bell).toHaveAttribute("aria-expanded", "true");
    await expect(bell).toHaveAttribute("aria-controls", "notification-popover");
    const notices = page.getByRole("dialog", { name: dictionary.notificationBell.title, exact: true });
    await expect(notices).toHaveAttribute("id", "notification-popover");
    await assertAxeAccessibility(page, testInfo, `${locale}-notification-dialog`);
    const noticeClose = notices.getByRole("button", {
      name: dictionary.notificationBell.close,
      exact: true,
    });
    await expect(noticeClose).toBeFocused();
    await assertVisibleFocusIndicator(
      noticeClose,
      `${locale} notification dialog close`,
    );
    await assertMinimumControlTargetSize(
      page,
      `${locale} notification dialog`,
    );
    await containedTabbing(page, notices);
    await page.keyboard.press("Escape");
    await expect(notices).toHaveCount(0);
    await expect(bell).toHaveAttribute("aria-expanded", "false");
    await expect(bell).not.toHaveAttribute("aria-controls", /.+/u);
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
        await assertValidAccessibilityReferences(
          page,
          `${locale} ${width} ${route}`,
        );
        await assertBasicAccessibleNames(
          page,
          `${locale} ${width} ${route}`,
        );
        await assertAdvancedAriaSemantics(
          page,
          `${locale} ${width} ${route}`,
        );
        await assertDocumentStructure(
          page,
          `${locale} ${width} ${route}`,
        );
        await assertMinimumControlTargetSize(
          page,
          `${locale} ${width} ${route}`,
        );
        if (width < 1024) {
          const navigation = page.getByRole("navigation", { name: dictionary.nav.ecosystem, exact: true });
          await expect(navigation.getByRole("link", { name: dictionary.nav.mobileMarket, exact: true })).toBeVisible();
          await expect(navigation.getByRole("button", { name: dictionary.nav.more, exact: true })).toBeVisible();
          if (route.startsWith("/workspace")) await expect(navigation.getByRole("button", { name: dictionary.nav.more, exact: true })).toHaveAttribute("aria-current", "page");
        }
      }
      evidence.push(`${locale}: eight core routes at ${width}px, localized headings, labeled fields and mobile current-route state`);
    }
    await page.goto("/notifications");
    const notificationTabs = page.getByRole("tablist", {
      name: dictionary.notifications.title,
      exact: true,
    });
    const allNotificationsTab = notificationTabs.getByRole("tab", {
      name: dictionary.notifications.all,
      exact: true,
    });
    const unreadNotificationsTab = notificationTabs.getByRole("tab").nth(1);
    await allNotificationsTab.focus();
    await expect(allNotificationsTab).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowRight");
    await expect(unreadNotificationsTab).toBeFocused();
    await assertVisibleFocusIndicator(
      unreadNotificationsTab,
      `${locale} unread notification tab`,
    );
    await expect(unreadNotificationsTab).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const controlledPanelId = await unreadNotificationsTab.getAttribute(
      "aria-controls",
    );
    assert(controlledPanelId);
    const notificationPanel = page.getByRole("tabpanel");
    await expect(notificationPanel).toHaveAttribute("id", controlledPanelId);
    await page.keyboard.press("Home");
    await expect(allNotificationsTab).toBeFocused();
    evidence.push(
      `${locale}: notification filters implement roving tab focus, arrow/Home navigation and a real ARIA tabpanel relation`,
    );

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
    await expect(moreButton).toHaveAttribute("aria-expanded", "false");
    await expect(moreButton).not.toHaveAttribute("aria-controls", /.+/u);
    await moreButton.focus();
    await page.keyboard.press("Enter");
    await expect(moreButton).toHaveAttribute("aria-expanded", "true");
    await expect(moreButton).toHaveAttribute("aria-controls", "mobile-more-menu");
    const moreDialog = page.getByRole("dialog", {
      name: dictionary.nav.more,
      exact: true,
    });
    await expect(moreDialog).toHaveAttribute("id", "mobile-more-menu");
    await assertAxeAccessibility(page, testInfo, `${locale}-mobile-menu-dialog`);
    await assertMinimumControlTargetSize(
      page,
      `${locale} mobile More dialog`,
    );
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
    await expect(moreButton).toHaveAttribute("aria-expanded", "false");
    await expect(moreButton).not.toHaveAttribute("aria-controls", /.+/u);
    await expect(moreButton).toBeFocused();
    await assertVisibleFocusIndicator(
      moreButton,
      `${locale} mobile More trigger after Escape`,
    );

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


async function loginFixture(page) {
  await page.goto("/auth/login");
  const status = await page.evaluate(
    async (account) => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(account),
      });
      return response.status;
    },
    {
      email: process.env.NEXUS_AUTHOR_BROWSER_EMAIL,
      password: process.env.NEXUS_AUTHOR_BROWSER_PASSWORD,
    },
  );
  assert.equal(status, 200);
}

async function logoutFixture(page) {
  const status = await page.evaluate(
    async () =>
      (await fetch("/api/auth/session", { method: "DELETE" })).status,
  );
  assert.equal(status, 200);
}

async function assertNoVisibleUnlabeledFields(page, route) {
  const unlabeled = await page
    .locator(
      'main input:not([type="hidden"]), main select, main textarea',
    )
    .evaluateAll((elements) =>
      elements
        .filter(
          (element) =>
            element.getClientRects().length > 0 &&
            !element.getAttribute("aria-label") &&
            !element.getAttribute("aria-labelledby") &&
            !element.labels?.length,
        )
        .map((element) => element.getAttribute("name") || element.id || element.tagName),
    );
  assert.deepEqual(unlabeled, [], `${route}: visible form fields require accessible labels`);
}

async function assertNoHorizontalOverflow(page, label) {
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    `Horizontal overflow: ${label}`,
  );
}

for (const locale of ["en", "ru"]) {
  test(`critical account accessibility in ${locale}`, async ({ page, context }, testInfo) => {
    test.setTimeout(120_000);
    const dictionary = getDictionary(locale);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await context.addCookies([
      {
        name: "nexus_locale",
        value: locale,
        url: process.env.NEXUS_BROWSER_BASE_URL,
        secure: true,
        sameSite: "Lax",
      },
    ]);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 320, height: 844 });

    await page.goto("/auth/login");
    await expect(
      page.getByRole("main").getByRole("heading", {
        level: 1,
        name: dictionary.auth.loginTitle,
        exact: true,
      }),
    ).toBeVisible();
    const loginEmail = page.getByLabel(dictionary.auth.email, { exact: true });
    const loginPassword = page.getByLabel(dictionary.auth.password, {
      exact: true,
    });
    const loginSubmit = page.getByRole("button", {
      name: dictionary.auth.signIn,
      exact: true,
    });
    await loginEmail.focus();
    await expect(loginEmail).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(loginPassword).toBeFocused();
    await assertVisibleFocusIndicator(
      loginPassword,
      `${locale} login password`,
    );
    await page.keyboard.press("Tab");
    await expect(loginSubmit).toBeFocused();
    await assertVisibleFocusIndicator(
      loginSubmit,
      `${locale} login submit`,
    );
    await loginEmail.fill("a11y-unknown@example.invalid");
    await loginPassword.fill("not-the-right-password");
    await loginSubmit.click();
    await expect(page.locator("#auth-error")).toHaveAttribute("role", "alert");
    await assertAxeAccessibility(page, testInfo, `${locale}-login-error`);
    await assertNoVisibleUnlabeledFields(page, "/auth/login");
    await assertNoHorizontalOverflow(page, `${locale} /auth/login at 320px`);
    evidence.push(
      `${locale}: login has logical keyboard order, labeled controls, live error semantics and 320px reflow`,
    );

    await page.route("**/api/auth/password-reset", async (route) => {
      assert.equal(route.request().method(), "POST");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ accepted: true }),
      });
    });
    try {
      await page.goto("/auth/forgot-password");
      await expect(
        page.getByRole("main").getByRole("heading", {
          level: 1,
          name: dictionary.recovery.forgotTitle,
          exact: true,
        }),
      ).toBeVisible();
      const recoveryEmail = page.getByLabel(dictionary.recovery.email, {
        exact: true,
      });
      const recoverySubmit = page.getByRole("button", {
        name: dictionary.recovery.sendReset,
        exact: true,
      });
      await recoveryEmail.focus();
      await page.keyboard.press("Tab");
      await expect(recoverySubmit).toBeFocused();
      await assertVisibleFocusIndicator(
        recoverySubmit,
        `${locale} password recovery submit`,
      );
      await recoveryEmail.fill("privacy-neutral@example.invalid");
      await recoverySubmit.click();
      await expect(
        page.getByRole("status").filter({
          hasText: dictionary.recovery.accepted,
        }),
      ).toBeVisible();
      await assertNoVisibleUnlabeledFields(page, "/auth/forgot-password");
      await assertAxeAccessibility(page, testInfo, `${locale}-recovery-accepted`);
      await assertNoHorizontalOverflow(
        page,
        `${locale} /auth/forgot-password at 320px`,
      );
      evidence.push(
        `${locale}: password recovery is keyboard reachable, privacy-neutral in the UI, status-announced and mobile-safe`,
      );
    } finally {
      await page.unroute("**/api/auth/password-reset");
    }

    await loginFixture(page);

    const criticalRoutes = [
      {
        route: "/settings",
        heading: dictionary.settings.title,
        ready: async () =>
          expect(
            page.getByRole("heading", {
              level: 2,
              name: dictionary.settings.notificationPreferences,
              exact: true,
            }),
          ).toBeVisible(),
      },
      {
        route: "/security",
        heading: dictionary.securityCenter.title,
        ready: async () =>
          expect(
            page.getByRole("heading", {
              level: 2,
              name: dictionary.securityCenter.sessions,
              exact: true,
            }),
          ).toBeVisible(),
      },
      {
        route: "/support",
        heading: dictionary.support.title,
        ready: async () =>
          expect(
            page.getByRole("heading", {
              level: 2,
              name: dictionary.support.newCase,
              exact: true,
            }),
          ).toBeVisible(),
      },
      {
        route: "/workspace/resources/new",
        heading: dictionary.publishing.resourceTitle,
        ready: async () =>
          expect(
            page.getByRole("button", {
              name: dictionary.publishing.submit,
              exact: true,
            }),
          ).toBeVisible(),
      },
      {
        route: `/servers/${process.env.NEXUS_CLAIM_BROWSER_SERVER_SLUG}`,
        heading: process.env.NEXUS_CLAIM_BROWSER_SERVER_NAME,
        ready: async () =>
          expect(
            page.getByRole("heading", {
              level: 2,
              name: dictionary.serverClaim.title,
              exact: true,
            }),
          ).toBeVisible(),
      },
    ];

    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      for (const spec of criticalRoutes) {
        const response = await page.goto(spec.route);
        assert.equal(response?.status(), 200, `${locale} ${width} ${spec.route}`);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(
          page.getByRole("main").getByRole("heading", {
            level: 1,
            name: spec.heading,
            exact: true,
          }),
        ).toBeVisible();
        await spec.ready();
        // Scan mobile and desktop once each; the 390px pass retains behavioral checks.
        if (width !== 390) await assertAxeAccessibility(page, testInfo, `${locale}-${width}-${spec.route}`);
        await assertNoVisibleUnlabeledFields(page, spec.route);
        await assertValidAccessibilityReferences(
          page,
          `${locale} ${width} ${spec.route}`,
        );
        await assertBasicAccessibleNames(
          page,
          `${locale} ${width} ${spec.route}`,
        );
        await assertAdvancedAriaSemantics(
          page,
          `${locale} ${width} ${spec.route}`,
        );
        await assertDocumentStructure(
          page,
          `${locale} ${width} ${spec.route}`,
        );
        await assertNoHorizontalOverflow(
          page,
          `${locale} ${spec.route} at ${width}px`,
        );
      }
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/settings");
    const firstPreference = page.getByRole("checkbox").first();
    await firstPreference.focus();
    await expect(firstPreference).toBeFocused();
    const webPushRegion = page.getByRole("region", {
      name: dictionary.settings.webPush,
      exact: true,
    });
    await expect(webPushRegion).toBeVisible();
    await expect(
      webPushRegion.locator('[role="status"], [role="alert"]'),
    ).toHaveCount(1);

    await page.goto("/security");
    const settingsLink = page.getByRole("link", {
      name: dictionary.securityCenter.manageSettings,
      exact: true,
    });
    await settingsLink.focus();
    await expect(settingsLink).toBeFocused();

    await page.goto("/support");
    const supportCategory = page.getByLabel(dictionary.support.category);
    const supportSubject = page.getByLabel(dictionary.support.subject);
    const supportMessage = page.getByLabel(dictionary.support.message);
    await supportCategory.focus();
    await page.keyboard.press("Tab");
    await expect(supportSubject).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(supportMessage).toBeFocused();

    await page.goto("/workspace/resources/new");
    const resourceTitle = page.getByLabel(dictionary.publishing.title, {
      exact: true,
    });
    await resourceTitle.focus();
    await expect(resourceTitle).toBeFocused();

    await page.goto(
      `/servers/${process.env.NEXUS_CLAIM_BROWSER_SERVER_SLUG}`,
    );
    const claimButton = page.getByRole("button", {
      name: dictionary.serverClaim.create,
      exact: true,
    });
    await claimButton.focus();
    await expect(claimButton).toBeFocused();
    await expect(
      page.getByText(dictionary.serverClaim.exactEndpoint, { exact: true }),
    ).toBeVisible();

    assert.deepEqual(errors, []);
    await logoutFixture(page);
    evidence.push(
      `${locale}: authenticated Settings, Security Center, Support, Publish and unowned Server Claim pass labeled-field, ARIA-IDREF, 24x24 target-size, landmark/heading structure, focus, reduced-motion and 320/390/1280 reflow acceptance`,
    );
  });
}
