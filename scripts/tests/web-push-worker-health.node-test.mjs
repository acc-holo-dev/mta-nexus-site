import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const checker = new URL(
  "../check-web-push-worker-health.mjs",
  import.meta.url,
);

function run(payload) {
  const root = mkdtempSync(
    join(tmpdir(), "nexus-web-push-health-"),
  );
  const file = join(root, "health.json");
  try {
    if (payload !== undefined) {
      writeFileSync(
        file,
        typeof payload === "string"
          ? payload
          : JSON.stringify(payload),
      );
    }
    const result = spawnSync(
      process.execPath,
      [checker.pathname],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          NEXUS_WEB_PUSH_HEALTH_FILE: file,
        },
      },
    );
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
        queueAlertReasons: [
          "capacity_pressure",
          "due_backlog",
          "oldest_job_age",
        ],
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
        heartbeatAt: new Date(
          Date.now() - 120_000,
        ).toISOString(),
      }),
    ),
    0,
  );
});

test("rejects impossible queue counters and invalid capacity", () => {
  assert.notEqual(
    run(healthy({ queueDue: 5, queuePending: 4 })),
    0,
  );
  assert.notEqual(
    run(healthy({ queueLeased: 5, queuePending: 4 })),
    0,
  );
  assert.notEqual(
    run(healthy({ queueCapacity: 50_001 })),
    0,
  );
  assert.notEqual(
    run(healthy({ configured: "true" })),
    0,
  );
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
        queueAlertReasons: [
          "capacity_pressure",
          "due_backlog",
        ],
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
        progressAt: new Date(
          Date.now() - 240_000,
        ).toISOString(),
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
        progressAt: new Date(
          Date.now() + 60_000,
        ).toISOString(),
      }),
    ),
    0,
  );
});
