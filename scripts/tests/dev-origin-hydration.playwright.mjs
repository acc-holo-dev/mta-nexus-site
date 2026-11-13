import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
// Register before any i18n import: static ESM links resolve before hooks run.
import "../register-ts-directory-resolve.mjs";

assert.equal(process.env.GITHUB_ACTIONS, "true");
assert.equal(process.env.RUNNER_ENVIRONMENT, "github-hosted");
assert(process.env.NEXUS_BROWSER_TOOLS);

const require = createRequire(join(resolve(process.env.NEXUS_BROWSER_TOOLS), "package.json"));
const { chromium } = require("@playwright/test");
const { getDictionary } = await import("../../site/src/lib/i18n.ts");

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

    await page.waitForFunction(
      () => document.querySelector("[data-theme-toggle]")?.getAttribute("data-hydrated") === "true",
    );
    await page
      .getByRole("button", {
        name: dictionary.theme.switchToLight,
        exact: true,
      })
      .click();
    await page.waitForFunction(
      () =>
        localStorage.getItem("nexus-theme") === "light" &&
        !document.documentElement.classList.contains("dark"),
    );

    await page
      .getByRole("button", {
        name: dictionary.theme.switchToDark,
        exact: true,
      })
      .click();
    await page.waitForFunction(
      () =>
        localStorage.getItem("nexus-theme") === "dark" &&
        document.documentElement.classList.contains("dark"),
    );

    await page
      .getByRole("button", {
        name: dictionary.theme.useSystem,
        exact: true,
      })
      .click();
    await page.waitForFunction(() => localStorage.getItem("nexus-theme") === "system");

    await page.emulateMedia({ colorScheme: "dark" });
    await page.waitForFunction(() => document.documentElement.classList.contains("dark"));
    await page.emulateMedia({ colorScheme: "light" });
    await page.waitForFunction(() => !document.documentElement.classList.contains("dark"));

    await page
      .getByLabel(dictionary.auth.email, { exact: true })
      .fill("dev-origin-check@example.invalid");
    await page.getByLabel(dictionary.auth.password, { exact: true }).fill("not-the-right-password");

    const loginResponsePromise = page.waitForResponse(
      (candidate) =>
        candidate.url() === `${origin.url}/api/auth/login` &&
        candidate.request().method() === "POST",
    );
    await page.getByRole("button", { name: dictionary.auth.signIn, exact: true }).click();
    const loginResponse = await loginResponsePromise;
    assert(
      [400, 401, 403].includes(loginResponse.status()),
      `${origin.name}: invalid login should be rejected by the API`,
    );
    await page.locator("#auth-error").waitFor({ state: "visible" });
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
    process.stdout.write(`PASS: ${origin.name} hydrated theme + client-side login POST\n`);
  }

  const cssFile = new URL("../../site/src/app/globals.css", import.meta.url);
  const originalCss = readFileSync(cssFile);
  const context = await browser.newContext();
  try {
    writeFileSync(
      cssFile,
      Buffer.concat([originalCss, Buffer.from('\n:root { --nexus-infra-hmr-probe: "alpha"; }\n')]),
    );
    const page = await context.newPage();
    const socketReady = page
      .waitForEvent("websocket", { timeout: 30_000 })
      .then((socket) => socket.waitForEvent("framereceived", { timeout: 30_000 }));
    await page.goto("http://localhost:3000/auth/login", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => document.querySelector("[data-theme-toggle]")?.getAttribute("data-hydrated") === "true",
    );
    await socketReady;
    const waitForProbe = (value) =>
      page.waitForFunction(
        (expected) =>
          getComputedStyle(document.documentElement)
            .getPropertyValue("--nexus-infra-hmr-probe")
            .includes(expected),
        value,
        { timeout: 45_000 },
      );
    await waitForProbe("alpha");
    writeFileSync(
      cssFile,
      Buffer.concat([originalCss, Buffer.from('\n:root { --nexus-infra-hmr-probe: "beta"; }\n')]),
    );
    await waitForProbe("beta");
    writeFileSync(cssFile, originalCss);
    await page.waitForFunction(
      () =>
        getComputedStyle(document.documentElement)
          .getPropertyValue("--nexus-infra-hmr-probe")
          .trim() === "",
      null,
      { timeout: 45_000 },
    );
    process.stdout.write(
      "PASS: read-only site/src bind delivers CSS hot reload alpha → beta → restored\n",
    );
  } finally {
    writeFileSync(cssFile, originalCss);
    assert.deepEqual(readFileSync(cssFile), originalCss);
    await context.close();
  }
} finally {
  await browser.close();
}
