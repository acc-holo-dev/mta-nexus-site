import { rename, rm, writeFile } from "node:fs/promises";
import { checkDatabaseConnection, closeDatabaseConnection } from "../src/client";
import { accountMailOutboxRepository } from "../src/repositories/account-mail-outbox";
import { accountMailWorkerRepository } from "../src/repositories/account-mail-worker";
import { accountRecoveryAbuseLimitRepository } from "../src/repositories/account-recovery-abuse";
import {
  createAccountMailDispatcher,
  readAccountMailRuntimeConfig,
  runAccountMailLoop,
  runtimeFingerprint,
} from "../src/repositories/account-mail-runtime";

const HEALTH_FILE = "/tmp/nexus-account-mail-worker-health.json";
const HEALTH_TMP = `${HEALTH_FILE}.${process.pid}.tmp`;
const HEARTBEAT_INTERVAL_MS = 15_000;
const STALE_AFTER_MS = 60_000;

const controller = new AbortController();
let stopping = false;
let fingerprint = "";
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let healthWrite: Promise<void> = Promise.resolve();
let healthFailure: unknown = null;
let healthStatus: "starting" | "ready" = "starting";
let healthBatch = 0;
let healthProviderBlocked = false;
let healthProviderBlockedUntil: string | null = null;
let healthProviderFailureStreak = 0;
let healthQueuePending = 0;
let healthQueueDue = 0;
let healthQueueLeased = 0;
let healthQueueCapacity = 0;
let healthQueueOldestAgeSeconds = 0;
let healthQueuePressure = false;
let healthDeliveryWindowMinutes = 30;
let healthDeliveryAccepted = 0;
let healthDeliveryRetried = 0;
let healthDeliveryDiscarded = 0;
let healthDeliveryProviderDeferred = 0;
let healthDeliveryUncertain = 0;
let nextAbuseCleanupAt = 0;

function emit(event: Record<string, unknown>) {
  process.stdout.write(JSON.stringify(event) + "\n");
}

function stop(signal: "SIGTERM" | "SIGINT") {
  if (stopping) return;
  stopping = true;
  emit({ status: "stopping", signal });
  controller.abort();
}

process.once("SIGTERM", () => stop("SIGTERM"));
process.once("SIGINT", () => stop("SIGINT"));

const writeHealthSnapshot = async () => {
  const payload = JSON.stringify({
    status: healthStatus,
    config: fingerprint,
    pid: process.pid,
    batch: healthBatch,
    heartbeatAt: new Date().toISOString(),
    staleAfterMs: STALE_AFTER_MS,
    providerBlocked: healthProviderBlocked,
    providerBlockedUntil: healthProviderBlockedUntil,
    providerFailureStreak: healthProviderFailureStreak,
    queuePending: healthQueuePending,
    queueDue: healthQueueDue,
    queueLeased: healthQueueLeased,
    queueCapacity: healthQueueCapacity,
    queueOldestAgeSeconds: healthQueueOldestAgeSeconds,
    queuePressure: healthQueuePressure,
    deliveryWindowMinutes: healthDeliveryWindowMinutes,
    deliveryAccepted: healthDeliveryAccepted,
    deliveryRetried: healthDeliveryRetried,
    deliveryDiscarded: healthDeliveryDiscarded,
    deliveryProviderDeferred: healthDeliveryProviderDeferred,
    deliveryUncertain: healthDeliveryUncertain,
  });
  await writeFile(HEALTH_TMP, payload, { encoding: "utf8", mode: 0o600 });
  await rename(HEALTH_TMP, HEALTH_FILE);
};

const queueHealth = (): Promise<void> => {
  const next = healthWrite.then(writeHealthSnapshot);
  healthWrite = next.catch((error) => {
    healthFailure = error;
    controller.abort();
  });
  return next;
};

let failed = false;
try {
  const config = readAccountMailRuntimeConfig();
  fingerprint = runtimeFingerprint(config);
  const dispatcher = createAccountMailDispatcher(config);

  const assertQueueKeyCoverage = async () => {
    const requiredKeyIds = await accountMailOutboxRepository.requiredKeyIds();
    if (requiredKeyIds.some((keyId) => !(keyId in config.keys))) {
      throw new Error("Account mail queue requires an unavailable encryption key");
    }
  };

  const guardedDispatcher = {
    runBatch: async (limit?: number, signal?: AbortSignal) => {
      await assertQueueKeyCoverage();
      return dispatcher.runBatch(limit, signal);
    },
  };

  const refreshProviderGate = async (emitChange = false) => {
    const state = await accountMailWorkerRepository.providerGateStatus();
    const blockedUntil = state.blockedUntil?.toISOString() ?? null;
    const changed = state.blocked !== healthProviderBlocked
      || blockedUntil !== healthProviderBlockedUntil
      || state.failureStreak !== healthProviderFailureStreak;
    healthProviderBlocked = state.blocked;
    healthProviderBlockedUntil = blockedUntil;
    healthProviderFailureStreak = state.failureStreak;
    if (emitChange && changed) {
      emit({
        status: "provider_gate",
        config: fingerprint,
        blocked: state.blocked,
        blockedUntil,
        failureStreak: state.failureStreak,
      });
    }
  };

  const refreshDeliveryStats = async () => {
    const stats = await accountMailWorkerRepository.deliveryStats(30);
    healthDeliveryWindowMinutes = stats.windowMinutes;
    healthDeliveryAccepted = stats.accepted;
    healthDeliveryRetried = stats.retried;
    healthDeliveryDiscarded = stats.discarded;
    healthDeliveryProviderDeferred = stats.providerDeferred;
    healthDeliveryUncertain = stats.uncertain;
  };

  const refreshQueueStats = async (emitChange = false) => {
    const stats = await accountMailOutboxRepository.stats();
    const pressure = stats.pending * 100 >= stats.capacity * 80;
    const pressureChanged = pressure !== healthQueuePressure;
    healthQueuePending = stats.pending;
    healthQueueDue = stats.due;
    healthQueueLeased = stats.leased;
    healthQueueCapacity = stats.capacity;
    healthQueueOldestAgeSeconds = stats.oldestAgeSeconds;
    healthQueuePressure = pressure;
    if (emitChange && pressureChanged) {
      emit({
        status: "queue_pressure",
        config: fingerprint,
        active: pressure,
        pending: stats.pending,
        due: stats.due,
        leased: stats.leased,
        capacity: stats.capacity,
        oldestAgeSeconds: stats.oldestAgeSeconds,
      });
    }
  };

  await queueHealth();
  await checkDatabaseConnection();

  await assertQueueKeyCoverage();
  await refreshProviderGate();
  await refreshQueueStats();
  await refreshDeliveryStats();

  healthStatus = "ready";
  await queueHealth();
  if (process.argv.includes("--ready")) {
    emit({ status: "ready", config: fingerprint });
  }

  heartbeatTimer = setInterval(() => {
    void queueHealth().catch(() => {
      // queueHealth records the failure and aborts the main loop. Avoid an
      // unhandled rejection from the timer; the main path will fail closed.
    });
  }, HEARTBEAT_INTERVAL_MS);
  heartbeatTimer.unref();

  const summary = await runAccountMailLoop({
    dispatcher: guardedDispatcher,
    signal: controller.signal,
    batchSize: config.batchSize,
    pollIntervalMs: config.pollIntervalMs,
    once: process.argv.includes("--once"),
    onBatch: async ({ batch, result }) => {
      healthBatch = batch;
      await refreshProviderGate(true);
      await refreshQueueStats(true);
      await refreshDeliveryStats();
      await queueHealth();

      if (!controller.signal.aborted && Date.now() >= nextAbuseCleanupAt) {
        const removed = await accountRecoveryAbuseLimitRepository.cleanup(100);
        nextAbuseCleanupAt = Date.now() + 60_000;
        if (removed > 0) {
          emit({
            status: "maintenance",
            config: fingerprint,
            abuseLimitsRemoved: removed,
          });
        }
      }

      const activity = result.accepted + result.retried + result.discarded
        + result.skipped + result.unsettled + result.cleaned;
      if (activity > 0) {
        emit({
          status: "batch",
          config: fingerprint,
          batch,
          accepted: result.accepted,
          retried: result.retried,
          discarded: result.discarded,
          skipped: result.skipped,
          unsettled: result.unsettled,
          cleaned: result.cleaned,
          ...(result.providerDeferred === true ? { providerDeferred: true } : {}),
        });
      }
    },
  });

  await healthWrite;
  if (healthFailure) throw new Error("Account mail worker heartbeat failed");

  emit({
    status: "stopped",
    config: fingerprint,
    batches: summary.batches,
    accepted: summary.accepted,
    retried: summary.retried,
    discarded: summary.discarded,
    skipped: summary.skipped,
    unsettled: summary.unsettled,
    cleaned: summary.cleaned,
  });
} catch {
  failed = true;
  process.stderr.write(JSON.stringify({
    status: "failed",
    config: fingerprint || undefined,
  }) + "\n");
  process.exitCode = 1;
} finally {
  if (heartbeatTimer) clearInterval(heartbeatTimer);

  try {
    await healthWrite;
  } catch {
    // The generic failure event above is the only diagnostic exposed.
  }

  try {
    await rm(HEALTH_TMP, { force: true });
    await rm(HEALTH_FILE, { force: true });
  } catch {
    if (!failed) {
      process.stderr.write(JSON.stringify({ status: "failed", config: fingerprint || undefined }) + "\n");
      process.exitCode = 1;
      failed = true;
    }
  }

  try {
    await closeDatabaseConnection();
  } catch {
    if (!failed) {
      process.stderr.write(JSON.stringify({ status: "failed", config: fingerprint || undefined }) + "\n");
      process.exitCode = 1;
    }
  }
}
