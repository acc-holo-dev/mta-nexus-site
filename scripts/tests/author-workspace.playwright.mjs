import assert from "node:assert/strict";
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { randomBytes, createHash } from "node:crypto";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
assert.equal(process.env.GITHUB_ACTIONS, "true");
assert.equal(process.env.RUNNER_ENVIRONMENT, "github-hosted");
assert.equal(process.env.NEXUS_BROWSER_BASE_URL, "https://nexus-ci.test:8443");
assert(process.env.NEXUS_AUTHOR_BROWSER_EMAIL);
assert(process.env.NEXUS_MODERATOR_BROWSER_EMAIL);
assert(process.env.NEXUS_AUTHOR_BROWSER_PASSWORD);
const require = createRequire(join(resolve(process.env.NEXUS_BROWSER_TOOLS), "package.json"));
const { test, expect } = require("@playwright/test");
const evidence = [];
test.afterAll(async () => {
  const directory = resolve(process.env.NEXUS_BROWSER_REPORT_DIR);
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "author-results.json"), JSON.stringify({ commit: process.env.GITHUB_SHA, results: evidence,
    coverage: "Real author UI, authenticated API moderation, real PostgreSQL, storage and ClamAV; no external mail delivery." }, null, 2));
  await writeFile(join(directory, "author-summary.md"), ["# Author workspace acceptance", "", ...evidence.map((item) => `- PASS: ${item}`), ""].join("\n"));
});

async function login(page, email) {
  await page.goto("/auth/login");
  const status = await page.evaluate(async (account) => {
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(account) });
    return response.status;
  }, { email, password: process.env.NEXUS_AUTHOR_BROWSER_PASSWORD });
  assert.equal(status, 200);
}
async function moderate(page, buildId, action, notes) {
  const result = await page.evaluate(async (body) => {
    const response = await fetch("/api/admin/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }, { targetType: "build", targetId: buildId, action, notes });
  assert.equal(result.status, 200, JSON.stringify(result.body));
}

test("author creates, edits, submits versions, reads moderation and retires a publication", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const nonce = randomBytes(6).toString("hex");
  const slug = `author-cabinet-${nonce}`;
  const title = `Author resource ${nonce}`;
  const file = Buffer.from('-- Real clean Lua author acceptance fixture\noutputDebugString("NEXUS author workspace")\n');
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await login(page, process.env.NEXUS_AUTHOR_BROWSER_EMAIL);
  await page.goto("/workspace/resources/new");
  await page.locator('[name="title"]').fill(title);
  await page.locator('[name="slug"]').fill(slug);
  await page.getByLabel("Description", { exact: true }).fill("A complete author workspace acceptance resource description.");
  await page.locator('[name="version"]').fill("1.0.0");
  await page.locator('[name="file"]').setInputFiles({ name: "author.lua", mimeType: "text/plain", buffer: file });
  const created = page.waitForResponse((response) => response.url().endsWith("/api/products") && response.request().method() === "POST");
  const firstBuild = page.waitForResponse((response) => /\/api\/products\/[^/]+\/builds$/u.test(new URL(response.url()).pathname) && response.request().method() === "POST");
  await page.getByRole("button", { name: "Submit free resource for review", exact: true }).click();
  const createResponse = await created;
  assert.equal(createResponse.status(), 201);
  const { product } = await createResponse.json();
  const buildResponse = await firstBuild;
  assert.equal(buildResponse.status(), 201);
  const { build } = await buildResponse.json();
  assert.equal(build.scanStatus, "clean"); assert(build.scanner); assert(build.scannedAt);
  assert.equal(build.status, "pending_review");
  evidence.push("Author created a resource and submitted a real clean-scanned private build.");
  await page.getByRole("link", { name: "My resources", exact: true }).click();
  await page.getByRole("link", { name: title, exact: true }).click();
  const details = page.getByRole("form", { name: "Resource details", exact: true });
  const updated = `${title} edited`;
  await details.getByLabel("Title", { exact: true }).fill(updated);
  await details.getByRole("button", { name: "Save details", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Details saved." })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: updated, exact: true })).toBeVisible();

  evidence.push("Metadata edits survived reload.");

  // An unrelated author has neither a private page nor mutation access.
  const outsiderContext = await browser.newContext({ baseURL: process.env.NEXUS_BROWSER_BASE_URL });
  const outsider = await outsiderContext.newPage();
  await outsider.goto(process.env.NEXUS_BROWSER_BASE_URL);
  const denied = await outsider.evaluate(async (id) => (await fetch(`/api/products/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{}" })).status, product.id);
  assert.equal(denied, 401);
  await login(outsider, process.env.NEXUS_MODERATOR_BROWSER_EMAIL);
  const outsiderResponse = await outsider.goto(`${process.env.NEXUS_BROWSER_BASE_URL}/workspace/resources/${product.id}`);
  // Next streams the loading shell before notFound(), so the document can be 200.
  assert([200, 404].includes(outsiderResponse.status()));
  await expect(outsider.getByRole("heading", { name: "Page not found", exact: true })).toBeVisible();
  await expect(outsider.getByRole("heading", { name: updated, exact: true })).toHaveCount(0);
  await expect(outsider.getByRole("form", { name: "Resource details", exact: true })).toHaveCount(0);
  await expect(outsider.getByRole("form", { name: "Submit a new version", exact: true })).toHaveCount(0);
  const forbidden = await outsider.evaluate(async (id) => (await fetch(`/api/products/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{}" })).status, product.id);
  assert.equal(forbidden, 404);
  evidence.push("Unauthenticated and unrelated moderator access denied.");
  await moderate(outsider, build.id, "approve", "Approved author acceptance version one.");
  await page.reload();
  await expect(page.getByText("Approved author acceptance version one.", { exact: true })).toBeVisible();
  await expect(page.getByText("Published · 1.0.0", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Open resource preview", exact: true }).click();
  await expect(page.getByRole("heading", { name: updated, exact: true })).toBeVisible();
  await outsider.goto(`/market/${slug}`);
  await outsider.getByRole("link", { name: "Add to library", exact: true }).click();
  await outsider.getByRole("button", { name: "Add to library", exact: true }).click();
  await expect(outsider.getByRole("heading", { name: "Resource added", exact: true })).toBeVisible();
  await outsider.getByRole("link", { name: "Open resource", exact: true }).click();
  const downloadPromise = outsider.waitForEvent("download");
  await outsider.getByRole("button", { name: "Download Build v1.0.0", exact: true }).click();
  const download = await downloadPromise;
  assert.equal(await download.failure(), null);
  const downloadedPath = await download.path();
  assert.deepEqual(await readFile(downloadedPath), file);
  await rm(downloadedPath);
  evidence.push("The newly published author resource was claimed and downloaded with exact uploaded bytes.");
  evidence.push("Moderator approval notes appeared in the author workspace and the public resource opened.");
  await page.goto(`/workspace/resources/${product.id}`);
  const upload = page.getByRole("form", { name: "Submit a new version", exact: true });
  await upload.getByLabel("Version", { exact: true }).fill("1.1.0");
  await upload.getByLabel("Release notes", { exact: true }).fill("Second acceptance version.");
  await upload.locator('[name="file"]').setInputFiles({ name: "author.lua", mimeType: "text/plain", buffer: file });
  const secondResponse = page.waitForResponse((response) => response.url().endsWith(`/api/products/${product.id}/builds`) && response.request().method() === "POST");
  await upload.getByRole("button", { name: "Submit a new version", exact: true }).click();
  const submittedResponse = await secondResponse;
  assert.equal(submittedResponse.status(), 201);
  const second = (await submittedResponse.json()).build;
  await expect(page.getByText("Version submitted for scanning and moderator review.", { exact: true })).toBeVisible();
  await moderate(outsider, second.id, "reject", "Rejected second version: update the manifest.");
  await page.getByRole("button", { name: "Language", exact: true }).click();
  await page.reload();
  await expect(page.getByText("Rejected second version: update the manifest.", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "История версий", exact: true })).toBeVisible();
  await expect(page.getByText("Опубликован · 1.0.0", { exact: true })).toBeVisible();
  evidence.push("Second version rejection preserved the previous public version and exposed notes in RU.");
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  const publishedRow = page.locator("li").filter({ has: page.getByRole("heading", { name: "1.0.0", exact: true }) });
  await publishedRow.locator("summary").click();
  await publishedRow.getByLabel("Причина снятия", { exact: true }).fill("Retire acceptance publication.");
  await publishedRow.getByRole("button", { name: "Снять версию с публикации", exact: true }).click();
  await expect(publishedRow.getByText("Снята с публикации", { exact: false }).first()).toBeVisible();
  await expect(page.getByText("Retire acceptance publication.", { exact: true })).toBeVisible();
  const publicProduct = await outsider.evaluate(async (id) => (await fetch(`/api/products/${id}`)).status, product.id);
  assert.equal(publicProduct, 404);
  evidence.push("Mobile layout fits at 390px; retirement removed the final public build from public API.");
  await outsiderContext.close();
  assert.deepEqual(errors, []);
  assert.equal(createHash("sha256").update(file).digest("hex"), build.sha256Hash);
});
