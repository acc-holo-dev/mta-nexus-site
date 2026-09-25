import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

assert.equal(process.env.GITHUB_ACTIONS, 'true');
assert.equal(process.env.RUNNER_ENVIRONMENT, 'github-hosted');
const baseURL = process.env.NEXUS_BROWSER_BASE_URL;
assert.equal(baseURL, 'https://nexus-ci.test:8443');
const require = createRequire(join(resolve(process.env.NEXUS_BROWSER_TOOLS), 'package.json'));
const { chromium } = require('@playwright/test');
const output = resolve(process.env.NEXUS_BROWSER_REPORT_DIR);

test('J2-11 private profile is absent from public HTML and metadata; public/unlisted remain reachable', { timeout: 120_000 }, async () => {
  const browser = await chromium.launch({
    headless: true, args: ['--host-resolver-rules=MAP nexus-ci.test 127.0.0.1'],
    env: { ...process.env, HOME: process.env.NEXUS_BROWSER_HOME },
  });
  const ownerContext = await browser.newContext({ baseURL, ignoreHTTPSErrors: false });
  const guestContext = await browser.newContext({ baseURL, ignoreHTTPSErrors: false });
  const owner = await ownerContext.newPage();
  const guest = await guestContext.newPage();
  const phases = [];
  let status = 'FAIL';
  const send = (page, path, method = 'GET', body) => page.evaluate(async ({ path, method, body }) => {
    const response = await fetch(path, {
      method, cache: 'no-store', credentials: 'same-origin',
      ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    });
    const text = await response.text();
    let data = null;
    try { data = JSON.parse(text); } catch { /* Public page is HTML. */ }
    return { status: response.status, data, text };
  }, { path, method, body });
  try {
    await owner.goto('/auth/login');
    await guest.goto('/auth/login');
    const nonce = randomBytes(6).toString('hex');
    const user = await send(owner, '/api/auth/register', 'POST', {
      email: `boundary-${nonce}@example.invalid`, username: `boundary_${nonce}`,
      password: `Ci-${randomBytes(24).toString('hex')}`,
    });
    assert.equal(user.status, 201, 'Create only a synthetic account through the real API');
    const name = `Boundary profile ${nonce}`;
    const description = `Private boundary description ${nonce}`;
    const created = await send(owner, '/api/servers', 'POST', {
      name, description, slug: `boundary-${nonce}`, ipAddress: '192.0.2.103', port: 22003, visibility: 'private',
    });
    assert.equal(created.status, 201);
    const server = created.data.server;
    async function verifyPrivate(phase) {
      const value = await send(guest, `/servers/${server.slug}`);
      const leaksName = value.text.includes(name);
      const leaksDescription = value.text.includes(description);
      phases.push({ phase, httpStatus: value.status, leaksName, leaksDescription });
      // Inspect the complete streamed HTML, including metadata and embedded RSC.
      assert(!leaksName && !leaksDescription, 'Private profile must not be serialized into public HTML or metadata');
    }
    await verifyPrivate('initial private');
    const managed = await send(owner, `/workspace/servers/${server.id}`);
    assert(managed.text.includes(name), 'Owner retains access through the workspace');
    for (const visibility of ['public', 'unlisted']) {
      assert.equal((await send(owner, `/api/servers/${server.id}`, 'PATCH', { visibility })).status, 200);
      const value = await send(guest, `/servers/${server.slug}`);
      assert(value.status === 200 && value.text.includes(name) && value.text.includes(description), 'Intentionally accessible profiles must remain accessible');
      phases.push({ phase: visibility, httpStatus: value.status, profilePresent: true });
    }
    assert.equal((await send(owner, `/api/servers/${server.id}`, 'PATCH', { visibility: 'private' })).status, 200);
    await verifyPrivate('private again after public access');
    status = 'PASS';
  } finally {
    await ownerContext.close(); await guestContext.close(); await browser.close();
    const result = { commit: process.env.GITHUB_SHA, name: 'J2-11 private public-route boundary', status, phases };
    await writeFile(join(output, 'private-profile.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  }
});
