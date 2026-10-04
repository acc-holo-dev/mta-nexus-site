import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
const require = createRequire(join(resolve(process.env.NEXUS_BROWSER_TOOLS), "package.json"));
const { test, expect } = require("@playwright/test");

test("registration, authenticated workspace and logout on the production image", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const nonce = randomBytes(6).toString("hex");
  await page.goto("/auth/register");
  await page.getByLabel("Email address", { exact: true }).fill(`smoke-${nonce}@example.invalid`);
  await page.getByLabel("Username", { exact: true }).fill(`smoke_${nonce}`);
  await page.getByLabel("Password", { exact: true }).fill(`Ci-${randomBytes(24).toString("hex")}`);
  const registered = page.waitForResponse(response => response.url().endsWith("/api/auth/register") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  assert.equal((await registered).status(), 201);
  await expect(page.getByRole("heading", { name: "Workspace", exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: "Account", exact: true })).toContainText(`@smoke_${nonce}`);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.goto("/workspace");
  await expect(page.getByRole("heading", { name: "Sign in required", exact: true })).toBeVisible();
  assert.deepEqual(errors, []);
});
