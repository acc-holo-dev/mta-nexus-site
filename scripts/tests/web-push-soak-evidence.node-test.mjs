import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

function evidence(overrides = {}) {
  const core = {
    schemaVersion: 1,
    kind: "web_push_production_duration_soak",
    generatedAt: "2026-10-08T00:00:00.000Z",
    fixture: {
      namespace: "fixture",
      notifications: 10,
      subscriptions: 2,
      jobs: 20,
      waves: 5,
    },
    configuration: {
      durationMs: 60_000,
    },
    timing: {
      durationTargetMs: 60_000,
      durationActualMs: 60_100,
      drainMs: 5_000,
    },
    delivery: {
      acceptedUnique: 20,
      duplicateAccepts: 0,
    },
    queue: {
      finalFixturePending: 0,
    },
    verdict: {
      passed: true,
      failures: [],
    },
    cleanup: {
      attempted: true,
      succeeded: true,
    },
    runtime: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    ...overrides,
  };
  return {
    ...core,
    evidenceSha256: createHash("sha256").update(JSON.stringify(core)).digest("hex"),
  };
}

function run(value) {
  const directory = mkdtempSync(join(tmpdir(), "nexus-push-soak-evidence-"));
  const path = join(directory, "evidence.json");
  writeFileSync(path, JSON.stringify(value));
  const result = spawnSync(process.execPath, ["scripts/check-web-push-soak-evidence.mjs", path], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  rmSync(directory, { recursive: true, force: true });
  return result;
}

test("accepts complete untampered soak evidence", () => {
  const result = run(evidence());
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /passed jobs=20/u);
});

test("rejects tampered evidence", () => {
  const value = evidence();
  value.fixture.jobs = 21;
  const result = run(value);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /checksum mismatch/u);
});

test("rejects evidence without proven fixture cleanup", () => {
  const value = evidence({
    cleanup: {
      attempted: true,
      succeeded: false,
    },
  });
  const result = run(value);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /cleanup was not proven/u);
});

test("rejects a failed or undrained soak", () => {
  const failed = evidence({
    verdict: {
      passed: false,
      failures: ["fixture_queue_not_drained"],
    },
    queue: {
      finalFixturePending: 1,
    },
  });
  const result = run(failed);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /verdict is not passed/u);
});
