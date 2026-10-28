import { readFile } from "node:fs/promises";

export const DEFAULT_WEB_PUSH_HEALTH_FILE = "/tmp/nexus-web-push-worker-health.json";

const ALERT_REASONS = [
  "delivery_disabled_with_pending_jobs",
  "capacity_pressure",
  "due_backlog",
  "oldest_job_age",
];

function inRange(value, min, max) {
  return Number.isSafeInteger(value) && value >= min && value <= max;
}

function expectedAlertReasons(input) {
  const reasons = [];
  if (!input.configured && input.queuePending > 0)
    reasons.push("delivery_disabled_with_pending_jobs");
  if (input.queuePending * 100 >= input.queueCapacity * input.queueAlertThresholds.pendingPercent)
    reasons.push("capacity_pressure");
  if (input.queueDue >= input.queueAlertThresholds.dueJobs) reasons.push("due_backlog");
  if (
    input.queuePending > 0 &&
    input.queueOldestAgeSeconds >= input.queueAlertThresholds.oldestAgeSeconds
  )
    reasons.push("oldest_job_age");
  return reasons;
}

export async function readWebPushWorkerHealthSnapshot(options = {}) {
  const healthFile =
    options.healthFile || process.env.NEXUS_WEB_PUSH_HEALTH_FILE || DEFAULT_WEB_PUSH_HEALTH_FILE;
  const now = options.now ?? Date.now();
  const data = JSON.parse(await readFile(healthFile, "utf8"));

  const heartbeatAt = Date.parse(data?.heartbeatAt);
  const staleAfterMs = Number(data?.staleAfterMs);
  const progressAt = Date.parse(data?.progressAt);
  const progressStaleAfterMs = Number(data?.progressStaleAfterMs);
  const pid = Number(data?.pid);
  const batch = Number(data?.batch);
  const configured = data?.configured;
  const queuePending = Number(data?.queuePending);
  const queueDue = Number(data?.queueDue);
  const queueLeased = Number(data?.queueLeased);
  const queueCapacity = Number(data?.queueCapacity);
  const queueOldestAgeSeconds = Number(data?.queueOldestAgeSeconds);
  const queueAlertThresholds = Object.freeze({
    pendingPercent: Number(data?.queueAlertThresholds?.pendingPercent),
    dueJobs: Number(data?.queueAlertThresholds?.dueJobs),
    oldestAgeSeconds: Number(data?.queueAlertThresholds?.oldestAgeSeconds),
  });

  const queueStateValid =
    [queuePending, queueDue, queueLeased, queueCapacity, queueOldestAgeSeconds].every(
      (value) => Number.isInteger(value) && value >= 0,
    ) &&
    queueCapacity >= 1 &&
    queueCapacity <= 50_000 &&
    queueDue <= queuePending &&
    queueLeased <= queuePending &&
    queuePending <= queueCapacity;

  const thresholdsValid =
    inRange(queueAlertThresholds.pendingPercent, 1, 99) &&
    inRange(queueAlertThresholds.dueJobs, 1, 50_000) &&
    inRange(queueAlertThresholds.oldestAgeSeconds, 1, 86_400);

  if (
    data?.status !== "ready" ||
    typeof configured !== "boolean" ||
    !Number.isFinite(heartbeatAt) ||
    !inRange(staleAfterMs, 30_000, 120_000) ||
    !Number.isFinite(progressAt) ||
    !inRange(progressStaleAfterMs, 120_000, 600_000) ||
    progressAt > heartbeatAt + 5_000 ||
    !Number.isSafeInteger(pid) ||
    pid < 1 ||
    !Number.isSafeInteger(batch) ||
    batch < 0 ||
    !queueStateValid ||
    !thresholdsValid ||
    now - heartbeatAt > staleAfterMs ||
    now - progressAt > progressStaleAfterMs
  ) {
    throw new Error("Invalid Web Push worker health snapshot");
  }

  const expectedReasons = expectedAlertReasons({
    configured,
    queuePending,
    queueDue,
    queueCapacity,
    queueOldestAgeSeconds,
    queueAlertThresholds,
  });
  const expectedStatus = expectedReasons.length > 0 ? "alert" : "ok";
  const reasons = data?.queueAlertReasons;
  if (
    data?.queueAlert !== expectedStatus ||
    !Array.isArray(reasons) ||
    reasons.length !== expectedReasons.length ||
    reasons.some(
      (reason, index) =>
        typeof reason !== "string" ||
        !ALERT_REASONS.includes(reason) ||
        reason !== expectedReasons[index],
    )
  ) {
    throw new Error("Invalid Web Push worker alert metadata");
  }

  return Object.freeze({
    configured,
    pid,
    batch,
    heartbeatAt: new Date(heartbeatAt).toISOString(),
    staleAfterMs,
    progressAt: new Date(progressAt).toISOString(),
    progressStaleAfterMs,
    queuePending,
    queueDue,
    queueLeased,
    queueCapacity,
    queueOldestAgeSeconds,
    queueAlert: expectedStatus,
    queueAlertReasons: Object.freeze([...reasons]),
    queueAlertThresholds,
  });
}
