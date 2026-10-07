import { rename, rm, writeFile } from "node:fs/promises";
import { readWebPushVapidConfig } from "@nexus/config";
import {
  checkDatabaseConnection,
  closeDatabaseConnection,
  createWebPushHttpSender,
  WebPushDispatcher,
  webPushOutboxRepository,
} from "../src/index";

const HEALTH_FILE = "/tmp/nexus-web-push-worker-health.json";
const HEALTH_TMP = `${HEALTH_FILE}.${process.pid}.tmp`;
const HEARTBEAT_INTERVAL_MS = 15_000;
const STALE_AFTER_MS = 60_000;
const POLL_INTERVAL_MS = 2_000;
const BATCH_SIZE = 20;

const controller = new AbortController();
let stopping = false;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let healthWrite: Promise<void> = Promise.resolve();
let healthFailure: unknown = null;
let healthStatus: "starting" | "ready" | "stopping" = "starting";
let configured = false;
let healthBatch = 0;
let healthQueuePending = 0;
let healthQueueDue = 0;
let healthQueueLeased = 0;
let healthQueueCapacity = 0;
let healthQueueOldestAgeSeconds = 0;

function emit(event: Record<string, unknown>) {
  process.stdout.write(`${JSON.stringify(event)}\n`);
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
    queuePending: healthQueuePending,
    queueDue: healthQueueDue,
    queueLeased: healthQueueLeased,
    queueCapacity: healthQueueCapacity,
    queueOldestAgeSeconds: healthQueueOldestAgeSeconds,
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
}

async function delay(ms: number, signal: AbortSignal) {
  if (signal.aborted) return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    const abort = () => {
      clearTimeout(timer);
      resolve();
    };
    signal.addEventListener("abort", abort, { once: true });
  });
}

let failed = false;
try {
  const vapid = readWebPushVapidConfig();
  configured = vapid !== null;

  await queueHealth();
  await checkDatabaseConnection();
  await refreshQueueStats();

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
    void queueHealth();
  }, HEARTBEAT_INTERVAL_MS);
  heartbeatTimer.unref();

  const once = process.argv.includes("--once");
  while (!controller.signal.aborted) {
    healthBatch += 1;
    let activity = 0;

    if (dispatcher) {
      const result = await dispatcher.runBatch(
        BATCH_SIZE,
        controller.signal,
      );
      activity =
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
    }

    await refreshQueueStats();
    await queueHealth();

    if (once) break;
    await delay(
      activity > 0 ? 250 : POLL_INTERVAL_MS,
      controller.signal,
    );
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
  process.stderr.write(
    `${JSON.stringify({ status: "failed", configured })}\n`,
  );
  process.exitCode = 1;
} finally {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = null;

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
