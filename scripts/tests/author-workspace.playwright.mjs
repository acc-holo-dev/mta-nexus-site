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
async function logout(page) {
  const status = await page.evaluate(async () => (await fetch("/api/auth/session", { method: "DELETE" })).status);
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
  test.setTimeout(180_000);
  const nonce = randomBytes(6).toString("hex");
  const slug = `author-cabinet-${nonce}`;
  const title = `Author resource ${nonce}`;
  const file = Buffer.from('-- Real clean Lua author acceptance fixture\noutputDebugString("NEXUS author workspace")\n');
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", async (dialog) => {
    if (dialog.type() === "beforeunload") await dialog.accept();
    else {
      errors.push(`Unexpected ${dialog.type()} dialog: ${dialog.message()}`);
      await dialog.dismiss();
    }
  });
  await login(page, process.env.NEXUS_AUTHOR_BROWSER_EMAIL);
  const creatingActorId = await page.evaluate(async () => (await (await fetch("/api/auth/session")).json()).user.id);
  const pendingCreationKey = `nexus:pending-resource-draft:v2:${encodeURIComponent(creatingActorId)}`;
  await page.goto("/workspace/resources/new");
  await page.locator('[name="title"]').fill(title);
  await page.locator('[name="slug"]').fill(slug);
  await page.getByLabel("Description", { exact: true }).fill("A complete author workspace acceptance resource description.");
  await page.locator('[name="version"]').fill("1.0.0");
  const firstNotes = "First acceptance version, retained after an invalid response.";
  await page.locator('[name="releaseNotes"]').fill(firstNotes);
  let productCreates = 0;
  page.on("request", request => {
    if (new URL(request.url()).pathname === "/api/products" && request.method() === "POST") productCreates += 1;
  });
  const pendingBuildUrl = /\/api\/products\/[^/]+\/builds$/u;
  const invalidFirstBuild = async route => {
    assert.equal(route.request().method(), "POST");
    await route.fulfill({ status: 201, contentType: "application/json", body: "{}" });
  };
  await page.route(pendingBuildUrl, invalidFirstBuild);
  await page.locator('[name="file"]').setInputFiles({ name: "author.lua", mimeType: "text/plain", buffer: file });
  const created = page.waitForResponse((response) => response.url().endsWith("/api/products") && response.request().method() === "POST");
  const failedFirstBuild = page.waitForResponse((response) => pendingBuildUrl.test(new URL(response.url()).pathname) && response.request().method() === "POST");
  await page.getByRole("button", { name: "Submit free resource for review", exact: true }).click();
  const createResponse = await created;
  assert.equal(createResponse.status(), 201);
  const { product } = await createResponse.json();
  assert.equal((await failedFirstBuild).status(), 201);
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Resource submitted for review", exact: true })).toHaveCount(0);
  await expect(page.locator('[name="version"]')).toHaveValue("1.0.0");
  await expect(page.locator('[name="releaseNotes"]')).toHaveValue(firstNotes);
  assert.equal(await page.locator('[name="file"]').evaluate(input => input.files?.[0]?.name), "author.lua");
  assert.equal(productCreates, 1);
  await expect.poll(() => page.evaluate(key => JSON.parse(sessionStorage.getItem(key) ?? "null")?.id, pendingCreationKey)).toBe(product.id);
  await page.unroute(pendingBuildUrl, invalidFirstBuild);

  // Account switching keeps the owner's recoverable identity private in the same tab.
  await logout(page);
  await login(page, process.env.NEXUS_MODERATOR_BROWSER_EMAIL);
  await page.goto("/workspace/resources/new");
  await expect(page.getByRole("button", { name: "Submit free resource for review", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Retry build submission", exact: true })).toHaveCount(0);
  await expect(page.getByText(new RegExp(slug, "u"))).toHaveCount(0);
  assert.equal(await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)).actorId, pendingCreationKey), creatingActorId);
  await logout(page);
  await login(page, process.env.NEXUS_AUTHOR_BROWSER_EMAIL);
  await page.goto("/workspace/resources/new");
  const retry = page.getByRole("button", { name: "Retry build submission", exact: true });
  await expect(retry).toBeEnabled();
  await expect(page.getByRole("status").filter({ hasText: slug })).toBeVisible();
  assert.equal(await page.locator('[name="file"]').evaluate(input => input.files?.length), 0);
  // Browsers cannot restore a selected archive after navigation; reselect explicitly.
  await page.locator('[name="version"]').fill("1.0.0");
  await page.locator('[name="releaseNotes"]').fill(firstNotes);
  await page.locator('[name="file"]').setInputFiles({ name: "author.lua", mimeType: "text/plain", buffer: file });
  const initialBuildUrl = `${process.env.NEXUS_BROWSER_BASE_URL}/api/products/${product.id}/builds`;
  const wrongProductBuild = async route => {
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({
      build: { id: "bld_foreign", productId: "prd_foreign", version: "1.0.0", status: "pending_review" },
    }) });
  };
  await page.route(initialBuildUrl, wrongProductBuild);
  try {
    const failed = page.waitForResponse(response => response.url() === initialBuildUrl && response.request().method() === "POST");
    await retry.click();
    assert.equal((await failed).status(), 201);
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(retry).toBeEnabled();
    await expect(page.locator('[name="version"]')).toHaveValue("1.0.0");
    await expect(page.locator('[name="releaseNotes"]')).toHaveValue(firstNotes);
    assert.equal(await page.locator('[name="file"]').evaluate(input => input.files?.[0]?.name), "author.lua");
    await expect(page.getByRole("heading", { name: "Resource submitted for review", exact: true })).toHaveCount(0);
    assert.equal(productCreates, 1);
  } finally { await page.unroute(initialBuildUrl, wrongProductBuild); }
  await page.reload();
  await expect(retry).toBeEnabled();
  await expect(page.getByRole("status").filter({ hasText: slug })).toBeVisible();
  assert.equal(await page.locator('[name="file"]').evaluate(input => input.files?.length), 0);
  await page.locator('[name="version"]').fill("1.0.0");
  await page.locator('[name="releaseNotes"]').fill(firstNotes);
  await page.locator('[name="file"]').setInputFiles({ name: "author.lua", mimeType: "text/plain", buffer: file });
  const firstBuild = page.waitForResponse(response => response.url() === initialBuildUrl && response.request().method() === "POST");
  await retry.click();
  const buildResponse = await firstBuild;
  assert.equal(buildResponse.status(), 201);
  const { build } = await buildResponse.json();
  assert.equal(productCreates, 1);
  const resourceStatus = page.getByRole("link", { name: "Open resource status", exact: true });
  await expect(resourceStatus).toHaveAttribute("href", `/workspace/resources/${product.id}`);
  assert.equal(await page.evaluate(key => sessionStorage.getItem(key), pendingCreationKey), null);
  await resourceStatus.click();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await expect(page.getByRole("form", { name: "Resource details", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Page not found", exact: true })).toHaveCount(0);
  evidence.push("Initial submission rejected empty and foreign-product 201 replies without losing the selected archive or creating duplicate resources; reload restored the owner's pending identity and another account could not recover it in the same tab.");
  assert.equal(build.scanStatus, "clean"); assert(build.scanner); assert(build.scannedAt);
  assert.equal(build.status, "pending_review");
  evidence.push("Author created a resource and submitted a real clean-scanned private build.");
  const details = page.getByRole("form", { name: "Resource details", exact: true });
  const updated = `${title} edited`;
  const uploadDraft = page.getByRole("form", { name: "Submit a new version", exact: true });
  const notes = "Second acceptance version.";
  const dirtyNotice = page.getByText("There are changes you have not submitted yet.", { exact: true });
  const restoredNotice = page.getByText("Your unfinished text has been restored in this tab.", { exact: true });
  const actorId = await page.evaluate(async () => (await (await fetch("/api/auth/session")).json()).user.id);
  const draftKey = `nexus:author-resource-draft:v1:${encodeURIComponent(actorId)}:${encodeURIComponent(product.id)}`;
  await details.getByLabel("Title", { exact: true }).fill(updated);
  await uploadDraft.getByLabel("Version", { exact: true }).fill("1.1.0");
  await uploadDraft.getByLabel("Release notes", { exact: true }).fill(notes);
  await expect(dirtyNotice).toBeVisible();
  await expect.poll(() => page.evaluate(key => JSON.parse(sessionStorage.getItem(key) ?? "null")?.version.version, draftKey)).toBe("1.1.0");
  const foreignKeys = await page.evaluate(({ key, actorId, productId }) => {
    const current = JSON.parse(sessionStorage.getItem(key));
    const foreign = [
      { ...current, actorId: `${actorId}-foreign`, details: { ...current.details, title: "Foreign actor sentinel" } },
      { ...current, productId: `${productId}-foreign`, details: { ...current.details, title: "Foreign product sentinel" } },
    ];
    return foreign.map(value => {
      const foreignKey = `nexus:author-resource-draft:v1:${encodeURIComponent(value.actorId)}:${encodeURIComponent(value.productId)}`;
      sessionStorage.setItem(foreignKey, JSON.stringify(value));
      return foreignKey;
    });
  }, { key: draftKey, actorId, productId: product.id });

  const metadataUrl = `${process.env.NEXUS_BROWSER_BASE_URL}/api/products/${product.id}`;
  for (const injected of [
    { status: 500, body: JSON.stringify({ code: "INTERNAL_ERROR" }) },
    { status: 200, body: "null" },
    { status: 200, body: "" },
    { status: 200, body: JSON.stringify({ product: { ...product, id: "prd_foreign", title: updated } }) },
  ]) {
    const handler = async route => {
      assert.equal(route.request().method(), "PATCH");
      await route.fulfill({ ...injected, contentType: "application/json" });
    };
    await page.route(metadataUrl, handler);
    try {
      const completed = page.waitForResponse(response => response.url() === metadataUrl && response.request().method() === "PATCH");
      await details.getByRole("button", { name: "Save details", exact: true }).click();
      await completed;
      await expect(details.getByRole("button", { name: "Save details", exact: true })).toBeEnabled();
      await expect(details.getByRole("alert")).toBeVisible();
      await expect(details.getByLabel("Title", { exact: true })).toHaveValue(updated);
      await expect(dirtyNotice).toBeVisible();
      await expect(details.getByRole("status")).toHaveCount(0);
      await expect(uploadDraft.getByLabel("Version", { exact: true })).toHaveValue("1.1.0");
    } finally { await page.unroute(metadataUrl, handler); }
  }
  await page.reload();
  await expect(restoredNotice).toBeVisible();
  await expect(details.getByLabel("Title", { exact: true })).toHaveValue(updated);
  await expect(details.getByLabel("Description", { exact: true })).toHaveValue(product.description);
  await expect(uploadDraft.getByLabel("Release notes", { exact: true })).toHaveValue(notes);
  await expect(page.getByText("Foreign actor sentinel", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Foreign product sentinel", { exact: true })).toHaveCount(0);

  // Another authenticated client changes this same resource after our draft.
  const draftRevision = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)).baseUpdatedAt, draftKey);
  const concurrentTitle = `${title} changed elsewhere`;
  const concurrent = await page.evaluate(async ({ id, title, original }) => {
    const response = await fetch(`/api/products/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, shortDescription: original.shortDescription ?? "",
        description: original.description, tags: original.tags ?? [] }),
    });
    return { status: response.status, body: await response.json() };
  }, { id: product.id, title: concurrentTitle, original: product });
  assert.equal(concurrent.status, 200, JSON.stringify(concurrent.body));
  assert.equal(concurrent.body.product.title, concurrentTitle);
  const staleResponse = page.waitForResponse(response => response.url() === metadataUrl && response.request().method() === "PATCH");
  await details.getByRole("button", { name: "Save details", exact: true }).click();
  const stale = await staleResponse;
  assert.equal(stale.status(), 409);
  assert.equal((await stale.json()).code, "PRODUCT_METADATA_CONFLICT");
  assert.equal(stale.request().headers()["if-match"], JSON.stringify(new Date(draftRevision).toISOString()));
  await expect(page.getByRole("heading", { name: concurrentTitle, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Restore draft", exact: true })).toBeVisible();
  await expect(details.getByLabel("Title", { exact: true })).toBeDisabled();
  await expect(uploadDraft.getByLabel("Version", { exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Restore draft", exact: true }).click();
  await expect(details.getByLabel("Title", { exact: true })).toHaveValue(updated);
  await expect(uploadDraft.getByLabel("Version", { exact: true })).toHaveValue("1.1.0");
  await details.getByRole("button", { name: "Save details", exact: true }).click();
  await expect(details.getByRole("status").filter({ hasText: "Details saved." })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: updated, exact: true })).toBeVisible();
  await expect(restoredNotice).toBeVisible();
  await expect(uploadDraft.getByLabel("Version", { exact: true })).toHaveValue("1.1.0");
  await expect(uploadDraft.getByLabel("Release notes", { exact: true })).toHaveValue(notes);
  assert(await page.evaluate(keys => keys.every(key => sessionStorage.getItem(key) !== null), foreignKeys));
  evidence.push("Failed or malformed metadata responses preserved both forms; scoped text restored after reload and a real stale-revision save returned 409 without overwriting the concurrent edit, requiring an explicit restore decision.");
  evidence.push("Metadata edits survived reload without clearing the pending version or foreign actor/resource drafts.");

  async function restorePendingDraft() {
    const restore = page.getByRole("button", { name: "Restore draft", exact: true });
    const titleInput = details.getByLabel("Title", { exact: true });
    await expect.poll(async () => await restore.isVisible() || await titleInput.isEnabled()).toBe(true);
    if (await restore.isVisible()) await restore.click();
  }

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
  const repeated = await outsider.evaluate(async (buildId) => (await fetch("/api/admin/actions", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetType: "build", targetId: buildId, action: "approve", notes: "Repeat approval" }),
  })).status, build.id);
  assert.equal(repeated, 409);
  await page.goto("/notifications");
  const approvalCard = page.locator("article").filter({ has: page.getByRole("heading", { name: "Resource version approved", exact: true }) });
  await expect(approvalCard).toBeVisible();
  await expect(approvalCard.getByText(/Moderator comment: Approved author acceptance version one\./u)).toBeVisible();
  const approvalNotices = await page.evaluate(async () => (await (await fetch("/api/notifications")).json()).notifications);
  assert.equal(approvalNotices.filter((notice) => notice.data?.kind === "build_review").length, 1);
  await approvalCard.getByRole("link", { name: "View", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/workspace/resources/${product.id}$`, "u"));
  await restorePendingDraft();
  evidence.push("Approval delivered one localized author notification with notes and a working resource link; replay returned 409.");
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
  await restorePendingDraft();
  const upload = page.getByRole("form", { name: "Submit a new version", exact: true });
  await expect(upload.getByLabel("Version", { exact: true })).toHaveValue("1.1.0");
  await expect(upload.getByLabel("Release notes", { exact: true })).toHaveValue(notes);
  await upload.locator('[name="file"]').setInputFiles({ name: "author.lua", mimeType: "text/plain", buffer: file });
  const buildsUrl = `${metadataUrl}/builds`;
  for (const body of [
    {},
    { build: { id: "bld_foreign", productId: "prd_foreign", version: "1.1.0", status: "pending_review" } },
  ]) {
    const handler = async route => {
      assert.equal(route.request().method(), "POST");
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify(body) });
    };
    await page.route(buildsUrl, handler);
    try {
      const completed = page.waitForResponse(response => response.url() === buildsUrl && response.request().method() === "POST");
      await upload.getByRole("button", { name: "Submit a new version", exact: true }).click();
      await completed;
      await expect(upload.getByRole("button", { name: "Submit a new version", exact: true })).toBeEnabled();
      await expect(upload.getByRole("alert")).toBeVisible();
      await expect(upload.getByLabel("Version", { exact: true })).toHaveValue("1.1.0");
      await expect(upload.getByLabel("Release notes", { exact: true })).toHaveValue(notes);
      assert.deepEqual(await upload.locator('[name="file"]').evaluate(input => Array.from(input.files, item => ({ name: item.name, size: item.size }))), [{ name: "author.lua", size: file.length }]);
      await expect(upload.getByRole("status")).toHaveCount(0);
      await expect(dirtyNotice).toBeVisible();
    } finally { await page.unroute(buildsUrl, handler); }
  }
  await page.reload();
  await restorePendingDraft();
  await expect(upload.getByLabel("Version", { exact: true })).toHaveValue("1.1.0");
  await expect(upload.getByLabel("Release notes", { exact: true })).toHaveValue(notes);
  assert.equal(await upload.locator('[name="file"]').evaluate(input => input.files.length), 0);
  await expect(page.getByText("Only text is restored. After reopening this page, select the archive again. Text remains in this tab for up to 24 hours.", { exact: true })).toBeVisible();
  await upload.locator('[name="file"]').setInputFiles({ name: "author.lua", mimeType: "text/plain", buffer: file });
  evidence.push("Malformed or mismatched upload confirmations preserved the selected file and version text; reload restored only text and required archive reselection.");
  const secondResponse = page.waitForResponse((response) => response.url().endsWith(`/api/products/${product.id}/builds`) && response.request().method() === "POST");
  await upload.getByRole("button", { name: "Submit a new version", exact: true }).click();
  const submittedResponse = await secondResponse;
  assert.equal(submittedResponse.status(), 201);
  const second = (await submittedResponse.json()).build;
  await expect(page.getByText("Version submitted for scanning and moderator review.", { exact: true })).toBeVisible();
  await expect(upload.getByLabel("Version", { exact: true })).toHaveValue("");
  await expect(upload.getByLabel("Release notes", { exact: true })).toHaveValue("");
  assert.equal(await upload.locator('[name="file"]').evaluate(input => input.files.length), 0);
  await expect.poll(() => page.evaluate(key => sessionStorage.getItem(key), draftKey)).toBe(null);
  assert(await page.evaluate(keys => keys.every(key => sessionStorage.getItem(key) !== null), foreignKeys));
  evidence.push("A genuine upload cleared its own submitted draft and file while preserving unrelated scoped drafts.");
  await moderate(outsider, second.id, "reject", "Rejected second version: update the manifest.");
  await page.goto("/notifications");
  await expect(page.getByRole("heading", { name: "Resource version rejected", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mark all as read", exact: true }).click();
  await expect.poll(async () => page.evaluate(async () => (await (await fetch("/api/notifications")).json()).unreadCount)).toBe(0);
  await page.getByRole("button", { name: "Language", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Версия ресурса одобрена", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Версия ресурса отклонена", exact: true })).toBeVisible();
  const rejectionCard = page.locator("article").filter({ has: page.getByRole("heading", { name: "Версия ресурса отклонена", exact: true }) });
  await expect(rejectionCard.getByText(/Комментарий модератора: Rejected second version/u)).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await rejectionCard.getByRole("link", { name: "Открыть", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/workspace/resources/${product.id}$`, "u"));
  evidence.push("Approval/rejection notifications localized to RU, fit mobile width and marked as read without losing history.");
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
