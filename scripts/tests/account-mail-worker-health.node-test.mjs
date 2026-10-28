import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const checker = new URL("../check-account-mail-worker-health.mjs", import.meta.url);

function healthy(overrides = {}) {
  const now = new Date().toISOString();
  return {
    status: "ready",
    config: "fixture",
    pid: 123,
    batch: 3,
    heartbeatAt: now,
    staleAfterMs: 60_000,
    progressAt: now,
    progressStaleAfterMs: 180_000,
    providerBlocked: false,
    providerBlockedUntil: null,
    providerFailureStreak: 0,
    queuePending: 2,
    queueDue: 1,
    queueLeased: 0,
    queueCapacity: 100,
    queueOldestAgeSeconds: 10,
    queuePressure: false,
    deliveryWindowMinutes: 30,
    deliveryAccepted: 1,
    deliveryRetried: 0,
    deliveryDiscarded: 0,
    deliveryProviderDeferred: 0,
    deliveryUncertain: 0,
    ...overrides,
  };
}

function run(payload) {
  const root = mkdtempSync(join(tmpdir(), "nexus-mail-health-"));
  const file = join(root, "health.json");
  try {
    writeFileSync(file, JSON.stringify(payload));
    const result = spawnSync(process.execPath, [checker.pathname], {
      encoding: "utf8",
      env: {
        ...process.env,
        NEXUS_ACCOUNT_MAIL_HEALTH_FILE: file,
      },
    });
    assert.ifError(result.error);
    return result.status;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("accepts fresh heartbeat and dispatcher progress", () => {
  assert.equal(run(healthy()), 0);
});

test("rejects fresh heartbeat with stale dispatcher progress", () => {
  assert.notEqual(
    run(
      healthy({
        progressAt: new Date(Date.now() - 240_000).toISOString(),
      }),
    ),
    0,
  );
});

test("accepts a scaled progress window for intentionally large batches", () => {
  assert.equal(
    run(
      healthy({
        progressAt: new Date(Date.now() - 240_000).toISOString(),
        progressStaleAfterMs: 300_000,
      }),
    ),
    0,
  );
});

test("rejects invalid or future progress metadata", () => {
  assert.notEqual(run(healthy({ progressStaleAfterMs: 60_000 })), 0);
  assert.notEqual(
    run(
      healthy({
        progressAt: new Date(Date.now() + 60_000).toISOString(),
      }),
    ),
    0,
  );
});
