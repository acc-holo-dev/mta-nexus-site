import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const checker = new URL("../check-web-push-worker-queue.mjs", import.meta.url);

function snapshot(overrides = {}) {
  return {
    status: "ready",
    configured: true,
    pid: 123,
    batch: 8,
    heartbeatAt: new Date().toISOString(),
    staleAfterMs: 60_000,
    progressAt: new Date().toISOString(),
    progressStaleAfterMs: 180_000,
    queuePending: 4,
    queueDue: 2,
    queueLeased: 1,
    queueCapacity: 10_000,
    queueOldestAgeSeconds: 12,
    reportPending: 0,
    reportFailed: 0,
    reportOldestAgeSeconds: 0,
    queueAlert: "ok",
    queueAlertReasons: [],
    queueAlertThresholds: { pendingPercent: 80, dueJobs: 100, oldestAgeSeconds: 900 },
    ...overrides,
  };
}

function run(payload) {
  const root = mkdtempSync(join(tmpdir(), "nexus-web-push-alert-"));
  const file = join(root, "health.json");
  try {
    writeFileSync(file, JSON.stringify(payload));
    const result = spawnSync(process.execPath, [checker.pathname], {
      encoding: "utf8",
      env: { ...process.env, NEXUS_WEB_PUSH_HEALTH_FILE: file },
    });
    assert.ifError(result.error);
    return result;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("returns zero and aggregate diagnostics for a healthy queue", () => {
  const payload = snapshot();
  const result = run(payload);
  assert.equal(result.status, 0);
  const value = JSON.parse(result.stdout);
  assert.equal(value.status, "ok");
  assert.deepEqual(value.reasons, []);
  assert.equal(value.heartbeatAt, payload.heartbeatAt);
  assert.equal(value.progressStaleAfterMs, 180_000);
  assert.equal(typeof value.progressAt, "string");
  assert.equal("endpoint" in value, false);
  assert.equal("payload" in value, false);
});

test("returns alert exit code for backlog pressure", () => {
  const result = run(
    snapshot({
      queuePending: 8_000,
      queueDue: 100,
      queueOldestAgeSeconds: 900,
      queueAlert: "alert",
      queueAlertReasons: ["capacity_pressure", "due_backlog", "oldest_job_age"],
    }),
  );
  assert.equal(result.status, 2);
});

test("alerts when delivery is disabled while jobs remain", () => {
  const result = run(
    snapshot({
      configured: false,
      queuePending: 1,
      queueDue: 0,
      queueLeased: 0,
      queueAlert: "alert",
      queueAlertReasons: ["delivery_disabled_with_pending_jobs"],
    }),
  );
  assert.equal(result.status, 2);
});

test("alerts on report fanout failures and backlog even without VAPID", () => {
  const result = run(
    snapshot({
      configured: false,
      queuePending: 0,
      queueDue: 0,
      queueLeased: 0,
      reportPending: 2,
      reportFailed: 1,
      reportOldestAgeSeconds: 900,
      queueAlert: "alert",
      queueAlertReasons: ["report_delivery_failed", "report_delivery_backlog"],
    }),
  );
  assert.equal(result.status, 2);
  const value = JSON.parse(result.stdout);
  assert.equal(value.reportPending, 2);
  assert.equal(value.reportFailed, 1);
  assert.equal(value.reportOldestAgeSeconds, 900);
});

test("fails closed for stale or inconsistent snapshot", () => {
  assert.equal(
    run(
      snapshot({
        heartbeatAt: new Date(Date.now() - 120_000).toISOString(),
      }),
    ).status,
    1,
  );
  assert.equal(run(snapshot({ queuePending: 8_000 })).status, 1);
});

test("fails queue probe when worker heartbeat is fresh but loop progress is stale", () => {
  assert.equal(
    run(
      snapshot({
        progressAt: new Date(Date.now() - 240_000).toISOString(),
      }),
    ).status,
    1,
  );
});

test("reports an alert, not invalid state, at exactly full queue capacity", () => {
  const result = run(
    snapshot({
      queuePending: 100,
      queueDue: 100,
      queueLeased: 0,
      queueCapacity: 100,
      queueAlert: "alert",
      queueAlertReasons: ["capacity_pressure", "due_backlog"],
    }),
  );
  assert.equal(result.status, 2);
  const value = JSON.parse(result.stdout);
  assert.equal(value.status, "alert");
  assert.deepEqual(value.reasons, ["capacity_pressure", "due_backlog"]);
});

test("fails closed when queue counters exceed configured capacity", () => {
  assert.equal(
    run(
      snapshot({
        queuePending: 101,
        queueDue: 100,
        queueCapacity: 100,
        queueAlert: "alert",
        queueAlertReasons: ["capacity_pressure", "due_backlog"],
      }),
    ).status,
    1,
  );
});
