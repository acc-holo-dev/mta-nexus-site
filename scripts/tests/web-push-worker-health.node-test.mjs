import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const checker = new URL("../check-web-push-worker-health.mjs", import.meta.url);

function run(payload) {
  const root = mkdtempSync(join(tmpdir(), "nexus-web-push-health-"));
  const file = join(root, "health.json");
  try {
    if (payload !== undefined) {
      writeFileSync(file, typeof payload === "string" ? payload : JSON.stringify(payload));
    }
    const result = spawnSync(process.execPath, [checker.pathname], {
      encoding: "utf8",
      env: {
        ...process.env,
        NEXUS_WEB_PUSH_HEALTH_FILE: file,
      },
    });
    assert.ifError(result.error);
    return result.status;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function healthy(overrides = {}) {
  return {
    status: "ready",
    configured: true,
    pid: 123,
    batch: 2,
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
    queueAlertThresholds: {
      pendingPercent: 80,
      dueJobs: 100,
      oldestAgeSeconds: 900,
    },
    ...overrides,
  };
}

test("accepts a fresh, internally consistent worker heartbeat", () => {
  assert.equal(run(healthy()), 0);
  assert.equal(
    run(
      healthy({
        configured: false,
        queuePending: 0,
        queueDue: 0,
        queueLeased: 0,
        queueOldestAgeSeconds: 0,
      }),
    ),
    0,
  );
});

test("accepts queue alerts without converting backlog pressure into liveness failure", () => {
  assert.equal(
    run(
      healthy({
        queuePending: 8_000,
        queueDue: 100,
        queueOldestAgeSeconds: 900,
        queueAlert: "alert",
        queueAlertReasons: ["capacity_pressure", "due_backlog", "oldest_job_age"],
      }),
    ),
    0,
  );
});

test("fails closed for missing, malformed and stale heartbeat state", () => {
  assert.notEqual(run(undefined), 0);
  assert.notEqual(run("{broken"), 0);
  assert.notEqual(
    run(
      healthy({
        heartbeatAt: new Date(Date.now() - 120_000).toISOString(),
      }),
    ),
    0,
  );
});

test("keeps admission recovery alerts live without VAPID", () => {
  assert.equal(
    run(
      healthy({
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
    ),
    0,
  );
});

test("validates support fanout counters and alerts without VAPID", () => {
  assert.equal(
    run(
      healthy({
        configured: false,
        queuePending: 0,
        queueDue: 0,
        queueLeased: 0,
        supportPending: 2,
        supportFailed: 1,
        supportOldestAgeSeconds: 900,
        queueAlert: "alert",
        queueAlertReasons: ["support_delivery_failed", "support_delivery_backlog"],
      }),
    ),
    0,
  );
  for (const overrides of [
    { supportPending: undefined },
    { supportFailed: null },
    { supportOldestAgeSeconds: "0" },
    { supportPending: -1 },
    { supportFailed: 0.5 },
    { supportOldestAgeSeconds: Number.MAX_SAFE_INTEGER + 1 },
    { supportFailed: 1 },
    { supportPending: 100 },
    { supportPending: 1, supportOldestAgeSeconds: 900 },
    { queueAlert: "alert", queueAlertReasons: ["support_delivery_failed"] },
    {
      supportFailed: 1,
      queueAlert: "alert",
      queueAlertReasons: ["support_delivery_failed", "support_delivery_failed"],
    },
  ]) {
    assert.equal(run(healthy(overrides)), 1, JSON.stringify(overrides));
  }
});

test("validates verification fanout counters and alerts without VAPID", () => {
  assert.equal(
    run(
      healthy({
        configured: false,
        queuePending: 0,
        queueDue: 0,
        queueLeased: 0,
        verificationPending: 2,
        verificationFailed: 1,
        verificationOldestAgeSeconds: 900,
        queueAlert: "alert",
        queueAlertReasons: ["verification_delivery_failed", "verification_delivery_backlog"],
      }),
    ),
    0,
  );
  for (const overrides of [
    { verificationPending: undefined },
    { verificationFailed: null },
    { verificationOldestAgeSeconds: "0" },
    { verificationPending: -1 },
    { verificationFailed: 0.5 },
    { verificationOldestAgeSeconds: Number.MAX_SAFE_INTEGER + 1 },
    { verificationFailed: 1 },
    { verificationPending: 100 },
    { verificationPending: 1, verificationOldestAgeSeconds: 900 },
    { queueAlert: "alert", queueAlertReasons: ["verification_delivery_failed"] },
    {
      verificationFailed: 1,
      queueAlert: "alert",
      queueAlertReasons: ["verification_delivery_failed", "verification_delivery_failed"],
    },
  ]) {
    assert.equal(run(healthy(overrides)), 1, JSON.stringify(overrides));
  }
});

test("validates discussion fanout counters and alerts without VAPID", () => {
  assert.equal(
    run(
      healthy({
        configured: false,
        queuePending: 0,
        queueDue: 0,
        queueLeased: 0,
        discussionPending: 2,
        discussionFailed: 1,
        discussionOldestAgeSeconds: 900,
        queueAlert: "alert",
        queueAlertReasons: ["discussion_delivery_failed", "discussion_delivery_backlog"],
      }),
    ),
    0,
  );
  for (const overrides of [
    { discussionPending: undefined },
    { discussionFailed: null },
    { discussionOldestAgeSeconds: "0" },
    { discussionPending: -1 },
    { discussionFailed: 0.5 },
    { discussionOldestAgeSeconds: Number.MAX_SAFE_INTEGER + 1 },
    { discussionFailed: 1 },
    { discussionPending: 100 },
    { discussionPending: 1, discussionOldestAgeSeconds: 900 },
    { queueAlert: "alert", queueAlertReasons: ["discussion_delivery_failed"] },
    {
      discussionFailed: 1,
      queueAlert: "alert",
      queueAlertReasons: ["discussion_delivery_failed", "discussion_delivery_failed"],
    },
  ]) {
    assert.equal(run(healthy(overrides)), 1, JSON.stringify(overrides));
  }
});

test("rejects missing and forged admission recovery counters", () => {
  for (const overrides of [
    { admissionPending: undefined },
    { admissionFailed: undefined },
    { admissionOldestAgeSeconds: undefined },
    { admissionPending: null },
    { admissionPending: "0" },
    { admissionFailed: -1 },
    { admissionFailed: Number.POSITIVE_INFINITY },
    { admissionOldestAgeSeconds: 0.5 },
    { admissionOldestAgeSeconds: Number.MAX_SAFE_INTEGER + 1 },
  ]) {
    assert.equal(run(healthy(overrides)), 1, JSON.stringify(overrides));
  }
});

test("rejects omitted, invented and duplicated admission alert reasons", () => {
  for (const overrides of [
    { admissionFailed: 1 },
    { admissionPending: 100 },
    { admissionPending: 1, admissionOldestAgeSeconds: 900 },
    { queueAlert: "alert", queueAlertReasons: ["admission_recovery_failed"] },
    {
      admissionFailed: 1,
      queueAlert: "alert",
      queueAlertReasons: ["admission_recovery_failed", "admission_recovery_failed"],
    },
  ]) {
    assert.equal(run(healthy(overrides)), 1, JSON.stringify(overrides));
  }
});

test("rejects impossible queue counters and invalid capacity", () => {
  assert.notEqual(run(healthy({ queueDue: 5, queuePending: 4 })), 0);
  assert.notEqual(
    run(
      healthy({
        queuePending: 101,
        queueDue: 100,
        queueCapacity: 100,
        queueAlert: "alert",
        queueAlertReasons: ["capacity_pressure", "due_backlog"],
      }),
    ),
    0,
  );
  assert.notEqual(run(healthy({ queueLeased: 5, queuePending: 4 })), 0);
  assert.notEqual(run(healthy({ queueCapacity: 50_001 })), 0);
  assert.notEqual(run(healthy({ configured: "true" })), 0);
  assert.notEqual(run(healthy({ reportPending: undefined })), 0);
  assert.notEqual(run(healthy({ reportFailed: -1 })), 0);
  assert.notEqual(run(healthy({ reportOldestAgeSeconds: "invalid" })), 0);
});

test("rejects inconsistent queue alert metadata", () => {
  assert.notEqual(run(healthy({ queuePending: 8_000 })), 0);
  assert.notEqual(
    run(
      healthy({
        queueAlert: "alert",
        queueAlertReasons: ["due_backlog"],
      }),
    ),
    0,
  );
});

test("reports capacity pressure without invalidating a full durable queue", () => {
  assert.equal(
    run(
      healthy({
        queuePending: 100,
        queueDue: 100,
        queueLeased: 0,
        queueCapacity: 100,
        queueOldestAgeSeconds: 10,
        queueAlert: "alert",
        queueAlertReasons: ["capacity_pressure", "due_backlog"],
      }),
    ),
    0,
  );
});

test("fails closed when heartbeat is fresh but dispatcher progress is stale", () => {
  assert.notEqual(
    run(
      healthy({
        heartbeatAt: new Date().toISOString(),
        progressAt: new Date(Date.now() - 240_000).toISOString(),
      }),
    ),
    0,
  );
});

test("rejects impossible progress metadata", () => {
  assert.notEqual(
    run(
      healthy({
        progressStaleAfterMs: 60_000,
      }),
    ),
    0,
  );
  assert.notEqual(
    run(
      healthy({
        progressAt: new Date(Date.now() + 60_000).toISOString(),
      }),
    ),
    0,
  );
});
