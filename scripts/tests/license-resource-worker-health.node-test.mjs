import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const checkers = [
  {
    name: "license",
    script: new URL("../check-license-worker-health.mjs", import.meta.url),
    envKey: "NEXUS_LICENSE_HEALTH_FILE",
    readyMessage: /License worker ready/u,
    notReadyMessage: /License worker is not ready/u,
  },
  {
    name: "resource-release",
    script: new URL("../check-resource-release-worker-health.mjs", import.meta.url),
    envKey: "NEXUS_RESOURCE_RELEASE_HEALTH_FILE",
    readyMessage: /Resource release worker ready/u,
    notReadyMessage: /Resource release worker is not ready/u,
  },
];

function healthy(overrides = {}) {
  const now = new Date().toISOString();
  return {
    status: "ready",
    heartbeatAt: now,
    lastProgressAt: now,
    limit: 5,
    intervalMs: 5_000,
    ...overrides,
  };
}

function run(checker, payload) {
  const root = mkdtempSync(join(tmpdir(), `nexus-${checker.name}-health-`));
  const file = join(root, "health.json");
  try {
    if (payload !== undefined) {
      writeFileSync(file, typeof payload === "string" ? payload : JSON.stringify(payload));
    }
    const result = spawnSync(process.execPath, [checker.script.pathname], {
      encoding: "utf8",
      env: {
        ...process.env,
        [checker.envKey]: file,
      },
    });
    assert.ifError(result.error);
    return result;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

for (const checker of checkers) {
  test(`${checker.name}: accepts a fresh ready heartbeat`, () => {
    const result = run(checker, healthy());
    assert.equal(result.status, 0);
    assert.match(result.stdout, checker.readyMessage);
  });

  test(`${checker.name}: fails closed for missing, malformed and stale state`, () => {
    assert.notEqual(run(checker, undefined).status, 0);
    assert.notEqual(run(checker, "{broken").status, 0);
    assert.notEqual(run(checker, healthy({ status: "starting" })).status, 0);
    assert.notEqual(
      run(
        checker,
        healthy({
          heartbeatAt: new Date(Date.now() - 120_000).toISOString(),
        }),
      ).status,
      0,
    );
    assert.notEqual(
      run(
        checker,
        healthy({
          lastProgressAt: new Date(Date.now() - 120_000).toISOString(),
          limit: 1,
          intervalMs: 1_000,
        }),
      ).status,
      0,
    );
  });

  test(`${checker.name}: rejects impossible limit or interval metadata`, () => {
    assert.notEqual(run(checker, healthy({ limit: 0 })).status, 0);
    assert.notEqual(run(checker, healthy({ limit: 101 })).status, 0);
    assert.notEqual(run(checker, healthy({ intervalMs: 999 })).status, 0);
    assert.notEqual(run(checker, healthy({ intervalMs: 60_001 })).status, 0);
    const result = run(checker, healthy({ limit: "5" }));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, checker.notReadyMessage);
  });
}
