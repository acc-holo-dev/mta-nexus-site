import { readFile } from "node:fs/promises";

export const DEFAULT_WEB_PUSH_HEALTH_FILE = "/tmp/nexus-web-push-worker-health.json";

const ALERT_REASONS = [
  "delivery_disabled_with_pending_jobs",
  "capacity_pressure",
  "due_backlog",
  "oldest_job_age",
  "report_delivery_failed",
  "report_delivery_backlog",
  "support_delivery_failed",
  "support_delivery_backlog",
  "admission_recovery_failed",
  "admission_recovery_backlog",
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
  if (input.reportFailed > 0) reasons.push("report_delivery_failed");
  if (
    input.reportPending >= input.queueAlertThresholds.dueJobs ||
    (input.reportPending > 0 &&
      input.reportOldestAgeSeconds >= input.queueAlertThresholds.oldestAgeSeconds)
  )
    reasons.push("report_delivery_backlog");
  if (input.supportFailed > 0) reasons.push("support_delivery_failed");
  if (
    input.supportPending >= input.queueAlertThresholds.dueJobs ||
    (input.supportPending > 0 &&
      input.supportOldestAgeSeconds >= input.queueAlertThresholds.oldestAgeSeconds)
  )
    reasons.push("support_delivery_backlog");
  if (input.admissionFailed > 0) reasons.push("admission_recovery_failed");
  if (
    input.admissionPending >= input.queueAlertThresholds.dueJobs ||
    (input.admissionPending > 0 &&
      input.admissionOldestAgeSeconds >= input.queueAlertThresholds.oldestAgeSeconds)
  )
    reasons.push("admission_recovery_backlog");
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
  const reportPending = Number(data?.reportPending);
  const reportFailed = Number(data?.reportFailed);
  const reportOldestAgeSeconds = Number(data?.reportOldestAgeSeconds);
  const supportPending = data?.supportPending;
  const supportFailed = data?.supportFailed;
  const supportOldestAgeSeconds = data?.supportOldestAgeSeconds;
  const admissionPending = data?.admissionPending;
  const admissionFailed = data?.admissionFailed;
  const admissionOldestAgeSeconds = data?.admissionOldestAgeSeconds;
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
  const reportStateValid = [reportPending, reportFailed, reportOldestAgeSeconds].every(
    (value) => Number.isSafeInteger(value) && value >= 0,
  );
  const supportStateValid = [supportPending, supportFailed, supportOldestAgeSeconds].every(
    (value) => Number.isSafeInteger(value) && value >= 0,
  );
  const admissionStateValid = [admissionPending, admissionFailed, admissionOldestAgeSeconds].every(
    (value) => Number.isSafeInteger(value) && value >= 0,
  );

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
    !reportStateValid ||
    !supportStateValid ||
    !admissionStateValid ||
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
    reportPending,
    reportFailed,
    reportOldestAgeSeconds,
    supportPending,
    supportFailed,
    supportOldestAgeSeconds,
    admissionPending,
    admissionFailed,
    admissionOldestAgeSeconds,
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
    reportPending,
    reportFailed,
    reportOldestAgeSeconds,
    supportPending,
    supportFailed,
    supportOldestAgeSeconds,
    admissionPending,
    admissionFailed,
    admissionOldestAgeSeconds,
    queueAlert: expectedStatus,
    queueAlertReasons: Object.freeze([...reasons]),
    queueAlertThresholds,
  });
}
