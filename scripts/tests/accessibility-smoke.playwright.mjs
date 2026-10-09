import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { getDictionary } from "../../apps/web/src/lib/i18n.ts";
import { assertAxeAccessibility } from "../axe-accessibility.mjs";

const require = createRequire(join(resolve(process.env.NEXUS_BROWSER_TOOLS), "package.json"));
const { test, expect } = require("@playwright/test");

for (const locale of ["en", "ru"]) {
  for (const theme of ["light", "dark"]) {
    test(`guest account accessibility in ${locale}, ${theme}`, async ({ page, context }, testInfo) => {
      const dictionary = getDictionary(locale);
      await context.addCookies([{
        name: "nexus_locale", value: locale, url: process.env.NEXUS_BROWSER_BASE_URL,
        secure: true, sameSite: "Lax",
      }]);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width: theme === "dark" ? 390 : 1280, height: 844 });
      const routes = [
        ["/auth/login", dictionary.auth.loginTitle],
        ["/auth/register", dictionary.auth.registerTitle],
        ["/auth/forgot-password", dictionary.recovery.forgotTitle],
      ];
      for (const [route, heading] of routes) {
        const response = await page.goto(route);
        expect(response?.status()).toBe(200);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(page.getByRole("main").getByRole("heading", { level: 1, name: heading, exact: true })).toBeVisible();
        await expect(page.locator("html")).toHaveClass(theme === "dark" ? /\bdark\b/u : /^(?!.*\bdark\b)/u);
        await assertAxeAccessibility(page, testInfo, `${locale}-${theme}-${route}`);
      }
    });
  }
}
