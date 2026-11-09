import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  classifyChanges,
  ghcrPublishJobPermissions,
  isTrustedGhcrPublishEvent,
  requiredJobs,
  summarizeJobs,
} from "../ci-policy.mjs";

test("documentation does not trigger builds; executable docs/configuration do", () => {
  assert.deepEqual(classifyChanges(["README.md", "docs/OPERATIONS.md"]), {
    code: false,
    unitOnly: false,
    full: false,
  });
  assert.deepEqual(
    classifyChanges(["docs/handbook/13-DECISION-REGISTER.md", "docs/handbook/deep/note.md"]),
    { code: false, unitOnly: false, full: false },
  );
  assert.deepEqual(
    classifyChanges([
      "AGENTS.md",
      "docs/AGENT.md",
      "planning/tasks.json",
      "planning/milestones.json",
    ]),
    { code: false, unitOnly: false, full: false },
  );
  assert.deepEqual(classifyChanges(["docs/handbook/schema.sql", "docs/handbook/.config.yml"]), {
    code: true,
    unitOnly: false,
    full: false,
  });
  assert.deepEqual(classifyChanges(["docs/migration.sql"]), {
    code: true,
    unitOnly: false,
    full: false,
  });
  assert.deepEqual(classifyChanges(["compose.production.yaml"]), {
    code: true,
    unitOnly: false,
    full: true,
  });
});

test("shared UI and web component changes use the unit CI profile", () => {
  const policy = classifyChanges([
    "packages/ui/src/button.tsx",
    "apps/web/src/components/resource-download-button.tsx",
    "apps/web/src/components/resource-download-button.test.tsx",
    "docs/OPERATIONS.md",
  ]);
  assert.deepEqual(policy, { code: true, unitOnly: true, full: false });
  assert.deepEqual(requiredJobs(policy), ["plan", "unit"]);
  assert.equal(
    summarizeJobs(policy, { plan: { result: "success" }, unit: { result: "success" } }).scope,
    "unit_ci",
  );
});

test("unknown or mixed application paths never claim unit_only", () => {
  assert.equal(
    classifyChanges(["apps/web/src/components/button.tsx", "apps/web/src/app/api/health/route.ts"])
      .unitOnly,
    false,
  );
  assert.equal(classifyChanges(["apps/web/src/lib/services/auth-service.ts"]).unitOnly, false);
  assert.equal(classifyChanges(["mystery/new-tool.sh"]).unitOnly, false);
  assert.equal(classifyChanges(["packages/domain/src/entities.ts"]).unitOnly, false);
});

test("application changes retain all mandatory fast gates", () => {
  const policy = classifyChanges([
    "apps/web/src/components/resource-download-button.tsx",
    "apps/web/src/lib/i18n.ts",
  ]);
  assert.deepEqual(policy, { code: true, unitOnly: false, full: false });
  assert.deepEqual(requiredJobs(policy), ["plan", "unit", "verify", "image", "smoke"]);
});

test("migration, database tooling, workflow and explicit release changes run full acceptance", () => {
  for (const files of [
    ["packages/db/migrations/0027.sql"],
    ["packages/db/scripts/check-release-upgrade.mjs"],
    ["packages/db/src/schema.ts"],
    ["packages/db/src/account-mail-schema.ts"],
    ["packages/db/src/repositories/security-schema.ts"],
    ["packages/db/src/nested/migrate.ts"],
    ["packages/db/src/migrate.ts"],
    ["packages/db/src/repositories/library-collections.ts"],
    ["packages/db/src/repositories/library-collection-command.ts"],
    ["packages/db/src/repositories/library-collection-internals.ts"],
    ["packages/db/src/repositories/library-membership-batches.ts"],
    ["packages/db/src/repositories/library-selection-batches.ts"],
    ["packages/db/src/repositories/resource-library-selections.ts"],
    ["packages/db/src/repositories/resource-release-watches.ts"],
    ["packages/db/src/repositories/resource-release-watch-batches.ts"],
    ["packages/db/src/repositories/collection-release-watches.ts"],
    ["packages/db/src/repositories/support.ts"],
    ["packages/db/src/repositories/support-notification-delivery.ts"],
    ...[
      "organization-workspace",
      "follow-workspace",
      "product-mutation-authority",
      "products",
      "content-creation-authority",
      "resource-qa",
      "resource-reviews",
      "builds-moderation",
      "web-push-subscriptions",
      "support-access",
      "support-activity",
      "support-message-discovery",
    ].map((name) => [`packages/db/src/repositories/${name}.ts`]),
    ...[
      "follow/route.ts",
      "object-mute/route.ts",
      "products/route.ts",
      "support/[id]/route.ts",
      "workspace/organizations/route.ts",
      "workspace/reports/route.ts",
    ].map((name) => [`apps/web/src/app/api/${name}`]),
    ...[
      "web-push-admission-recovery",
      "web-push-outbox",
      "web-push-worker",
      "report-notification-delivery",
      "verification-notification-delivery",
      "discussion-notification-delivery",
      "publication-notification-delivery",
      "user-follow-notice",
      "resource-release-worker",
      "support-requester-notice",
      "verification",
      "discussion-moderation-notice",
      "publication-notice",
      "organization-access-notice",
      "license-maintenance",
      "content-reaction-notice",
      "builds",
    ].map((name) => [`packages/db/src/repositories/${name}.ts`]),
    [".github/workflows/ci.yml"],
    ["Dockerfile"],
    ["tests/unit/mainline-repository-policy.test.ts"],
  ]) {
    const policy = classifyChanges(files);
    assert.equal(policy.full, true);
    assert.equal(policy.unitOnly, false);
  }
  for (const option of [{ explicitFull: true }, { release: true }]) {
    const policy = classifyChanges([], option);
    assert.equal(policy.code, true);
    assert.equal(policy.full, true);
    assert.equal(policy.unitOnly, false);
    assert(requiredJobs(policy).includes("resource-browser"));
  }
  assert.deepEqual(classifyChanges([], { mainPush: true }), {
    code: false,
    unitOnly: false,
    full: false,
  });
  assert.deepEqual(classifyChanges(["docs/CURRENT-STATE.md"], { mainPush: true }), {
    code: false,
    unitOnly: false,
    full: false,
  });
  assert.deepEqual(classifyChanges(["apps/web/src/app/page.tsx"], { mainPush: true }), {
    code: true,
    unitOnly: false,
    full: true,
  });
});

test("main CI keeps in-flight runs and does not cancel tip documentation merges", () => {
  const workflow = readFileSync(resolve(process.cwd(), ".github/workflows/ci.yml"), "utf8");
  assert.match(
    workflow,
    /cancel-in-progress:\s*\$\{\{\s*github\.ref\s*!=\s*'refs\/heads\/main'\s*\}\}/,
  );
});

test("skipped or missing required gates never report successful acceptance", () => {
  const policy = { code: true, unitOnly: false, full: true };
  const needs = Object.fromEntries(
    requiredJobs(policy).map((name) => [name, { result: "success" }]),
  );
  assert.equal(summarizeJobs(policy, needs).status, "PASS");
  for (const result of ["skipped", "failure", "cancelled"]) {
    const invalid = { ...needs, "resource-browser": { result } };
    assert.deepEqual(summarizeJobs(policy, invalid).failedOrMissing, ["resource-browser"]);
  }
  const unitPolicy = { code: true, unitOnly: true, full: false };
  assert.deepEqual(
    summarizeJobs(unitPolicy, { plan: { result: "success" }, unit: { result: "skipped" } })
      .failedOrMissing,
    ["unit"],
  );
});

test("expensive production startup waits for core verification", () => {
  const workflow = readFileSync(resolve(process.cwd(), ".github/workflows/ci.yml"), "utf8");
  const start = workflow.indexOf("  production-compose:");
  const end = workflow.indexOf("  mail-worker:", start);
  assert.ok(start >= 0 && end > start);
  const section = workflow.slice(start, end);
  for (const gate of ["plan", "unit", "verify", "image"]) {
    // Biome YAML may indent sequence entries under `needs:` (6 spaces) vs flat 4.
    assert.match(section, new RegExp(`^\\s+- ${gate}$`, "m"));
  }
  assert.match(section, /needs\.plan\.outputs\.full == 'true'/u);
});

test("unit_only skips database image and smoke without skipping plan or unit", () => {
  const workflow = readFileSync(resolve(process.cwd(), ".github/workflows/ci.yml"), "utf8");
  assert.match(workflow, /unit_only: \$\{\{ steps\.scope\.outputs\.unit_only \}\}/u);
  assert.match(
    workflow,
    /needs\.plan\.outputs\.code == 'true' && needs\.plan\.outputs\.unit_only != 'true'/u,
  );
  const unitJob = workflow.slice(workflow.indexOf("  unit:"), workflow.indexOf("  verify:"));
  assert.match(unitJob, /needs\.plan\.outputs\.code == 'true'/u);
  assert.doesNotMatch(unitJob, /unit_only/u);
});

test("OPS-10 trusted GHCR publish requires full_acceptance and never trusts pull_request", () => {
  assert.equal(
    isTrustedGhcrPublishEvent({
      eventName: "pull_request",
      ref: "refs/heads/main",
      fullAcceptance: true,
      publishEnabled: true,
    }),
    false,
  );
  assert.equal(
    isTrustedGhcrPublishEvent({
      eventName: "push",
      ref: "refs/heads/main",
      fullAcceptance: true,
      publishEnabled: false,
    }),
    false,
  );
  assert.equal(
    isTrustedGhcrPublishEvent({
      eventName: "push",
      ref: "refs/heads/main",
      fullAcceptance: false,
      publishEnabled: true,
    }),
    false,
  );
  assert.equal(
    isTrustedGhcrPublishEvent({
      eventName: "push",
      ref: "refs/heads/main",
      fullAcceptance: true,
      publishEnabled: true,
    }),
    true,
  );
  assert.deepEqual(ghcrPublishJobPermissions({ trustedPublish: false }), {
    contents: "read",
  });
  assert.deepEqual(ghcrPublishJobPermissions({ trustedPublish: true }), {
    contents: "read",
    packages: "write",
  });
});

test("GHCR publish only trusts main or version tags for push and manual runs", () => {
  const gates = { fullAcceptance: true, publishEnabled: true };
  for (const eventName of ["push", "workflow_dispatch"]) {
    for (const ref of ["refs/heads/main", "refs/tags/v1.2.3"]) {
      assert.equal(
        isTrustedGhcrPublishEvent({ eventName, ref, ...gates }),
        true,
        `${eventName} ${ref}`,
      );
    }
    for (const ref of ["refs/heads/feature", "refs/tags/dev", "refs/pull/1/merge", ""]) {
      assert.equal(
        isTrustedGhcrPublishEvent({ eventName, ref, refType: "tag", ...gates }),
        false,
        `${eventName} ${ref}`,
      );
    }
  }
  assert.equal(
    isTrustedGhcrPublishEvent({ eventName: "schedule", ref: "refs/heads/main", ...gates }),
    false,
  );
});
