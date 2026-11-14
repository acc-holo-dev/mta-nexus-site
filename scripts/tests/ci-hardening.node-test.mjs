import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { classifyChanges, requiredJobs, summarizeJobs } from "../ci-policy.mjs";

test("dependency, runtime and trust-boundary changes require full acceptance", () => {
  for (const file of [
    ".nvmrc",
    ".node-version",
    "site/package.json",
    "site/packages/db/package.json",
    "site/packages/security/src/auth.ts",
    "site/packages/db/src/repositories/initiating-session.ts",
    "site/packages/db/src/repositories/commercial-plans.ts",
    "site/packages/db/src/repositories/order-operations.ts",
    "site/packages/db/src/repositories/subscriptions.ts",
    "site/packages/db/src/repositories/entitlements.ts",
    "site/packages/db/src/repositories/resource-cart.ts",
    "site/packages/db/src/repositories/community-reports.ts",
    "site/packages/db/src/repositories/notifications.ts",
    "site/packages/db/src/repositories/discussion-management.ts",
    "site/packages/db/src/repositories/organization-governance.ts",
    "site/packages/db/src/repositories/license-controls.ts",
    "site/packages/storage/src/local-provider.ts",
    "site/packages/config/src/env.ts",
    "site/next.config.mjs",
    "site/src/app/api/auth/login/route.ts",
    "site/src/lib/browser-request-policy.ts",
    "site/src/lib/browser-request-guard.ts",
    "site/src/lib/browser-route-adapter.ts",
    "site/src/lib/license-bearer-route-adapter.ts",
    "site/tests/unit/browser-api-route-inventory.test.ts",
    "site/src/features/resources/view.ts",
    "site/src/features/resources/client.ts",
    "site/src/features/resources/download.ts",
    "site/src/features/resources/release-watch.ts",
    "site/src/features/resources/media-server.ts",
    "site/src/features/resources/build-server.ts",
    "site/src/features/resources/components/resource-build-controls.tsx",
    "site/src/features/resources/components/build-moderation-controls.tsx",
    "site/src/features/resources/compatibility-controls.ts",
    "site/src/features/resources/variant-controls.ts",
    "site/src/features/resources/author-controls.ts",
    "site/src/features/resources/lifecycle-controls.ts",
    "site/src/features/resources/moderation-controls.ts",
    "site/src/features/resources/create-controls.ts",
    "site/src/features/resources/copy-controls.ts",
    "site/src/features/resources/copy-view.ts",
    "site/src/features/resources/publisher-view.ts",
    "site/src/features/resources/publisher-navigation.ts",
    "site/src/features/resources/components/resource-publication-readiness-panel.tsx",
    "site/src/features/resources/components/resource-version-help-support-link.tsx",
    "site/src/features/resources/server/build-screen.tsx",
    "site/src/features/resources/components/resource-media-editor.tsx",
    "site/src/features/resources/server/media-screen.tsx",
    "site/src/features/resources/components/resource-release-watch-control.tsx",
    "site/src/features/resources/components/resource-download-button.tsx",
    "site/src/features/resources/reviews-view.ts",
    "site/src/features/resources/review-controls.ts",
    "site/src/features/resources/detail-view.ts",
    "site/src/features/resources/components/product-dependency-list.tsx",
    "site/src/features/resources/components/resource-qa-report-form.tsx",
    "site/src/features/resources/components/resource-qa-panel.tsx",
    "site/src/features/resources/evidence.ts",
    "site/src/features/resources/components/resource-gallery-lightbox.tsx",
    "site/src/features/resources/model/build-provenance.ts",
    "site/src/features/resources/server.ts",
    "site/src/features/resources/detail-server.ts",
    "site/src/features/resources/versions-server.ts",
    "site/src/features/resources/reviews-server.ts",
    "site/src/features/resources/server/versions-page.tsx",
    "site/src/features/resources/server/reviews-page.tsx",
    "site/src/features/resources/server/detail-page.tsx",
    "site/src/features/resources/model.ts",
    "site/src/features/resources/components/product-card.tsx",
    "site/src/features/resources/model/market-query.ts",
    "site/src/features/servers/client.ts",
    "site/src/features/servers/server.ts",
    "site/src/features/servers/model.ts",
    "site/src/features/servers/components/server-card.tsx",
    "site/src/features/servers/model/mta-directory-page.ts",
  ]) {
    assert.deepEqual(classifyChanges([file]), { code: true, unitOnly: false, full: true }, file);
  }
  assert.deepEqual(classifyChanges(["site/src/components/server-card.tsx"]), {
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

test("OPS-10 workflow keeps packages:write only on gated ghcr-publish job", () => {
  const content = readFileSync(resolve(process.cwd(), ".github/workflows/ci.yml"), "utf8");
  const top = content.slice(0, content.indexOf("\njobs:"));
  assert.match(top, /^permissions:\n {2}contents: read$/mu);
  assert.doesNotMatch(top, /packages:\s*write/u);

  const start = content.indexOf("\n  ghcr-publish:\n");
  assert.ok(start >= 0, "ghcr-publish job must exist");
  const rest = content.slice(start + 1);
  const next = rest.search(/\n {2}[a-z0-9-]+:\n/u);
  const job = next >= 0 ? rest.slice(0, next) : rest;
  assert.match(job, /permissions:\n {6}contents: read\n {6}packages: write/u);
  assert.match(job, /github\.event_name != 'pull_request'/u);
  assert.match(
    job,
    /\(github\.event_name == 'push' \|\| github\.event_name == 'workflow_dispatch'\)/u,
  );
  assert.match(
    job,
    /\(github\.ref == 'refs\/heads\/main' \|\| startsWith\(github\.ref, 'refs\/tags\/v'\)\)/u,
  );
  assert.doesNotMatch(
    job,
    /startsWith\(github\.ref, 'refs\/tags\/v'\)\s*\|\|\s*github\.event_name/u,
  );
  assert.match(job, /needs\.plan\.outputs\.full == 'true'/u);
  assert.match(job, /needs\.plan\.result == 'success'/u);
  assert.match(job, /needs\.image\.result == 'success'/u);
  assert.match(job, /needs\.summary\.result == 'success'/u);
  assert.match(job, /vars\.NEXUS_GHCR_PUBLISH_ENABLED == 'true'/u);
  assert.match(job, /fail-on-cache-miss: true/u);
  assert.match(job, /validate-ci-image\.sh/u);
  assert.doesNotMatch(job, /docker build /u);
  assert.doesNotMatch(job, /build-push-action/u);
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
    assert.doesNotMatch(
      job,
      /^[ \t]+cache: pnpm$/mu,
      `${jobName} must not cache pnpm without install`,
    );
  }
});
