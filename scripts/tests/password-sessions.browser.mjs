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
assert(
  process.env.NEXUS_BROWSER_TOOLS &&
    process.env.NEXUS_BROWSER_REPORT_DIR &&
    process.env.NEXUS_BROWSER_HOME,
);
const require = createRequire(join(resolve(process.env.NEXUS_BROWSER_TOOLS), "package.json"));
const { chromium, expect } = require("@playwright/test");
const baseURL = process.env.NEXUS_BROWSER_BASE_URL;
assert.equal(baseURL, "https://nexus-ci.test:8443", "Only the disposable CI site is allowed");
const output = resolve(process.env.NEXUS_BROWSER_REPORT_DIR);
const execute = promisify(execFile);
const nonce = randomBytes(5).toString("hex");
const secret = () => `Ci-${randomBytes(24).toString("hex")}`;
const oldPassword = secret(),
  newPassword = secret(),
  bobPassword = secret();
const aliceInput = {
  email: `pw-a-${nonce}@example.invalid`,
  username: `pwa_${nonce}`,
  password: oldPassword,
};
const bobInput = {
  email: `pw-b-${nonce}@example.invalid`,
  username: `pwb_${nonce}`,
  password: bobPassword,
};
const results = [],
  actors = [];
let browser, alice, second, third, bob, guest, aliceId, bobId, originalCookie;

async function actor() {
  const context = await browser.newContext({
    baseURL,
    ignoreHTTPSErrors: false,
    locale: "en-GB",
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", () => errors.push("Unhandled page error"));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (
      /Failed to load resource/.test(message.text()) &&
      /\/api\/auth\//.test(message.location().url) &&
      /\b(400|401|404|409|503)\b/.test(message.text())
    )
      return;
    // A revoked session also receives an expected 401 from preferences on /settings.
    if (
      /Failed to load resource/.test(message.text()) &&
      /\/api\/notifications\/preferences(?:\?|$)/.test(message.location().url) &&
      /\b401\b/.test(message.text())
    )
      return;
    errors.push("Unexpected console error");
  });
  const value = { context, page, errors };
  actors.push(value);
  await page.goto("/auth/login");
  return value;
}
async function request(who, path, method = "GET", body) {
  return who.page.evaluate(
    async ({ path, method, body }) => {
      const response = await fetch(path, {
        method,
        credentials: "same-origin",
        cache: "no-store",
        ...(body === undefined
          ? {}
          : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
      });
      return {
        status: response.status,
        data: await response.json(),
        cache: response.headers.get("cache-control"),
      };
    },
    { path, method, body },
  );
}
const session = (who) => request(who, "/api/auth/session");
const list = (who) => request(who, "/api/auth/sessions");
const cookie = async (who) =>
  (await who.context.cookies()).find((item) => item.name === "nexus_session");
const rows = (who) => who.page.locator("[data-session-id]");
const passwordForm = (who) => who.page.getByRole("form", { name: "Change password", exact: true });
const currentPasswordField = (who) =>
  passwordForm(who).getByLabel("Current password", { exact: true });
const newPasswordField = (who) => passwordForm(who).getByLabel("New password", { exact: true });
async function settings(who) {
  await who.page.goto("/settings");
  await expect(who.page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  await expect(currentPasswordField(who)).toBeVisible();
}
async function login(who, password = newPassword) {
  const result = await request(who, "/api/auth/login", "POST", {
    email: aliceInput.email,
    password,
  });
  assert.equal(result.status, 200, "Synthetic login must succeed");
  assert.equal((await session(who)).data.user.id, aliceId);
}
function check(name, body) {
  test(name, { timeout: 90_000 }, async () => {
    actors.forEach((a) => {
      a.errors.length = 0;
    });
    let status = "FAIL";
    try {
      await body();
      assert(
        actors.every((a) => a.errors.length === 0),
        "Unexpected browser errors",
      );
      status = "PASS";
    } finally {
      results.push({ name, status });
    }
  });
}

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
  alice = await actor();
  second = await actor();
  third = await actor();
  bob = await actor();
  guest = await actor();
});
after(async () => {
  for (const a of actors) await a.context.close().catch(() => {});
  if (browser) await browser.close();
  const report = {
    commit: process.env.GITHUB_SHA,
    results,
    limits:
      "Real auth/database/TLS. One UI-only 503 injection is explicitly named. No recovery, full security audit or manual visual approval.",
  };
  await writeFile(join(output, "password-sessions.json"), JSON.stringify(report, null, 2));
  await writeFile(
    join(output, "password-summary.md"),
    `# BETA-005b password and sessions\n\nCommit: ${process.env.GITHUB_SHA}\n\n${results.map((r) => `- ${r.status}: ${r.name}`).join("\n")}\n\n${report.limits}\n`,
  );
});

check("P1 three real sessions and a separate account", async () => {
  const a = await request(alice, "/api/auth/register", "POST", aliceInput);
  const b = await request(bob, "/api/auth/register", "POST", bobInput);
  assert.equal(a.status, 201);
  assert.equal(b.status, 201);
  aliceId = a.data.user.id;
  bobId = b.data.user.id;
  await login(second, oldPassword);
  await login(third, oldPassword);
  originalCookie = await cookie(alice);
  assert(originalCookie?.httpOnly && originalCookie.secure);
  assert.equal((await list(alice)).data.sessions.length, 3);
  assert.equal((await list(bob)).data.sessions.length, 1);
  assert.equal((await session(guest)).data.authenticated, false);
  await settings(alice);
  await expect(rows(alice)).toHaveCount(3);
  await expect(alice.page.getByText("This browser", { exact: true })).toBeVisible();
});

check("P2 wrong current password changes neither credentials nor sessions", async () => {
  const previous = (await list(alice)).data.sessions.map((s) => s.id).sort();
  await currentPasswordField(alice).fill(secret());
  await newPasswordField(alice).fill(newPassword);
  const response = alice.page.waitForResponse(
    (r) => r.url().endsWith("/api/auth/password") && r.request().method() === "POST",
  );
  await alice.page.getByRole("button", { name: "Update password", exact: true }).click();
  assert.equal((await response).status(), 401);
  await expect(alice.page.locator("#settings-notice")).toContainText(
    "Current password is incorrect",
  );
  assert.deepEqual((await list(alice)).data.sessions.map((s) => s.id).sort(), previous);
  assert(
    (await cookie(alice)).value === originalCookie.value,
    "Failed change must not rotate cookie",
  );
  for (const a of [alice, second, third]) assert.equal((await session(a)).data.user.id, aliceId);
});

check("P3 unchanged and too-short passwords are rejected; anonymous requests denied", async () => {
  for (const value of [oldPassword, "short"]) {
    assert.equal(
      (
        await request(alice, "/api/auth/password", "POST", {
          currentPassword: oldPassword,
          newPassword: value,
        })
      ).status,
      400,
    );
  }
  assert.equal(
    (
      await request(guest, "/api/auth/password", "POST", {
        currentPassword: oldPassword,
        newPassword,
      })
    ).status,
    401,
  );
  assert.equal((await list(alice)).data.sessions.length, 3);
});

check(
  "P4 UI password change rotates current cookie and invalidates every prior token",
  async () => {
    await currentPasswordField(alice).fill(oldPassword);
    await newPasswordField(alice).fill(newPassword);
    const response = alice.page.waitForResponse(
      (r) => r.url().endsWith("/api/auth/password") && r.request().method() === "POST",
    );
    await alice.page.getByRole("button", { name: "Update password", exact: true }).click();
    const changed = await response;
    assert.equal(changed.status(), 200);
    const data = await changed.json();
    assert.equal(data.revokedSessionCount, 2);
    assert(!("token" in data) && !("passwordHash" in data));
    assert(/no-store/.test(changed.headers()["cache-control"]));
    const next = await cookie(alice);
    assert(next && next.value !== originalCookie.value, "Current token must rotate");
    assert(next.httpOnly && next.secure && next.sameSite === "Lax" && next.path === "/");
    assert(
      next.expires <= originalCookie.expires + 1 && next.expires > Date.now() / 1000,
      "Rotation must not extend expiry",
    );
    assert(!(await alice.page.evaluate(() => document.cookie)).includes("nexus_session="));
    await expect(alice.page.locator("#settings-notice")).toContainText("Password changed.");
    await expect(rows(alice)).toHaveCount(1);
    assert((await currentPasswordField(alice).inputValue()) === "");
    assert((await newPasswordField(alice).inputValue()) === "");
    for (const a of [second, third]) assert.equal((await list(a)).status, 401);
    const replay = await actor();
    await replay.context.addCookies([originalCookie]);
    assert.equal((await list(replay)).status, 401);
    assert.equal((await session(replay)).data.authenticated, false);
    assert.equal((await session(alice)).data.user.id, aliceId);
    assert.equal((await session(bob)).data.user.id, bobId);
  },
);

check("P5 old password fails and new password signs in on another browser", async () => {
  assert.equal(
    (
      await request(guest, "/api/auth/login", "POST", {
        email: aliceInput.email,
        password: oldPassword,
      })
    ).status,
    401,
  );
  assert.equal((await session(guest)).data.authenticated, false);
  await login(guest);
  assert.equal((await list(alice)).data.sessions.length, 2);
});

check("P6 selected session is ended in UI and its cookie no longer authorizes", async () => {
  const target = (await list(guest)).data.sessions.find((s) => s.isCurrent).id;
  assert.equal(
    (await request(bob, "/api/auth/sessions", "DELETE", { sessionId: target, userId: aliceId }))
      .status,
    400,
  );
  assert.equal(
    (await request(bob, "/api/auth/sessions", "DELETE", { sessionId: target })).status,
    404,
  );
  assert.equal((await session(guest)).data.user.id, aliceId);
  await settings(alice);
  const response = alice.page.waitForResponse(
    (r) => r.url().endsWith("/api/auth/sessions") && r.request().method() === "DELETE",
  );
  await alice.page
    .locator(`[data-session-id="${target}"]`)
    .getByRole("button", { name: "End session", exact: true })
    .click();
  assert.equal((await response).status(), 200);
  await expect(alice.page.locator("#settings-notice")).toContainText("Session ended.");
  await expect(rows(alice)).toHaveCount(1);
  assert.equal((await list(guest)).status, 401);
  assert.equal((await session(bob)).data.user.id, bobId);
});

check("P7 end-other-sessions keeps this browser and invalidates both other cookies", async () => {
  await login(second);
  await login(third);
  await settings(alice);
  await expect(rows(alice)).toHaveCount(3);
  const response = alice.page.waitForResponse(
    (r) => r.url().endsWith("/api/auth/sessions") && r.request().method() === "DELETE",
  );
  await alice.page.getByRole("button", { name: "End other sessions", exact: true }).click();
  const ended = await response;
  assert.equal(ended.status(), 200);
  assert.equal((await ended.json()).revokedCount, 2);
  await expect(rows(alice)).toHaveCount(1);
  for (const a of [second, third]) assert.equal((await list(a)).status, 401);
  assert.equal((await session(alice)).data.user.id, aliceId);
  assert.equal((await session(bob)).data.user.id, bobId);
});

check(
  "P8 current and foreign sessions are protected and a body userId cannot target another password",
  async () => {
    const current = (await list(alice)).data.sessions.find((s) => s.isCurrent).id;
    assert.equal(
      (await request(alice, "/api/auth/sessions", "DELETE", { sessionId: current })).status,
      409,
    );
    assert.equal(
      (await request(bob, "/api/auth/sessions", "DELETE", { sessionId: current, userId: aliceId }))
        .status,
      400,
    );
    assert.equal(
      (await request(bob, "/api/auth/sessions", "DELETE", { sessionId: current })).status,
      404,
    );
    assert.equal(
      (
        await request(bob, "/api/auth/password", "POST", {
          userId: aliceId,
          currentPassword: newPassword,
          newPassword: secret(),
        })
      ).status,
      401,
    );
    assert.equal(
      (await request(guest, "/api/auth/sessions", "DELETE", { allOther: true })).status,
      401,
    );
    for (const [a, id] of [
      [alice, aliceId],
      [bob, bobId],
    ])
      assert.equal((await session(a)).data.user.id, id);
    await second.page.goto("/settings");
    await expect(
      second.page.getByRole("heading", { name: "Sign in required", exact: true }),
    ).toBeVisible();
    await expect(second.page.getByLabel("Current password", { exact: true })).toHaveCount(0);
  },
);

check("P9 narrow settings and keyboard password controls", async () => {
  await alice.page.setViewportSize({ width: 390, height: 844 });
  await settings(alice);
  await currentPasswordField(alice).focus();
  await alice.page.keyboard.press("Tab");
  await expect(newPasswordField(alice)).toBeFocused();
  await alice.page.keyboard.press("Tab");
  await expect(
    alice.page.getByRole("button", { name: "Update password", exact: true }),
  ).toBeFocused();
  assert(
    await alice.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    "Settings should not overflow horizontally",
  );
});

check("P10 explicit UI-only 503 injection offers retry rather than false sign-out", async () => {
  // This fault injection tests only the error view. Every successful auth/session
  // operation above uses the real server and database without response fixtures.
  await alice.context.route("**/api/auth/sessions", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Account settings are temporarily unavailable." }),
    }),
  );
  try {
    await alice.page.goto("/settings");
    await expect(
      alice.page.getByRole("heading", { name: "Account settings unavailable", exact: true }),
    ).toBeVisible();
    await expect(
      alice.page.getByRole("heading", { name: "Sign in required", exact: true }),
    ).toHaveCount(0);
  } finally {
    await alice.context.unroute("**/api/auth/sessions");
  }
  await alice.page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(alice.page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  assert.equal((await session(alice)).data.user.id, aliceId);
});

check("P11 agent-browser checks anonymous sign-in after security changes", async () => {
  const agent = join(process.env.NEXUS_BROWSER_TOOLS, "node_modules/.bin/agent-browser");
  const args = ["--cdp", "9222", "--session", "nexus-password"];
  try {
    await execute(agent, [...args, "open", `${baseURL}/auth/login`], { timeout: 30_000 });
    const snapshot = await execute(agent, [...args, "snapshot", "-i"], { timeout: 30_000 });
    // Input labels use CSS uppercase; agent-browser may expose "EMAIL ADDRESS".
    await writeFile(join(output, "password-agent-snapshot.txt"), snapshot.stdout);
    assert.match(snapshot.stdout, /email address/i, "login snapshot should expose the email field");
    assert.match(snapshot.stdout, /sign in/i, "login snapshot should expose the sign-in control");
    await execute(agent, [...args, "screenshot", join(output, "password-anonymous-login.png")], {
      timeout: 30_000,
    });
  } finally {
    await execute(agent, [...args, "close"], { timeout: 10_000 }).catch(() => {});
  }
});
