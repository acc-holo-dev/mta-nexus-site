import { rename, rm, writeFile } from "node:fs/promises";
import { closeDatabaseConnection } from "../src/client";
import {
  createAccountMailDispatcher,
  readAccountMailRuntimeConfig,
  runAccountMailLoop,
  runtimeFingerprint,
} from "../src/repositories/account-mail-runtime";

const HEALTH_FILE = "/tmp/nexus-account-mail-worker-health.json";
const HEALTH_TMP = `${HEALTH_FILE}.${process.pid}.tmp`;
const controller = new AbortController();
let stopping = false;
let readyEmitted = false;
let fingerprint = "";

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

let failed = false;
try {
  const config = readAccountMailRuntimeConfig();
  fingerprint = runtimeFingerprint(config);
  const dispatcher = createAccountMailDispatcher(config);
  const staleAfterMs = Math.min(
    600_000,
    Math.max(
      60_000,
      config.batchSize * config.smtpTimeoutMs + config.pollIntervalMs + 30_000,
    ),
  );

  const writeHealth = async (
    status: "starting" | "ready",
    batch = 0,
  ) => {
    const payload = JSON.stringify({
      status,
      config: fingerprint,
      pid: process.pid,
      batch,
      heartbeatAt: new Date().toISOString(),
      staleAfterMs,
    });
    await writeFile(HEALTH_TMP, payload, { encoding: "utf8", mode: 0o600 });
    await rename(HEALTH_TMP, HEALTH_FILE);
  };

  await writeHealth("starting");

  const summary = await runAccountMailLoop({
    dispatcher,
    signal: controller.signal,
    batchSize: config.batchSize,
    pollIntervalMs: config.pollIntervalMs,
    once: process.argv.includes("--once"),
    onBatch: async ({ batch, result }) => {
      await writeHealth("ready", batch);
      if (process.argv.includes("--ready") && !readyEmitted) {
        readyEmitted = true;
        emit({ status: "ready", config: fingerprint });
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
        });
      }
    },
  });

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
