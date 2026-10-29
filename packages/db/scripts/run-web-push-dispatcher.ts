import { rename, rm, writeFile } from "node:fs/promises";
import { readWebPushVapidConfig } from "@nexus/config";
import {
  checkDatabaseConnection,
  closeDatabaseConnection,
  createWebPushHttpSender,
  reportNotificationDeliveryRepository,
  supportNotificationDeliveryRepository,
  WebPushDispatcher,
  webPushAdmissionRecoveryRepository,
  webPushOutboxRepository,
  webPushWorkerRepository,
} from "../src/index";

const HEALTH_FILE =
  process.env.NEXUS_WEB_PUSH_HEALTH_FILE || "/tmp/nexus-web-push-worker-health.json";
const HEALTH_TMP = `${HEALTH_FILE}.${process.pid}.tmp`;
const HEARTBEAT_INTERVAL_MS = 15_000;
const STALE_AFTER_MS = 60_000;
const LOOP_STALL_AFTER_MS = 180_000;
const POLL_INTERVAL_MS = 2_000;
const BATCH_SIZE = 20;

function readQueueAlertThreshold(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  if (!/^[0-9]+$/u.test(raw)) {
    throw new Error("Invalid Web Push queue alert configuration");
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error("Invalid Web Push queue alert configuration");
  }
  return value;
}

const QUEUE_ALERT_PENDING_PERCENT = readQueueAlertThreshold(
  "WEB_PUSH_QUEUE_ALERT_PENDING_PERCENT",
  80,
  1,
  99,
);
const QUEUE_ALERT_DUE_JOBS = readQueueAlertThreshold(
  "WEB_PUSH_QUEUE_ALERT_DUE_JOBS",
  100,
  1,
  50_000,
);
const QUEUE_ALERT_OLDEST_AGE_SECONDS = readQueueAlertThreshold(
  "WEB_PUSH_QUEUE_ALERT_OLDEST_AGE_SECONDS",
  900,
  1,
  86_400,
);

type QueueAlertReason =
  | "delivery_disabled_with_pending_jobs"
  | "capacity_pressure"
  | "due_backlog"
  | "oldest_job_age"
  | "report_delivery_failed"
  | "report_delivery_backlog"
  | "support_delivery_failed"
  | "support_delivery_backlog"
  | "admission_recovery_failed"
  | "admission_recovery_backlog";

const controller = new AbortController();
let stopping = false;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let watchdogTimer: ReturnType<typeof setInterval> | null = null;
let healthWrite: Promise<void> = Promise.resolve();
let healthFailure: unknown = null;
let healthStatus: "starting" | "ready" | "stopping" = "starting";
let configured = false;
let healthBatch = 0;
let lastProgressAt = Date.now();
let healthQueuePending = 0;
let healthQueueDue = 0;
let healthQueueLeased = 0;
let healthQueueCapacity = 0;
let healthQueueOldestAgeSeconds = 0;
let reportPending = 0;
let reportFailed = 0;
let reportOldestAgeSeconds = 0;
let supportPending = 0;
let supportFailed = 0;
let supportOldestAgeSeconds = 0;
let admissionPending = 0;
let admissionFailed = 0;
let admissionOldestAgeSeconds = 0;
let healthQueueAlertReasons: QueueAlertReason[] = [];
let lastQueueAlertSignature = "";

function emit(event: Record<string, unknown>) {
  process.stdout.write(`${JSON.stringify(event)}\n`);
}

function markProgress() {
  lastProgressAt = Date.now();
}

function failIfLoopStalled() {
  if (stopping || Date.now() - lastProgressAt <= LOOP_STALL_AFTER_MS) {
    return;
  }

  process.stderr.write(
    `${JSON.stringify({
      status: "failed",
      reason: "loop-stalled",
      configured,
      batch: healthBatch,
    })}\n`,
  );
  process.exit(1);
}

function queueAlertThresholds() {
  return {
    pendingPercent: QUEUE_ALERT_PENDING_PERCENT,
    dueJobs: QUEUE_ALERT_DUE_JOBS,
    oldestAgeSeconds: QUEUE_ALERT_OLDEST_AGE_SECONDS,
  };
}

function updateQueueAlertState() {
  const reasons: QueueAlertReason[] = [];
  if (!configured && healthQueuePending > 0) reasons.push("delivery_disabled_with_pending_jobs");
  if (healthQueuePending * 100 >= healthQueueCapacity * QUEUE_ALERT_PENDING_PERCENT)
    reasons.push("capacity_pressure");
  if (healthQueueDue >= QUEUE_ALERT_DUE_JOBS) reasons.push("due_backlog");
  if (healthQueuePending > 0 && healthQueueOldestAgeSeconds >= QUEUE_ALERT_OLDEST_AGE_SECONDS)
    reasons.push("oldest_job_age");
  if (reportFailed > 0) reasons.push("report_delivery_failed");
  if (
    reportPending >= QUEUE_ALERT_DUE_JOBS ||
    (reportPending > 0 && reportOldestAgeSeconds >= QUEUE_ALERT_OLDEST_AGE_SECONDS)
  )
    reasons.push("report_delivery_backlog");
  if (supportFailed > 0) reasons.push("support_delivery_failed");
  if (
    supportPending >= QUEUE_ALERT_DUE_JOBS ||
    (supportPending > 0 && supportOldestAgeSeconds >= QUEUE_ALERT_OLDEST_AGE_SECONDS)
  )
    reasons.push("support_delivery_backlog");
  if (admissionFailed > 0) reasons.push("admission_recovery_failed");
  if (
    admissionPending >= QUEUE_ALERT_DUE_JOBS ||
    (admissionPending > 0 && admissionOldestAgeSeconds >= QUEUE_ALERT_OLDEST_AGE_SECONDS)
  )
    reasons.push("admission_recovery_backlog");

  const previousSignature = lastQueueAlertSignature;
  const nextSignature = reasons.join(",");
  healthQueueAlertReasons = reasons;
  lastQueueAlertSignature = nextSignature;
  if (nextSignature === previousSignature) return;

  const queue = {
    configured,
    queuePending: healthQueuePending,
    queueDue: healthQueueDue,
    queueLeased: healthQueueLeased,
    queueCapacity: healthQueueCapacity,
    queueOldestAgeSeconds: healthQueueOldestAgeSeconds,
    reportPending,
    reportFailed,
    reportOldestAgeSeconds,
    supportPending,
    supportFailed,
    supportOldestAgeSeconds,
    admissionPending,
    admissionFailed,
    admissionOldestAgeSeconds,
    thresholds: queueAlertThresholds(),
  };
  if (reasons.length > 0) emit({ status: "queue-alert", reasons, ...queue });
  else if (previousSignature) emit({ status: "queue-recovered", ...queue });
}

function stop(signal: "SIGTERM" | "SIGINT") {
  if (stopping) return;
  stopping = true;
  healthStatus = "stopping";
  emit({ status: "stopping", signal });
  controller.abort();
}

process.once("SIGTERM", () => stop("SIGTERM"));
process.once("SIGINT", () => stop("SIGINT"));

async function writeHealthSnapshot() {
  const payload = JSON.stringify({
    status: healthStatus,
    configured,
    pid: process.pid,
    batch: healthBatch,
    heartbeatAt: new Date().toISOString(),
    staleAfterMs: STALE_AFTER_MS,
    progressAt: new Date(lastProgressAt).toISOString(),
    progressStaleAfterMs: LOOP_STALL_AFTER_MS,
    queuePending: healthQueuePending,
    queueDue: healthQueueDue,
    queueLeased: healthQueueLeased,
    queueCapacity: healthQueueCapacity,
    queueOldestAgeSeconds: healthQueueOldestAgeSeconds,
    reportPending,
    reportFailed,
    reportOldestAgeSeconds,
    supportPending,
    supportFailed,
    supportOldestAgeSeconds,
    admissionPending,
    admissionFailed,
    admissionOldestAgeSeconds,
    queueAlert: healthQueueAlertReasons.length > 0 ? "alert" : "ok",
    queueAlertReasons: healthQueueAlertReasons,
    queueAlertThresholds: queueAlertThresholds(),
  });
  await writeFile(HEALTH_TMP, payload, {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(HEALTH_TMP, HEALTH_FILE);
}

function queueHealth(): Promise<void> {
  const next = healthWrite.then(writeHealthSnapshot);
  healthWrite = next.catch((error) => {
    healthFailure = error;
    healthStatus = "stopping";
    controller.abort();
  });
  return next;
}

async function refreshQueueStats() {
  const stats = await webPushOutboxRepository.stats();
  healthQueuePending = stats.pending;
  healthQueueDue = stats.due;
  healthQueueLeased = stats.leased;
  healthQueueCapacity = stats.capacity;
  healthQueueOldestAgeSeconds = stats.oldestAgeSeconds;
  const reports = await reportNotificationDeliveryRepository.stats();
  reportPending = reports.pending;
  reportFailed = reports.failed;
  reportOldestAgeSeconds = reports.oldestAgeSeconds;
  const support = await supportNotificationDeliveryRepository.stats();
  supportPending = support.pending;
  supportFailed = support.failed;
  supportOldestAgeSeconds = support.oldestAgeSeconds;
  const admissions = await webPushAdmissionRecoveryRepository.stats();
  admissionPending = admissions.pending;
  admissionFailed = admissions.failed;
  admissionOldestAgeSeconds = admissions.oldestAgeSeconds;
  updateQueueAlertState();
}

async function delay(ms: number, signal: AbortSignal) {
  if (signal.aborted) return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(done, ms);
    const abort = () => done();

    function done() {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      resolve();
    }

    signal.addEventListener("abort", abort, { once: true });
  });
}

let failed = false;
watchdogTimer = setInterval(failIfLoopStalled, HEARTBEAT_INTERVAL_MS);
watchdogTimer.unref();

try {
  const vapid = readWebPushVapidConfig();
  configured = vapid !== null;

  await queueHealth();
  await checkDatabaseConnection();
  await refreshQueueStats();
  markProgress();

  const dispatcher = vapid
    ? new WebPushDispatcher({
        sender: createWebPushHttpSender(vapid, {
          timeoutMs: 5_000,
          ttlSeconds: 300,
        }),
      })
    : null;

  healthStatus = "ready";
  await queueHealth();

  if (process.argv.includes("--ready")) {
    emit({ status: "ready", configured });
  }

  heartbeatTimer = setInterval(() => {
    void queueHealth().catch(() => {
      // queueHealth records the failure and aborts the main loop. Consume the
      // timer promise so a health-file write failure cannot become an
      // unhandled rejection before the structured shutdown path runs.
    });
  }, HEARTBEAT_INTERVAL_MS);
  heartbeatTimer.unref();

  const once = process.argv.includes("--once");
  while (!controller.signal.aborted) {
    healthBatch += 1;
    let activity = 0;

    const reports = await reportNotificationDeliveryRepository.processNext(BATCH_SIZE);
    if (reports.state !== "idle") {
      activity += 1;
      emit({ status: "report-delivery", batch: healthBatch, ...reports });
    }
    markProgress();
    if (controller.signal.aborted) break;

    const support = await supportNotificationDeliveryRepository.processNext(BATCH_SIZE);
    if (support.state !== "idle") {
      activity += 1;
      emit({ status: "support-delivery", batch: healthBatch, ...support });
    }
    markProgress();
    if (controller.signal.aborted) break;

    const admission = await webPushAdmissionRecoveryRepository.processNext();
    if (admission.state !== "idle") {
      activity += 1;
      emit({
        status: "push-admission-recovery",
        batch: healthBatch,
        state: admission.state,
        pushJobs: admission.pushJobs,
      });
    }
    markProgress();
    if (controller.signal.aborted) break;

    if (dispatcher) {
      const result = await dispatcher.runBatch(BATCH_SIZE, controller.signal, markProgress);
      activity +=
        result.accepted +
        result.retried +
        result.discarded +
        result.stale +
        result.skipped +
        result.unsettled +
        result.cleaned;

      if (activity > 0) {
        emit({
          status: "batch",
          batch: healthBatch,
          ...result,
        });
      }
    } else {
      const cleaned = await webPushWorkerRepository.discardUnavailable(BATCH_SIZE);
      activity += cleaned;
      if (cleaned > 0) {
        emit({
          status: "maintenance",
          batch: healthBatch,
          cleaned,
          configured: false,
        });
      }
    }

    await refreshQueueStats();
    markProgress();
    await queueHealth();

    if (once) break;
    await delay(activity > 0 ? 250 : POLL_INTERVAL_MS, controller.signal);
  }

  await healthWrite;
  if (healthFailure) {
    throw new Error("Web Push worker heartbeat failed");
  }

  emit({
    status: "stopped",
    configured,
    batches: healthBatch,
  });
} catch {
  failed = true;
  process.stderr.write(`${JSON.stringify({ status: "failed", configured })}\n`);
  process.exitCode = 1;
} finally {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = null;
  if (watchdogTimer) clearInterval(watchdogTimer);
  watchdogTimer = null;

  try {
    await healthWrite;
  } catch {
    // Generic failure event above is the public diagnostic.
  }

  try {
    await rm(HEALTH_TMP, { force: true });
    await rm(HEALTH_FILE, { force: true });
  } catch {
    if (!failed) process.exitCode = 1;
  }

  try {
    await closeDatabaseConnection();
  } catch {
    if (!failed) process.exitCode = 1;
  }
}
