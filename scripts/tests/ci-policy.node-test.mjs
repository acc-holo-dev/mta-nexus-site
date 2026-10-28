import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { classifyChanges, requiredJobs, summarizeJobs } from "../ci-policy.mjs";

test("documentation does not trigger builds; executable docs/configuration do", () => {
  assert.deepEqual(classifyChanges(["README.md", "docs/OPERATIONS.md"]), {
    code: false,
    full: false,
  });
  assert.deepEqual(
    classifyChanges(["docs/handbook/13-DECISION-REGISTER.md", "docs/handbook/deep/note.md"]),
    { code: false, full: false },
  );
  assert.deepEqual(classifyChanges(["docs/handbook/schema.sql", "docs/handbook/.config.yml"]), {
    code: true,
    full: false,
  });
  assert.deepEqual(classifyChanges(["docs/migration.sql"]), { code: true, full: false });
  assert.deepEqual(classifyChanges(["compose.production.yaml"]), { code: true, full: true });
});
test("application changes retain all mandatory fast gates", () => {
  const policy = classifyChanges(["apps/web/src/components/resource-download-button.tsx"]);
  assert.deepEqual(policy, { code: true, full: false });
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
    [".github/workflows/ci.yml"],
    ["Dockerfile"],
    ["tests/mainline-repository-policy.test.ts"],
  ]) {
    assert.equal(classifyChanges(files).full, true);
  }
  for (const option of [{ explicitFull: true }, { release: true }]) {
    const policy = classifyChanges([], option);
    assert.equal(policy.code, true);
    assert.equal(policy.full, true);
    assert(requiredJobs(policy).includes("resource-browser"));
  }
});
test("skipped or missing required gates never report successful acceptance", () => {
  const policy = { code: true, full: true };
  const needs = Object.fromEntries(
    requiredJobs(policy).map((name) => [name, { result: "success" }]),
  );
  assert.equal(summarizeJobs(policy, needs).status, "PASS");
  for (const result of ["skipped", "failure", "cancelled"]) {
    const invalid = { ...needs, "resource-browser": { result } };
    assert.deepEqual(summarizeJobs(policy, invalid).failedOrMissing, ["resource-browser"]);
  }
});

test("expensive production startup waits for core verification", () => {
  const workflow = readFileSync(resolve(process.cwd(), ".github/workflows/ci.yml"), "utf8");
  const start = workflow.indexOf("  production-compose:");
  const end = workflow.indexOf("  mail-worker:", start);
  assert.ok(start >= 0 && end > start);
  const section = workflow.slice(start, end);
  for (const gate of ["plan", "unit", "verify", "image"]) {
    assert.match(section, new RegExp(`^    - ${gate}$`, "m"));
  }
  assert.match(section, /needs\.plan\.outputs\.full == 'true'/u);
});
