import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

assert.equal(process.env.GITHUB_ACTIONS, "true");
assert.equal(process.env.RUNNER_ENVIRONMENT, "github-hosted");
assert(process.env.NEXUS_BROWSER_TOOLS);
const require = createRequire(join(resolve(process.env.NEXUS_BROWSER_TOOLS), "package.json"));
const { chromium, expect } = require("@playwright/test");
const baseURL = process.env.NEXUS_BROWSER_BASE_URL;
assert.equal(baseURL, "https://nexus-ci.test:8443", "Only the disposable CI site is allowed");
assert(process.env.NEXUS_BROWSER_REPORT_DIR && process.env.NEXUS_BROWSER_HOME);
assert(process.env.NEXUS_BROWSER_APP_CONTAINER, "Disposable app container is required");
const output = resolve(process.env.NEXUS_BROWSER_REPORT_DIR);
const execute = promisify(execFile);
const nonce = randomBytes(5).toString("hex");
const password = `Ci-${randomBytes(24).toString("hex")}`;
const resetPassword = `Reset-${randomBytes(24).toString("hex")}`;
const people = ["a", "b"].map((suffix) => ({
  username: `beta_${suffix}_${nonce}`,
  email: `beta-${suffix}-${nonce}@example.invalid`,
  password,
}));
const results = [];
const contexts = [];
let browser, alice, bob, guest;
let aliceUser, bobUser, aliceCookie, bobCookie, aliceServer, bobServer;

before(async () => {
  await mkdir(output, { recursive: true });
  browser = await chromium.launch({
    headless: true,
    args: [
      "--host-resolver-rules=MAP nexus-ci.test 127.0.0.1",
      "--remote-debugging-address=127.0.0.1",
      "--remote-debugging-port=9222",
    ],
    env: { ...process.env, HOME: process.env.NEXUS_BROWSER_HOME },
  });
  console.log(
    `Browser: ${browser.version()}; Playwright: ${require("@playwright/test/package.json").version}`,
  );
  for (let i = 0; i < 3; i++) {
    const context = await browser.newContext({
      baseURL,
      ignoreHTTPSErrors: false,
      locale: "en-GB",
      viewport: { width: 1440, height: 1000 },
    });
    const page = await context.newPage();
    const errors = [];
    const networkErrors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      // Expected HTTP failures are recorded, and each response is asserted separately.
      // Script/hydration errors and unrelated asset failures remain blocking.
      const location = message.location().url;
      if (
        /Failed to load resource/.test(message.text()) &&
        /\/api\/(auth|servers)|\/workspace\/servers\//.test(location) &&
        /\b(400|401|403|404|409)\b/.test(message.text())
      )
        networkErrors.push(message.text());
      else errors.push(message.text());
    });
    contexts.push({ context, page, errors, networkErrors });
  }
  [alice, bob, guest] = contexts;
});

async function freshActor() {
  const context = await browser.newContext({
    baseURL,
    ignoreHTTPSErrors: false,
    locale: "en-GB",
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const errors = [];
  const networkErrors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const location = message.location().url;
    if (
      /Failed to load resource/.test(message.text()) &&
      /\/api\/(auth|servers)|\/workspace\/servers\//.test(location) &&
      /\b(400|401|403|404|409)\b/.test(message.text())
    )
      networkErrors.push(message.text());
    else errors.push(message.text());
  });
  const actor = { context, page, errors, networkErrors };
  contexts.push(actor);
  return actor;
}

after(async () => {
  for (const actor of contexts) await actor.context.close();
  if (browser) await browser.close();
  await writeFile(
    join(output, "results.json"),
    JSON.stringify({ commit: process.env.GITHUB_SHA, results }, null, 2),
  );
  await writeFile(
    join(output, "summary.md"),
    `# BETA-005a/D3 authentication acceptance\n\nCommit: ${process.env.GITHUB_SHA}\n\n${results.map((r) => `- ${r.status}: ${r.name}`).join("\n")}\n\nReal Chromium, production TLS, database sessions and HTTP endpoints. No auth/session/ownership responses are mocked. Synthetic accounts and private listings only. No tokens, passwords, cookies or storage state are retained in reports. Includes controlled D3 recovery-email enrollment and D4 password-reset browser paths; no external inbox/provider delivery, real deployment or full visual/accessibility approval is implied.\n`,
  );
});

function check(name, body) {
  test(name, { timeout: 120_000 }, async () => {
    let status = "FAIL";
    for (const actor of contexts) {
      actor.errors.length = 0;
      actor.networkErrors.length = 0;
    }
    try {
      await body();
      assert(
        contexts.every((actor) => actor.errors.length === 0),
        "Unexpected browser script, hydration or console error",
      );
      status = "PASS";
    } finally {
      // Do not save page HTML, network traces, cookie jars or credential input values.
      results.push({
        name,
        status,
        unexpectedBrowserErrors: contexts.flatMap((actor) => actor.errors),
        expectedHttpErrors: contexts.flatMap((actor) => actor.networkErrors),
      });
    }
  });
}

// Same-origin fetch from the actual browser: real cookies, TLS and server routes.
// No route.fulfill(), service mocks or test-only authentication bypasses.
async function request(actor, path, method = "GET", body) {
  return actor.page.evaluate(
    async ({ path, method, body }) => {
      const response = await fetch(path, {
        method,
        cache: "no-store",
        credentials: "same-origin",
        ...(body === undefined
          ? {}
          : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
      });
      const text = await response.text();
      let data = null;
      try {
        data = JSON.parse(text);
      } catch {
        /* HTML is checked by its caller. */
      }
      return {
        status: response.status,
        data,
        text,
        cacheControl: response.headers.get("cache-control"),
      };
    },
    { path, method, body },
  );
}

async function readSyntheticProof(email, purpose = "email_verify") {
  const { stdout, stderr } = await execute(
    "docker",
    [
      "exec",
      "--workdir",
      "/app/packages/db",
      "-e",
      "GITHUB_ACTIONS=true",
      "-e",
      "RUNNER_ENVIRONMENT=github-hosted",
      "-e",
      "NEXUS_ACCOUNT_MAIL_TEST_READ=true",
      process.env.NEXUS_BROWSER_APP_CONTAINER,
      "node",
      "--import",
      "tsx",
      "scripts/read-account-email-verification-ci.ts",
      email,
      purpose,
    ],
    { timeout: 30_000, maxBuffer: 16 * 1024 },
  );
  assert.equal(stderr, "", "CI proof reader must not emit diagnostics");
  const proof = JSON.parse(stdout);
  assert(/^ach_[A-Za-z0-9_-]+$/.test(proof.challengeId));
  assert(/^[A-Za-z0-9_-]{43}$/.test(proof.token));
  return proof;
}

async function register(actor, person, displayName) {
  await actor.page.goto("/auth/register");
  await actor.page.getByLabel("Email address", { exact: true }).fill(person.email);
  await actor.page.getByLabel("Username", { exact: true }).fill(person.username);
  if (displayName)
    await actor.page.getByLabel("Display name (optional)", { exact: true }).fill(displayName);
  await actor.page.getByLabel("Password", { exact: true }).fill(person.password);
  const responsePromise = actor.page.waitForResponse(
    (r) => r.url().endsWith("/api/auth/register") && r.request().method() === "POST",
  );
  await actor.page.getByRole("button", { name: "Create account", exact: true }).click();
  const response = await responsePromise;
  assert.equal(
    response.status(),
    201,
    "Registration must succeed, including a blank optional name",
  );
  await actor.page.waitForURL("**/workspace");
  await expect(actor.page.getByRole("heading", { name: "Workspace", exact: true })).toBeVisible();
  await expect(actor.page.getByRole("group", { name: "Account", exact: true })).toContainText(
    `@${person.username}`,
  );
  const value = await request(actor, "/api/auth/session");
  assert.equal(value.status, 200);
  assert(value.data.authenticated && value.data.user.username === person.username);
  assert(
    !("passwordHash" in value.data.user) && !("token" in value.data),
    "Do not expose auth secrets in JSON",
  );
  assert(value.data.user.role !== "admin", "Public registration must not grant admin");
  const cookie = (await actor.context.cookies()).find((item) => item.name === "nexus_session");
  assert(
    cookie?.httpOnly && cookie.secure && cookie.sameSite === "Lax" && cookie.path === "/",
    "Session cookie security contract",
  );
  assert(cookie.expires > Date.now() / 1000);
  assert(
    !(await actor.page.evaluate(() => document.cookie)).includes("nexus_session="),
    "JavaScript cannot read the session cookie",
  );
  assert(/private/.test(value.cacheControl) && /no-store/.test(value.cacheControl));
  return { user: value.data.user, cookie };
}

check("J2-01 clean labelled login form and anonymous private-route denial", async () => {
  await guest.page.goto("/auth/login");
  await expect(guest.page.getByLabel("Email address", { exact: true })).toHaveValue("");
  await expect(guest.page.getByLabel("Password", { exact: true })).toHaveValue("");
  await expect(guest.page.getByText("Quick Demo Logins")).toHaveCount(0);
  assert(!(await guest.page.locator("main").innerText()).includes("admin@mta-nexus.com"));
  const session = await request(guest, "/api/auth/session");
  assert(
    session.status === 200 && session.data.authenticated === false && session.data.user === null,
  );
  assert.equal((await request(guest, "/api/auth/sessions")).status, 401);
  assert.equal((await request(guest, "/api/servers", "POST", {})).status, 401);
  await guest.page.goto("/workspace");
  await expect(guest.page.getByRole("heading", { name: "Sign in required" })).toBeVisible();
});

check("J2-02 real registration without display name and secure unreadable cookie", async () => {
  const result = await register(alice, people[0]);
  aliceUser = result.user;
  aliceCookie = result.cookie;
  assert(
    aliceUser.displayName === people[0].username,
    "Blank optional name falls back to username",
  );
});

check("J2-03 second browser account cannot inherit the first session", async () => {
  const result = await register(bob, people[1], "Second Beta User");
  bobUser = result.user;
  bobCookie = result.cookie;
  assert(
    aliceUser.id !== bobUser.id && aliceCookie.value !== bobCookie.value,
    "Independent identities and tokens",
  );
  assert((await request(alice, "/api/auth/session")).data.user.id === aliceUser.id);
  const guestSession = await request(guest, "/api/auth/session");
  assert(guestSession.data.authenticated === false && guestSession.data.user === null);
});

check(
  "D3-01 recovery email enrollment requires password and one-time browser confirmation",
  async () => {
    await alice.page.goto("/settings");
    await expect(
      alice.page.getByRole("heading", { name: "Recovery email", exact: true }),
    ).toBeVisible();
    await expect(alice.page.getByText(people[0].email, { exact: true })).toBeVisible();
    await expect(
      alice.page.getByText("Not verified for recovery yet.", { exact: true }),
    ).toBeVisible();

    const requestPromise = alice.page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/auth/email-verification") &&
        response.request().method() === "POST",
    );
    await alice.page
      .getByLabel("Current password for recovery email", { exact: true })
      .fill(password);
    await alice.page.getByRole("button", { name: "Send verification email", exact: true }).click();
    const queued = await requestPromise;
    assert.equal(queued.status(), 202);
    const queuedBody = await queued.text();
    assert(
      !queuedBody.includes("ach_") && !queuedBody.includes("#token="),
      "Request response must not expose confirmation identifiers or tokens",
    );
    await expect(alice.page.locator("#settings-notice")).toContainText("Verification email queued");

    const proof = await readSyntheticProof(people[0].email);
    const foreign = await request(bob, "/api/auth/email-verification", "PATCH", proof);
    assert.equal(foreign.status, 401, "Another signed-in account cannot consume this proof");

    await alice.page.setViewportSize({ width: 390, height: 844 });
    await alice.page.goto(
      `/auth/verify-email?challenge=${encodeURIComponent(proof.challengeId)}#token=${encodeURIComponent(proof.token)}`,
    );
    await expect(
      alice.page.getByRole("heading", { name: "Confirm recovery email", exact: true }),
    ).toBeVisible();
    await expect(
      alice.page.getByRole("button", { name: "Confirm email", exact: true }),
    ).toBeVisible();
    await alice.page.waitForFunction(() => location.hash === "");
    assert.equal(
      await alice.page.evaluate(() => location.hash),
      "",
      "Secret fragment must be stripped from browser history",
    );
    const retained = await alice.page.evaluate(() =>
      JSON.stringify({
        local: { ...localStorage },
        session: { ...sessionStorage },
        url: location.href,
        text: document.body.innerText,
      }),
    );
    assert(
      !retained.includes(proof.token),
      "Confirmation token must not be rendered or persisted in browser storage/URL",
    );

    const before = await request(alice, "/api/auth/email-verification");
    assert.equal(before.status, 200);
    assert.equal(before.data.verified, false, "Opening the GET page must not verify the address");

    await alice.page.getByRole("button", { name: "Confirm email", exact: true }).focus();
    await alice.page.keyboard.press("Enter");
    await expect(
      alice.page.getByText(`Recovery email verified: ${people[0].email}`, { exact: true }),
    ).toBeVisible();
    assert(
      await alice.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      "Email confirmation should not overflow a narrow viewport",
    );

    const after = await request(alice, "/api/auth/email-verification");
    assert.equal(after.status, 200);
    assert.equal(after.data.verified, true);
    assert.equal(after.data.email, people[0].email);
    assert(/private/.test(after.cacheControl) && /no-store/.test(after.cacheControl));
    assert.equal(
      (await request(alice, "/api/auth/email-verification", "PATCH", proof)).status,
      401,
      "Consumed confirmation proof cannot replay",
    );

    await alice.page.goto("/settings");
    await expect(alice.page.getByText(/Verified for recovery/)).toBeVisible();
    await expect(
      alice.page.getByRole("button", { name: "Send verification email", exact: true }),
    ).toHaveCount(0);
    await alice.page.setViewportSize({ width: 1440, height: 1000 });
  },
);

check(
  "J2-04 nonempty session lists are private and another account cannot revoke them",
  async () => {
    const a = await request(alice, `/api/auth/sessions?userId=${bobUser.id}`);
    const b = await request(bob, `/api/auth/sessions?userId=${aliceUser.id}`);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    const ids = (value) => value.data.sessions.map((item) => item.id);
    assert(
      a.data.sessions.length > 0 && b.data.sessions.length > 0,
      "Empty lists cannot establish isolation",
    );
    assert(
      ids(a).every((id) => !ids(b).includes(id)),
      "Session lists must not overlap",
    );
    assert(
      !a.text.includes(bobCookie.value) &&
        !a.text.includes(aliceCookie.value) &&
        !b.text.includes(bobCookie.value),
      "Raw tokens must not be returned",
    );
    assert(/private/.test(a.cacheControl) && /no-store/.test(a.cacheControl));
    const foreignId = b.data.sessions.find((session) => session.isCurrent).id;
    assert.equal(
      (
        await request(alice, "/api/auth/sessions", "DELETE", {
          sessionId: foreignId,
          userId: bobUser.id,
        })
      ).status,
      400,
    );
    assert.equal(
      (await request(alice, "/api/auth/sessions", "DELETE", { sessionId: foreignId })).status,
      404,
    );
    assert(
      (await request(bob, "/api/auth/session")).data.user.id === bobUser.id,
      "Other account remains signed in",
    );
  },
);

check("J2-05 private server management and workspace remain owner-scoped", async () => {
  for (const [actor, person, ip] of [
    [alice, people[0], "192.0.2.101"],
    [bob, people[1], "192.0.2.102"],
  ]) {
    const created = await request(actor, "/api/servers", "POST", {
      name: `Private ${person.username}`,
      slug: `private-${person.username.replaceAll("_", "-")}`,
      description: `Private owner note ${person.username}`,
      ipAddress: ip,
      port: 22003,
      visibility: "private",
    });
    assert.equal(created.status, 201, "Synthetic private listing creation");
    assert.equal(
      created.data.server.ownerId,
      actor === alice ? aliceUser.id : bobUser.id,
      "Owner comes from session",
    );
    if (actor === alice) aliceServer = created.data.server;
    else bobServer = created.data.server;
  }
  for (const [actor, own, other] of [
    [alice, aliceServer, bobServer],
    [bob, bobServer, aliceServer],
  ]) {
    await actor.page.goto("/workspace");
    await expect(actor.page.locator("main")).toContainText(own.name);
    await expect(actor.page.locator("main")).not.toContainText(other.name);
    const foreign = await request(actor, `/workspace/servers/${other.id}`);
    assert(
      !foreign.text.includes(other.name) && !foreign.text.includes(other.description),
      "Foreign management page must not serialize private data",
    );
    assert.equal(
      (
        await request(actor, `/api/servers/${other.id}`, "PATCH", {
          name: "Unauthorized overwrite",
        })
      ).status,
      403,
    );
  }
  assert.equal(
    (
      await request(guest, `/api/servers/${aliceServer.id}`, "PATCH", {
        name: "Anonymous overwrite",
      })
    ).status,
    401,
  );
  const anon = await request(guest, `/workspace/servers/${aliceServer.id}`);
  assert(!anon.text.includes(aliceServer.description) && !anon.text.includes(aliceServer.name));
  await alice.page.goto(`/workspace/servers/${aliceServer.id}`);
  await expect(
    alice.page.getByRole("heading", { name: aliceServer.name, exact: true }),
  ).toBeVisible();
});

check("J2-06 logout clears cookie, revokes replay and leaves the other account valid", async () => {
  const replayContext = await browser.newContext({ baseURL, ignoreHTTPSErrors: false });
  try {
    await replayContext.addCookies([aliceCookie]);
    const page = await replayContext.newPage();
    await page.goto("/auth/login");
    const replay = { page };
    assert((await request(replay, "/api/auth/session")).data.authenticated === true);
    await alice.page.getByRole("button", { name: "Sign out", exact: true }).click();
    await alice.page.waitForURL("**/auth/login");
    assert(
      !(await alice.context.cookies()).some((item) => item.name === "nexus_session"),
      "Logout must clear the cookie",
    );
    const old = await request(replay, "/api/auth/session");
    assert(
      old.data.authenticated === false && old.data.user === null,
      "Replaying the old cookie must fail",
    );
    assert.equal((await request(replay, "/api/auth/sessions")).status, 401);
    assert((await request(bob, "/api/auth/session")).data.user.id === bobUser.id);
    await alice.page.goto("/workspace");
    await expect(alice.page.getByRole("heading", { name: "Sign in required" })).toBeVisible();
    await expect(alice.page.locator("main")).not.toContainText(aliceServer.name);
    assert.equal(
      (await request(alice, "/api/auth/session", "DELETE")).status,
      200,
      "Repeated logout is safe",
    );
  } finally {
    await replayContext.close();
  }
});

check("J2-07 wrong credentials show a generic error without creating a session", async () => {
  await guest.page.goto("/auth/login");
  await guest.page.getByLabel("Email address", { exact: true }).fill(people[0].email);
  await guest.page.getByLabel("Password", { exact: true }).fill("not-the-correct-password");
  await guest.page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(guest.page.locator("form").getByRole("alert")).toContainText(
    "Invalid email or password",
  );
  assert(!(await guest.context.cookies()).some((item) => item.name === "nexus_session"));
  const missing = await request(guest, "/api/auth/login", "POST", {
    email: `absent-${nonce}@example.invalid`,
    password: "not-the-correct-password",
  });
  assert.equal(missing.status, 401);
  assert.equal(missing.data.error, "Invalid email or password");
});

check(
  "J2-08 real login issues a new session and account switching discards private UI",
  async () => {
    await alice.page.goto("/auth/login");
    await alice.page.getByLabel("Email address", { exact: true }).fill(people[0].email);
    await alice.page.getByLabel("Password", { exact: true }).fill(password);
    await alice.page.getByRole("button", { name: "Sign In", exact: true }).click();
    await alice.page.waitForURL("**/workspace");
    await expect(alice.page.locator("main")).toContainText(aliceServer.name);
    const cookie = (await alice.context.cookies()).find((item) => item.name === "nexus_session");
    assert(
      cookie && cookie.value !== aliceCookie.value,
      "Login must not reactivate the revoked token",
    );
    await alice.page.getByRole("button", { name: "Sign out", exact: true }).click();
    await alice.page.waitForURL("**/auth/login");
    await alice.page.getByLabel("Email address", { exact: true }).fill(people[1].email);
    await alice.page.getByLabel("Password", { exact: true }).fill(password);
    await alice.page.getByRole("button", { name: "Sign In", exact: true }).click();
    await alice.page.waitForURL("**/workspace");
    await expect(alice.page.locator("main")).toContainText(bobServer.name);
    await expect(alice.page.locator("main")).not.toContainText(aliceServer.name);
    assert((await request(alice, "/api/auth/session")).data.user.id === bobUser.id);
    await alice.page.goBack();
    await alice.page.goto("/workspace");
    await expect(alice.page.locator("main")).not.toContainText(aliceServer.name);
  },
);

check("J2-09 malformed and duplicate registration does not authenticate the guest", async () => {
  assert.equal(
    (
      await request(guest, "/api/auth/register", "POST", {
        email: "bad",
        username: "x",
        password: "short",
      })
    ).status,
    400,
  );
  const duplicate = await request(guest, "/api/auth/register", "POST", people[0]);
  assert.equal(duplicate.status, 409);
  assert(
    !duplicate.text.includes(aliceUser.id) &&
      !duplicate.text.includes(password) &&
      !duplicate.text.includes("passwordHash"),
  );
  assert((await request(guest, "/api/auth/session")).data.authenticated === false);
});

check("J2-10 keyboard and narrow login form plus agent-browser snapshot", async () => {
  await guest.page.setViewportSize({ width: 390, height: 844 });
  await guest.page.goto("/auth/login");
  // AccountControls resolves /api/auth/session after hydration and rerenders the
  // header. Wait for its stable guest control before asserting native tab order,
  // otherwise that unrelated rerender can steal focus between focus() and Tab.
  await expect(
    guest.page.getByRole("banner").getByRole("link", { name: "Sign in", exact: true }),
  ).toBeVisible();
  const emailField = guest.page.getByLabel("Email address", { exact: true });
  await emailField.focus();
  await expect(emailField).toBeFocused();
  await guest.page.keyboard.press("Tab");
  await expect(guest.page.getByLabel("Password", { exact: true })).toBeFocused();
  await guest.page.keyboard.press("Tab");
  await expect(guest.page.getByRole("button", { name: "Sign In", exact: true })).toBeFocused();
  assert(
    await guest.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    "Login should not overflow horizontally",
  );
  await guest.page.screenshot({ path: join(output, "anonymous-login-mobile.png") });
  const agent = join(process.env.NEXUS_BROWSER_TOOLS, "node_modules/.bin/agent-browser");
  const args = ["--cdp", "9222", "--session", "nexus-auth"];
  try {
    await execute(agent, [...args, "open", `${baseURL}/auth/login`], { timeout: 30_000 });
    const snapshot = await execute(agent, [...args, "snapshot", "-i"], { timeout: 30_000 });
    // Input labels use CSS uppercase; agent-browser may expose "EMAIL ADDRESS".
    await writeFile(join(output, "agent-browser-snapshot.txt"), snapshot.stdout);
    assert.match(snapshot.stdout, /email address/i, "login snapshot should expose the email field");
    assert.match(snapshot.stdout, /sign in/i, "login snapshot should expose the sign-in control");
    await execute(agent, [...args, "screenshot", join(output, "anonymous-login-agent.png")], {
      timeout: 30_000,
    });
  } finally {
    await execute(agent, [...args, "close"], { timeout: 10_000 }).catch(() => {});
  }
});

check("D4-01 anonymous neutral request and one-time password reset", async () => {
  const resetSessionA = await freshActor();
  const resetSessionB = await freshActor();
  for (const who of [resetSessionA, resetSessionB]) {
    await who.page.goto("/auth/login");
    const logged = await request(who, "/api/auth/login", "POST", {
      email: people[0].email,
      password,
    });
    assert.equal(logged.status, 200);
    assert.equal((await request(who, "/api/auth/session")).data.user.id, aliceUser.id);
  }

  await guest.page.setViewportSize({ width: 390, height: 844 });
  await guest.page.goto("/auth/forgot-password");
  await expect(
    guest.page.getByRole("heading", { name: "Forgot password", exact: true }),
  ).toBeVisible();

  async function forgot(email) {
    await guest.page.getByLabel("Email address", { exact: true }).fill(email);
    const started = Date.now();
    const responsePromise = guest.page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/auth/password-reset") &&
        response.request().method() === "POST",
    );
    await guest.page.getByRole("button", { name: "Send reset link", exact: true }).click();
    const response = await responsePromise;
    const elapsed = Date.now() - started;
    const body = await response.json();
    assert.equal(response.status(), 202);
    assert.deepEqual(body, {
      accepted: true,
      message: "If an eligible account uses that email, a password reset link will be sent.",
    });
    assert(elapsed >= 300, "Neutral reset response must respect the timing floor");
    await expect(
      guest.page.getByText("If an eligible account uses that email", { exact: false }),
    ).toBeVisible();
    return { elapsed, body };
  }

  const missing = await forgot(`missing-reset-${nonce}@example.invalid`);
  const known = await forgot(people[0].email);
  assert.deepEqual(
    known.body,
    missing.body,
    "Known and unknown addresses must receive the same public body",
  );

  const proof = await readSyntheticProof(people[0].email, "password_reset");
  await guest.page.goto(
    `/auth/reset-password?challenge=${encodeURIComponent(proof.challengeId)}#token=${encodeURIComponent(proof.token)}`,
  );
  await expect(
    guest.page.getByRole("heading", { name: "Reset password", exact: true }),
  ).toBeVisible();
  await guest.page.waitForFunction(() => location.hash === "");
  const retained = await guest.page.evaluate(() =>
    JSON.stringify({
      local: { ...localStorage },
      session: { ...sessionStorage },
      url: location.href,
      text: document.body.innerText,
    }),
  );
  assert(
    !retained.includes(proof.token),
    "Reset token must not be rendered or persisted in browser storage/URL",
  );
  assert.equal(
    (await request(resetSessionA, "/api/auth/session")).data.user.id,
    aliceUser.id,
    "Opening the reset page must not mutate credentials or sessions",
  );

  await guest.page.getByLabel("New password", { exact: true }).fill(resetPassword);
  await guest.page.getByLabel("Confirm new password", { exact: true }).fill(resetPassword);
  await guest.page.getByRole("button", { name: "Reset password", exact: true }).focus();
  await guest.page.keyboard.press("Enter");
  await expect(
    guest.page.getByText(
      "Password reset. All existing sessions were signed out. Sign in with your new password.",
      { exact: true },
    ),
  ).toBeVisible();
  assert(
    await guest.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    "Reset page should not overflow a narrow viewport",
  );

  const anonymousAfterReset = await request(guest, "/api/auth/session");
  assert.equal(
    anonymousAfterReset.data.authenticated,
    false,
    "Reset must not automatically sign in the browser",
  );
  assert(
    !(await guest.context.cookies()).some((item) => item.name === "nexus_session"),
    "Reset confirmation must not issue a session cookie",
  );
  for (const who of [resetSessionA, resetSessionB]) {
    assert.equal(
      (await request(who, "/api/auth/sessions")).status,
      401,
      "All pre-reset sessions must be revoked",
    );
  }
  assert.equal(
    (await request(guest, "/api/auth/login", "POST", { email: people[0].email, password })).status,
    401,
    "Old password must stop working",
  );
  assert.equal(
    (
      await request(guest, "/api/auth/login", "POST", {
        email: people[0].email,
        password: resetPassword,
      })
    ).status,
    200,
    "New password must require an explicit normal login",
  );
  assert.equal(
    (
      await request(guest, "/api/auth/password-reset", "PATCH", {
        challengeId: proof.challengeId,
        token: proof.token,
        newPassword: `Replay-${resetPassword}`,
      })
    ).status,
    400,
    "Consumed reset proof cannot replay",
  );
});
