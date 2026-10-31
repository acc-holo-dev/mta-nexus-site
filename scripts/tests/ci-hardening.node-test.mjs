import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { classifyChanges, requiredJobs, summarizeJobs } from "../ci-policy.mjs";

test("dependency, runtime and trust-boundary changes require full acceptance", () => {
  for (const file of [
    ".nvmrc",
    ".node-version",
    "apps/web/package.json",
    "packages/db/package.json",
    "packages/security/src/auth.ts",
    "packages/db/src/repositories/initiating-session.ts",
    "packages/db/src/repositories/commercial-plans.ts",
    "packages/db/src/repositories/order-operations.ts",
    "packages/db/src/repositories/subscriptions.ts",
    "packages/db/src/repositories/entitlements.ts",
    "packages/db/src/repositories/resource-cart.ts",
    "packages/db/src/repositories/community-reports.ts",
    "packages/db/src/repositories/notifications.ts",
    "packages/db/src/repositories/discussion-management.ts",
    "packages/db/src/repositories/organization-governance.ts",
    "packages/db/src/repositories/license-controls.ts",
    "packages/storage/src/local-provider.ts",
    "packages/config/src/env.ts",
    "apps/web/next.config.mjs",
    "apps/web/src/app/api/auth/login/route.ts",
    "apps/web/src/lib/browser-request-policy.ts",
    "apps/web/src/lib/browser-request-guard.ts",
    "apps/web/src/lib/browser-route-adapter.ts",
    "apps/web/src/lib/license-bearer-route-adapter.ts",
    "tests/browser-api-route-inventory.test.ts",
  ]) {
    assert.deepEqual(classifyChanges([file]), { code: true, unitOnly: false, full: true }, file);
  }
  assert.deepEqual(classifyChanges(["apps/web/src/components/server-card.tsx"]), {
    code: true,
    unitOnly: true,
    full: false,
  });
  assert.deepEqual(classifyChanges(["docs/handbook/notes.md"]), {
    code: false,
    unitOnly: false,
    full: false,
  });
});

test("inconsistent full acceptance cannot pass with only plan", () => {
  const result = summarizeJobs({ code: false, full: true }, { plan: { result: "success" } });
  assert.equal(result.status, "FAIL");
  assert.deepEqual(result.failedOrMissing, requiredJobs({ code: true, full: true }).slice(1));
});

test("workflow Node versions use the same repository pin", () => {
  const root = resolve(process.cwd());
  const pinned = readFileSync(resolve(root, ".nvmrc"), "utf8").trim();
  assert.match(pinned, /^\d+\.\d+\.\d+$/u);
  assert.equal(readFileSync(resolve(root, ".node-version"), "utf8").trim(), pinned);
  for (const name of ["ci", "auth-browser", "directory-browser", "resource-browser"]) {
    const file = `.github/workflows/${name}.yml`;
    const content = readFileSync(resolve(root, file), "utf8");
    const setups = content.match(/^[ \t]+uses: actions\/setup-node@v\d+$/gmu) ?? [];
    const pins = content.match(/^[ \t]+node-version-file: \.nvmrc$/gmu) ?? [];
    assert.ok(setups.length > 0, file);
    assert.equal(pins.length, setups.length, file);
    assert.doesNotMatch(content, /^[ \t]+node-version:/mu, file);
  }
});

test("pnpm install jobs enable setup-node cache only after pnpm/action-setup", () => {
  const content = readFileSync(resolve(process.cwd(), ".github/workflows/ci.yml"), "utf8");
  // Split on top-level jobs (two-space indent). Keep jobs that run workspace installs.
  const jobs = content.split(/\n {2}[a-z0-9-]+:\n/u).slice(1);
  const installJobs = jobs.filter((job) => /pnpm install --frozen-lockfile/u.test(job));
  assert.equal(installJobs.length, 3, "unit, verify, and mail-worker install the workspace");
  for (const job of installJobs) {
    const pnpmSetup = job.search(/uses: pnpm\/action-setup@/u);
    const nodeSetup = job.search(/uses: actions\/setup-node@/u);
    const cachePnpm = job.search(/^[ \t]+cache: pnpm$/mu);
    assert.ok(pnpmSetup >= 0, "install job must install pnpm before caching");
    assert.ok(nodeSetup > pnpmSetup, "setup-node must follow pnpm/action-setup");
    assert.ok(cachePnpm > nodeSetup, "cache: pnpm must be under that setup-node step");
  }
  // Jobs that only run Node scripts must not invent a pnpm store cache without an install.
  for (const jobName of ["plan:", "summary:", "smoke:", "postgres-persistence:"]) {
    const marker = `\n  ${jobName}\n`;
    const start = content.indexOf(marker);
    assert.ok(start >= 0, jobName);
    const rest = content.slice(start + 1);
    const next = rest.search(/\n {2}[a-z0-9-]+:\n/u);
    const job = next >= 0 ? rest.slice(0, next) : rest;
    assert.doesNotMatch(job, /^[ \t]+cache: pnpm$/mu, `${jobName} must not cache pnpm without install`);
  }
});
