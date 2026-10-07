import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { getDictionary } from "../../apps/web/src/lib/i18n.ts";

assert.equal(process.env.GITHUB_ACTIONS, "true");
assert.equal(process.env.RUNNER_ENVIRONMENT, "github-hosted");
assert(process.env.NEXUS_BROWSER_TOOLS);

const require = createRequire(
  join(resolve(process.env.NEXUS_BROWSER_TOOLS), "package.json"),
);
const { chromium } = require("@playwright/test");

const dictionary = getDictionary("en");
const origins = [
  { name: "localhost", url: "http://localhost:3000" },
  { name: "compose service hostname", url: "http://app:3000" },
];

const browser = await chromium.launch({
  headless: true,
  args: ["--host-resolver-rules=MAP app 127.0.0.1"],
});

try {
  for (const origin of origins) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    const response = await page.goto(`${origin.url}/auth/login`, {
      waitUntil: "domcontentloaded",
    });
    assert.equal(response?.status(), 200, `${origin.name}: login route status`);

    const themeToggle = page.getByRole("button", {
      name: dictionary.theme.switchToLight,
      exact: true,
    });
    await themeToggle.click();
    await page.waitForFunction(
      () =>
        localStorage.getItem("nexus-theme") === "light" &&
        !document.documentElement.classList.contains("dark"),
    );

    await page.getByLabel(dictionary.auth.email, { exact: true }).fill(
      "dev-origin-check@example.invalid",
    );
    await page.getByLabel(dictionary.auth.password, { exact: true }).fill(
      "not-the-right-password",
    );

    const loginResponsePromise = page.waitForResponse(
      (candidate) =>
        candidate.url() === `${origin.url}/api/auth/login` &&
        candidate.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: dictionary.auth.signIn, exact: true })
      .click();
    const loginResponse = await loginResponsePromise;
    assert(
      [400, 401, 403].includes(loginResponse.status()),
      `${origin.name}: invalid login should be rejected by the API`,
    );
    await page.getByRole("alert").waitFor({ state: "visible" });
    assert.equal(
      new URL(page.url()).pathname,
      "/auth/login",
      `${origin.name}: hydrated form must not degrade to native GET navigation`,
    );
    assert.deepEqual(
      pageErrors,
      [],
      `${origin.name}: unexpected browser errors during hydration check`,
    );

    await context.close();
    process.stdout.write(
      `PASS: ${origin.name} hydrated theme + client-side login POST\n`,
    );
  }
} finally {
  await browser.close();
}
