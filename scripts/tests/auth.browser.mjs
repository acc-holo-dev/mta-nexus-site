import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

assert.equal(process.env.GITHUB_ACTIONS, 'true');
assert.equal(process.env.RUNNER_ENVIRONMENT, 'github-hosted');
assert(process.env.NEXUS_BROWSER_TOOLS);
const require = createRequire(join(resolve(process.env.NEXUS_BROWSER_TOOLS), 'package.json'));
const { chromium, expect } = require('@playwright/test');
const baseURL = process.env.NEXUS_BROWSER_BASE_URL;
assert.equal(baseURL, 'https://nexus-ci.test:8443', 'Only the disposable CI site is allowed');
assert(process.env.NEXUS_BROWSER_REPORT_DIR && process.env.NEXUS_BROWSER_HOME);
const output = resolve(process.env.NEXUS_BROWSER_REPORT_DIR);
const execute = promisify(execFile);
const nonce = randomBytes(5).toString('hex');
const password = `Ci-${randomBytes(24).toString('hex')}`;
const people = ['a', 'b'].map((suffix) => ({
  username: `beta_${suffix}_${nonce}`, email: `beta-${suffix}-${nonce}@example.invalid`, password,
}));
const results = [];
const contexts = [];
let browser, alice, bob, guest;
let aliceUser, bobUser, aliceCookie, bobCookie, aliceServer, bobServer;

before(async () => {
  await mkdir(output, { recursive: true });
  browser = await chromium.launch({
    headless: true,
    args: ['--host-resolver-rules=MAP nexus-ci.test 127.0.0.1', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=9222'],
    env: { ...process.env, HOME: process.env.NEXUS_BROWSER_HOME },
  });
  console.log(`Browser: ${browser.version()}; Playwright: ${require('@playwright/test/package.json').version}`);
  for (let i = 0; i < 3; i++) {
    const context = await browser.newContext({ baseURL, ignoreHTTPSErrors: false, locale: 'en-GB', viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const errors = [];
    const networkErrors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      // Expected HTTP failures are recorded, and each response is asserted separately.
      // Script/hydration errors and unrelated asset failures remain blocking.
      const location = message.location().url;
      if (/Failed to load resource/.test(message.text())
        && /\/api\/(auth|servers)|\/workspace\/servers\//.test(location)
        && /\b(400|401|403|404|409)\b/.test(message.text())) networkErrors.push(message.text());
      else errors.push(message.text());
    });
    contexts.push({ context, page, errors, networkErrors });
  }
  [alice, bob, guest] = contexts;
});

after(async () => {
  for (const actor of contexts) await actor.context.close();
  if (browser) await browser.close();
  await writeFile(join(output, 'results.json'), JSON.stringify({ commit: process.env.GITHUB_SHA, results }, null, 2));
  await writeFile(join(output, 'summary.md'), `# BETA-005a authentication acceptance\n\nCommit: ${process.env.GITHUB_SHA}\n\n${results.map((r) => `- ${r.status}: ${r.name}`).join('\n')}\n\nReal Chromium, production TLS, database sessions and HTTP endpoints. No auth/session/ownership responses are mocked. Synthetic accounts and private listings only. No tokens, passwords, cookies or storage state are retained in reports. Not a full auth audit, recovery/password-change test, real deployment or visual approval.\n`);
});

function check(name, body) {
  test(name, { timeout: 120_000 }, async () => {
    let status = 'FAIL';
    for (const actor of contexts) { actor.errors.length = 0; actor.networkErrors.length = 0; }
    try {
      await body();
      assert(contexts.every((actor) => actor.errors.length === 0), 'Unexpected browser script, hydration or console error');
      status = 'PASS';
    } finally {
      // Do not save page HTML, network traces, cookie jars or credential input values.
      results.push({ name, status, unexpectedBrowserErrors: contexts.flatMap((actor) => actor.errors), expectedHttpErrors: contexts.flatMap((actor) => actor.networkErrors) });
    }
  });
}

// Same-origin fetch from the actual browser: real cookies, TLS and server routes.
// No route.fulfill(), service mocks or test-only authentication bypasses.
async function request(actor, path, method = 'GET', body) {
  return actor.page.evaluate(async ({ path, method, body }) => {
    const response = await fetch(path, {
      method, cache: 'no-store', credentials: 'same-origin',
      ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    });
    const text = await response.text();
    let data = null;
    try { data = JSON.parse(text); } catch { /* HTML is checked by its caller. */ }
    return { status: response.status, data, text, cacheControl: response.headers.get('cache-control') };
  }, { path, method, body });
}

async function register(actor, person, displayName) {
  await actor.page.goto('/auth/register');
  await actor.page.getByLabel('Email address', { exact: true }).fill(person.email);
  await actor.page.getByLabel('Username', { exact: true }).fill(person.username);
  if (displayName) await actor.page.getByLabel('Display name (optional)', { exact: true }).fill(displayName);
  await actor.page.getByLabel('Password', { exact: true }).fill(person.password);
  const responsePromise = actor.page.waitForResponse((r) => r.url().endsWith('/api/auth/register') && r.request().method() === 'POST');
  await actor.page.getByRole('button', { name: 'Create account', exact: true }).click();
  const response = await responsePromise;
  assert.equal(response.status(), 201, 'Registration must succeed, including a blank optional name');
  await actor.page.waitForURL('**/workspace');
  await expect(actor.page.getByRole('heading', { name: 'Workspace', exact: true })).toBeVisible();
  await expect(actor.page.getByRole('group', { name: 'Account', exact: true })).toContainText(`@${person.username}`);
  const value = await request(actor, '/api/auth/session');
  assert.equal(value.status, 200);
  assert(value.data.authenticated && value.data.user.username === person.username);
  assert(!('passwordHash' in value.data.user) && !('token' in value.data), 'Do not expose auth secrets in JSON');
  assert(value.data.user.role !== 'admin', 'Public registration must not grant admin');
  const cookie = (await actor.context.cookies()).find((item) => item.name === 'nexus_session');
  assert(cookie && cookie.httpOnly && cookie.secure && cookie.sameSite === 'Lax' && cookie.path === '/', 'Session cookie security contract');
  assert(cookie.expires > Date.now() / 1000);
  assert(!(await actor.page.evaluate(() => document.cookie)).includes('nexus_session='), 'JavaScript cannot read the session cookie');
  assert(/private/.test(value.cacheControl) && /no-store/.test(value.cacheControl));
  return { user: value.data.user, cookie };
}

check('J2-01 clean labelled login form and anonymous private-route denial', async () => {
  await guest.page.goto('/auth/login');
  await expect(guest.page.getByLabel('Email address', { exact: true })).toHaveValue('');
  await expect(guest.page.getByLabel('Password', { exact: true })).toHaveValue('');
  await expect(guest.page.getByText('Quick Demo Logins')).toHaveCount(0);
  assert(!(await guest.page.locator('main').innerText()).includes('admin@mta-nexus.com'));
  const session = await request(guest, '/api/auth/session');
  assert(session.status === 200 && session.data.authenticated === false && session.data.user === null);
  assert.equal((await request(guest, '/api/auth/sessions')).status, 401);
  assert.equal((await request(guest, '/api/servers', 'POST', {})).status, 401);
  await guest.page.goto('/workspace');
  await expect(guest.page.getByRole('heading', { name: 'Sign in required' })).toBeVisible();
});

check('J2-02 real registration without display name and secure unreadable cookie', async () => {
  const result = await register(alice, people[0]);
  aliceUser = result.user; aliceCookie = result.cookie;
  assert(aliceUser.displayName === people[0].username, 'Blank optional name falls back to username');
});

check('J2-03 second browser account cannot inherit the first session', async () => {
  const result = await register(bob, people[1], 'Second Beta User');
  bobUser = result.user; bobCookie = result.cookie;
  assert(aliceUser.id !== bobUser.id && aliceCookie.value !== bobCookie.value, 'Independent identities and tokens');
  assert((await request(alice, '/api/auth/session')).data.user.id === aliceUser.id);
  const guestSession = await request(guest, '/api/auth/session');
  assert(guestSession.data.authenticated === false && guestSession.data.user === null);
});

check('J2-04 nonempty session lists are private and another account cannot revoke them', async () => {
  const a = await request(alice, `/api/auth/sessions?userId=${bobUser.id}`);
  const b = await request(bob, `/api/auth/sessions?userId=${aliceUser.id}`);
  assert.equal(a.status, 200); assert.equal(b.status, 200);
  const ids = (value) => value.data.sessions.map((item) => item.id);
  assert(a.data.sessions.length > 0 && b.data.sessions.length > 0, 'Empty lists cannot establish isolation');
  assert(ids(a).every((id) => !ids(b).includes(id)), 'Session lists must not overlap');
  assert(!a.text.includes(bobCookie.value) && !a.text.includes(aliceCookie.value) && !b.text.includes(bobCookie.value), 'Raw tokens must not be returned');
  assert(/private/.test(a.cacheControl) && /no-store/.test(a.cacheControl));
  const foreignId = b.data.sessions.find((session) => session.isCurrent).id;
  assert.equal((await request(alice, '/api/auth/sessions', 'DELETE', { sessionId: foreignId, userId: bobUser.id })).status, 404);
  assert((await request(bob, '/api/auth/session')).data.user.id === bobUser.id, 'Other account remains signed in');
});

check('J2-05 private server management and workspace remain owner-scoped', async () => {
  for (const [actor, person, ip] of [[alice, people[0], '192.0.2.101'], [bob, people[1], '192.0.2.102']]) {
    const created = await request(actor, '/api/servers', 'POST', {
      name: `Private ${person.username}`, slug: `private-${person.username.replaceAll('_', '-')}`,
      description: `Private owner note ${person.username}`, ipAddress: ip, port: 22003,
      visibility: 'private', ownerId: actor === alice ? bobUser.id : aliceUser.id,
    });
    assert.equal(created.status, 201, 'Synthetic private listing creation');
    assert(created.data.server.ownerId === (actor === alice ? aliceUser.id : bobUser.id), 'Owner comes from session, not submitted ID');
    if (actor === alice) aliceServer = created.data.server; else bobServer = created.data.server;
  }
  for (const [actor, own, other] of [[alice, aliceServer, bobServer], [bob, bobServer, aliceServer]]) {
    await actor.page.goto('/workspace');
    await expect(actor.page.locator('main')).toContainText(own.name);
    await expect(actor.page.locator('main')).not.toContainText(other.name);
    const foreign = await request(actor, `/workspace/servers/${other.id}`);
    assert(!foreign.text.includes(other.name) && !foreign.text.includes(other.description), 'Foreign management page must not serialize private data');
    assert.equal((await request(actor, `/api/servers/${other.id}`, 'PATCH', { name: 'Unauthorized overwrite' })).status, 403);
  }
  assert.equal((await request(guest, `/api/servers/${aliceServer.id}`, 'PATCH', { name: 'Anonymous overwrite' })).status, 401);
  const anon = await request(guest, `/workspace/servers/${aliceServer.id}`);
  assert(!anon.text.includes(aliceServer.description) && !anon.text.includes(aliceServer.name));
  await alice.page.goto(`/workspace/servers/${aliceServer.id}`);
  await expect(alice.page.getByRole('heading', { name: aliceServer.name, exact: true })).toBeVisible();
});

check('J2-06 logout clears cookie, revokes replay and leaves the other account valid', async () => {
  const replayContext = await browser.newContext({ baseURL, ignoreHTTPSErrors: false });
  try {
    await replayContext.addCookies([aliceCookie]);
    const page = await replayContext.newPage();
    await page.goto('/auth/login');
    const replay = { page };
    assert((await request(replay, '/api/auth/session')).data.authenticated === true);
    await alice.page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await alice.page.waitForURL('**/auth/login');
    assert(!(await alice.context.cookies()).some((item) => item.name === 'nexus_session'), 'Logout must clear the cookie');
    const old = await request(replay, '/api/auth/session');
    assert(old.data.authenticated === false && old.data.user === null, 'Replaying the old cookie must fail');
    assert.equal((await request(replay, '/api/auth/sessions')).status, 401);
    assert((await request(bob, '/api/auth/session')).data.user.id === bobUser.id);
    await alice.page.goto('/workspace');
    await expect(alice.page.getByRole('heading', { name: 'Sign in required' })).toBeVisible();
    await expect(alice.page.locator('main')).not.toContainText(aliceServer.name);
    assert.equal((await request(alice, '/api/auth/session', 'DELETE')).status, 200, 'Repeated logout is safe');
  } finally { await replayContext.close(); }
});

check('J2-07 wrong credentials show a generic error without creating a session', async () => {
  await guest.page.goto('/auth/login');
  await guest.page.getByLabel('Email address', { exact: true }).fill(people[0].email);
  await guest.page.getByLabel('Password', { exact: true }).fill('not-the-correct-password');
  await guest.page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(guest.page.locator('form').getByRole('alert')).toContainText('Invalid email or password');
  assert(!(await guest.context.cookies()).some((item) => item.name === 'nexus_session'));
  const missing = await request(guest, '/api/auth/login', 'POST', { email: `absent-${nonce}@example.invalid`, password: 'not-the-correct-password' });
  assert.equal(missing.status, 401);
  assert.equal(missing.data.error, 'Invalid email or password');
});

check('J2-08 real login issues a new session and account switching discards private UI', async () => {
  await alice.page.goto('/auth/login');
  await alice.page.getByLabel('Email address', { exact: true }).fill(people[0].email);
  await alice.page.getByLabel('Password', { exact: true }).fill(password);
  await alice.page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await alice.page.waitForURL('**/workspace');
  await expect(alice.page.locator('main')).toContainText(aliceServer.name);
  const cookie = (await alice.context.cookies()).find((item) => item.name === 'nexus_session');
  assert(cookie && cookie.value !== aliceCookie.value, 'Login must not reactivate the revoked token');
  await alice.page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await alice.page.waitForURL('**/auth/login');
  await alice.page.getByLabel('Email address', { exact: true }).fill(people[1].email);
  await alice.page.getByLabel('Password', { exact: true }).fill(password);
  await alice.page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await alice.page.waitForURL('**/workspace');
  await expect(alice.page.locator('main')).toContainText(bobServer.name);
  await expect(alice.page.locator('main')).not.toContainText(aliceServer.name);
  assert((await request(alice, '/api/auth/session')).data.user.id === bobUser.id);
  await alice.page.goBack();
  await alice.page.goto('/workspace');
  await expect(alice.page.locator('main')).not.toContainText(aliceServer.name);
});

check('J2-09 malformed and duplicate registration does not authenticate the guest', async () => {
  assert.equal((await request(guest, '/api/auth/register', 'POST', { email: 'bad', username: 'x', password: 'short' })).status, 400);
  const duplicate = await request(guest, '/api/auth/register', 'POST', people[0]);
  assert.equal(duplicate.status, 409);
  assert(!duplicate.text.includes(aliceUser.id) && !duplicate.text.includes(password) && !duplicate.text.includes('passwordHash'));
  assert((await request(guest, '/api/auth/session')).data.authenticated === false);
});

check('J2-10 keyboard and narrow login form plus agent-browser snapshot', async () => {
  await guest.page.setViewportSize({ width: 390, height: 844 });
  await guest.page.goto('/auth/login');
  await guest.page.getByLabel('Email address', { exact: true }).focus();
  await guest.page.keyboard.press('Tab');
  await expect(guest.page.getByLabel('Password', { exact: true })).toBeFocused();
  await guest.page.keyboard.press('Tab');
  await expect(guest.page.getByRole('button', { name: 'Sign In', exact: true })).toBeFocused();
  assert(await guest.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Login should not overflow horizontally');
  await guest.page.screenshot({ path: join(output, 'anonymous-login-mobile.png') });
  const agent = join(process.env.NEXUS_BROWSER_TOOLS, 'node_modules/.bin/agent-browser');
  const args = ['--cdp', '9222', '--session', 'nexus-auth'];
  try {
    await execute(agent, [...args, 'open', `${baseURL}/auth/login`], { timeout: 30_000 });
    const snapshot = await execute(agent, [...args, 'snapshot', '-i'], { timeout: 30_000 });
    assert(snapshot.stdout.includes('Email address') && snapshot.stdout.includes('Sign In'));
    await writeFile(join(output, 'agent-browser-snapshot.txt'), snapshot.stdout);
    await execute(agent, [...args, 'screenshot', join(output, 'anonymous-login-agent.png')], { timeout: 30_000 });
  } finally {
    await execute(agent, [...args, 'close'], { timeout: 10_000 }).catch(() => {});
  }
});
