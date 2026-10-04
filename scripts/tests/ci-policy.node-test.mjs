import test from "node:test";
import assert from "node:assert/strict";
import { classifyChanges, requiredJobs, summarizeJobs } from "../ci-policy.mjs";

test("documentation does not trigger builds; executable docs/configuration do", () => {
  assert.deepEqual(classifyChanges(["README.md", "docs/OPERATIONS.md"]), { code: false, full: false });
  assert.deepEqual(classifyChanges(["docs/migration.sql"]), { code: true, full: false });
  assert.deepEqual(classifyChanges(["compose.production.yaml"]), { code: true, full: true });
});
test("application changes retain all mandatory fast gates", () => {
  const policy = classifyChanges(["apps/web/src/components/resource-download-button.tsx"]);
  assert.deepEqual(policy, { code: true, full: false });
  assert.deepEqual(requiredJobs(policy), ["plan", "unit", "verify", "image", "smoke"]);
});
test("migration, workflow and explicit release changes run full acceptance", () => {
  for (const files of [["packages/db/migrations/0027.sql"], [".github/workflows/ci.yml"], ["Dockerfile"]]) {
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
  const needs = Object.fromEntries(requiredJobs(policy).map(name => [name, { result: "success" }]));
  assert.equal(summarizeJobs(policy, needs).status, "PASS");
  for (const result of ["skipped", "failure", "cancelled"]) {
    const invalid = { ...needs, "resource-browser": { result } };
    assert.deepEqual(summarizeJobs(policy, invalid).failedOrMissing, ["resource-browser"]);
  }
});
