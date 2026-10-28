import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

function build(overrides = {}) {
  const core = {
    schemaVersion: 1,
    kind: "web_push_live_provider_probe",
    generatedAt: "2026-10-08T00:00:00.000Z",
    target: {
      origin: "https://push.example.test",
      endpointSha256: "a".repeat(64),
    },
    vapid: {
      publicKeySha256: "b".repeat(64),
      subjectScheme: "mailto",
    },
    request: {
      timeoutMs: 15_000,
      ttlSeconds: 60,
    },
    response: {
      statusCode: 201,
      retryAfterMs: null,
      errorClass: null,
      durationMs: 120,
    },
    verdict: {
      passed: true,
      failures: [],
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
  const directory = mkdtempSync(join(tmpdir(), "nexus-push-provider-evidence-"));
  const path = join(directory, "evidence.json");
  writeFileSync(path, JSON.stringify(value));
  const result = spawnSync(
    process.execPath,
    ["scripts/check-web-push-provider-evidence.mjs", path],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );
  rmSync(directory, { recursive: true, force: true });
  return result;
}

test("accepts sanitized successful provider evidence", () => {
  const result = run(build());
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /http=201/u);
});

test("rejects non-2xx provider evidence", () => {
  const result = run(
    build({
      response: {
        statusCode: 503,
        retryAfterMs: 1_000,
        errorClass: null,
        durationMs: 100,
      },
      verdict: {
        passed: false,
        failures: ["provider_status_503"],
      },
    }),
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /accepted 2xx/u);
});

test("rejects capability material in evidence even with a valid checksum", () => {
  const result = run(
    build({
      debug: {
        endpoint: "https://push.example.test/secret-token",
      },
    }),
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /sensitive capability fields/u);
});

test("rejects tampered provider evidence", () => {
  const value = build();
  value.response.statusCode = 202;
  const result = run(value);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /checksum mismatch/u);
});
