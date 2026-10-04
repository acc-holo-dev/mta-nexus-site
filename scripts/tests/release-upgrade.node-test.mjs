import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const script = "packages/db/scripts/check-release-upgrade.mjs";
const ci = {
  GITHUB_ACTIONS: "true",
  RUNNER_ENVIRONMENT: "github-hosted",
  NODE_ENV: "test",
  DATABASE_URL: "postgres://nexus:never-print-this-secret@localhost/mta_nexus_test",
};

for (const [name, overrides, expected] of [
  ["local runner", { GITHUB_ACTIONS: "false" }, "requires hosted CI"],
  ["self-hosted runner", { RUNNER_ENVIRONMENT: "self-hosted" }, "requires hosted CI"],
  ["production configuration", { NODE_ENV: "production" }, "requires test configuration"],
  ["remote database", { DATABASE_URL: "postgres://nexus:never-print-this-secret@production.invalid/mta_nexus_test" }, "Only loopback PostgreSQL"],
  ["different database", { DATABASE_URL: "postgres://nexus:never-print-this-secret@localhost/production" }, "Only the disposable CI service"],
]) {
  test(`upgrade rehearsal refuses ${name} before connecting`, () => {
    const result = spawnSync(process.execPath, [script], {
      env: { PATH: process.env.PATH, ...ci, ...overrides },
      encoding: "utf8",
      timeout: 10_000,
    });
    assert.equal(result.error, undefined);
    assert.notEqual(result.status, 0);
    assert(result.stderr.includes(expected));
    assert(!result.stderr.includes("never-print-this-secret"));
    assert(!result.stderr.includes("ECONNREFUSED"));
    assert.equal(result.stdout, "");
  });
}
