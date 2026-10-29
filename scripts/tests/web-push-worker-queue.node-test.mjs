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
    supportPending: 0,
    supportFailed: 0,
    supportOldestAgeSeconds: 0,
    verificationPending: 0,
    verificationFailed: 0,
    verificationOldestAgeSeconds: 0,
    discussionPending: 0,
    discussionFailed: 0,
    discussionOldestAgeSeconds: 0,
    admissionPending: 0,
    admissionFailed: 0,
    admissionOldestAgeSeconds: 0,
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
  assert.equal(value.admissionPending, 0);
  assert.equal(value.admissionFailed, 0);
  assert.equal(value.admissionOldestAgeSeconds, 0);
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

test("reports support fanout failures and backlog with configured thresholds without VAPID", () => {
  const thresholds = { pendingPercent: 80, dueJobs: 3, oldestAgeSeconds: 30 };
  const base = {
    configured: false,
    queuePending: 0,
    queueDue: 0,
    queueLeased: 0,
    queueAlertThresholds: thresholds,
  };
  assert.equal(
    run(snapshot({ ...base, supportPending: 2, supportOldestAgeSeconds: 29 })).status,
    0,
  );
  for (const support of [
    { supportPending: 3, supportOldestAgeSeconds: 0 },
    { supportPending: 1, supportOldestAgeSeconds: 30 },
  ]) {
    const result = run(
      snapshot({
        ...base,
        ...support,
        supportFailed: 1,
        queueAlert: "alert",
        queueAlertReasons: ["support_delivery_failed", "support_delivery_backlog"],
      }),
    );
    assert.equal(result.status, 2);
    const value = JSON.parse(result.stdout);
    assert.deepEqual(value.reasons, ["support_delivery_failed", "support_delivery_backlog"]);
    assert.equal(value.supportPending, support.supportPending);
    assert.equal(value.supportFailed, 1);
    assert.equal(value.supportOldestAgeSeconds, support.supportOldestAgeSeconds);
  }
});

test("reports verification fanout failures and backlog with configured thresholds without VAPID", () => {
  const thresholds = { pendingPercent: 80, dueJobs: 3, oldestAgeSeconds: 30 };
  const base = {
    configured: false,
    queuePending: 0,
    queueDue: 0,
    queueLeased: 0,
    queueAlertThresholds: thresholds,
  };
  assert.equal(
    run(snapshot({ ...base, verificationPending: 2, verificationOldestAgeSeconds: 29 })).status,
    0,
  );
  for (const verification of [
    { verificationPending: 3, verificationOldestAgeSeconds: 0 },
    { verificationPending: 1, verificationOldestAgeSeconds: 30 },
  ]) {
    const result = run(
      snapshot({
        ...base,
        ...verification,
        verificationFailed: 1,
        queueAlert: "alert",
        queueAlertReasons: ["verification_delivery_failed", "verification_delivery_backlog"],
      }),
    );
    assert.equal(result.status, 2);
    const value = JSON.parse(result.stdout);
    assert.deepEqual(value.reasons, [
      "verification_delivery_failed",
      "verification_delivery_backlog",
    ]);
    assert.equal(value.verificationPending, verification.verificationPending);
    assert.equal(value.verificationFailed, 1);
    assert.equal(value.verificationOldestAgeSeconds, verification.verificationOldestAgeSeconds);
  }
});

test("reports discussion fanout failures and backlog with configured thresholds without VAPID", () => {
  const thresholds = { pendingPercent: 80, dueJobs: 3, oldestAgeSeconds: 30 };
  const base = {
    configured: false,
    queuePending: 0,
    queueDue: 0,
    queueLeased: 0,
    queueAlertThresholds: thresholds,
  };
  assert.equal(
    run(snapshot({ ...base, discussionPending: 2, discussionOldestAgeSeconds: 29 })).status,
    0,
  );
  for (const discussion of [
    { discussionPending: 3, discussionOldestAgeSeconds: 0 },
    { discussionPending: 1, discussionOldestAgeSeconds: 30 },
  ]) {
    const result = run(
      snapshot({
        ...base,
        ...discussion,
        discussionFailed: 1,
        queueAlert: "alert",
        queueAlertReasons: ["discussion_delivery_failed", "discussion_delivery_backlog"],
      }),
    );
    assert.equal(result.status, 2);
    const value = JSON.parse(result.stdout);
    assert.deepEqual(value.reasons, ["discussion_delivery_failed", "discussion_delivery_backlog"]);
    assert.equal(value.discussionPending, discussion.discussionPending);
    assert.equal(value.discussionFailed, 1);
    assert.equal(value.discussionOldestAgeSeconds, discussion.discussionOldestAgeSeconds);
  }
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

test("alerts on admission recovery failure and age backlog without VAPID", () => {
  const result = run(
    snapshot({
      configured: false,
      queuePending: 0,
      queueDue: 0,
      queueLeased: 0,
      admissionPending: 2,
      admissionFailed: 1,
      admissionOldestAgeSeconds: 900,
      queueAlert: "alert",
      queueAlertReasons: ["admission_recovery_failed", "admission_recovery_backlog"],
    }),
  );
  assert.equal(result.status, 2);
  const value = JSON.parse(result.stdout);
  assert.deepEqual(value.reasons, ["admission_recovery_failed", "admission_recovery_backlog"]);
  assert.equal(value.admissionPending, 2);
  assert.equal(value.admissionFailed, 1);
  assert.equal(value.admissionOldestAgeSeconds, 900);
});

test("uses configured thresholds for admission recovery backlog", () => {
  const thresholds = { pendingPercent: 80, dueJobs: 3, oldestAgeSeconds: 30 };
  assert.equal(
    run(
      snapshot({
        admissionPending: 2,
        admissionOldestAgeSeconds: 29,
        queueAlertThresholds: thresholds,
      }),
    ).status,
    0,
  );
  for (const admission of [
    { admissionPending: 3, admissionOldestAgeSeconds: 0 },
    { admissionPending: 1, admissionOldestAgeSeconds: 30 },
  ]) {
    const result = run(
      snapshot({
        ...admission,
        queueAlertThresholds: thresholds,
        queueAlert: "alert",
        queueAlertReasons: ["admission_recovery_backlog"],
      }),
    );
    assert.equal(result.status, 2);
    assert.deepEqual(JSON.parse(result.stdout).reasons, ["admission_recovery_backlog"]);
  }
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
