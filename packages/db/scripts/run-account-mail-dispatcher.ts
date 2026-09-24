import { createAccountMailDispatcher, readAccountMailRuntimeConfig, runAccountMailLoop, runtimeFingerprint } from "../src/repositories/account-mail-runtime";

const config = readAccountMailRuntimeConfig();
const dispatcher = createAccountMailDispatcher(config);
const controller = new AbortController();
let stopping = false;
const stop = () => {
  if (stopping) return;
  stopping = true;
  controller.abort();
};
process.once("SIGTERM", stop);
process.once("SIGINT", stop);

try {
  const summary = await runAccountMailLoop({
    dispatcher,
    signal: controller.signal,
    batchSize: config.batchSize,
    pollIntervalMs: config.pollIntervalMs,
    once: process.argv.includes("--once"),
  });
  process.stdout.write(JSON.stringify({
    status: "ok",
    config: runtimeFingerprint(config),
    batches: summary.batches,
    accepted: summary.accepted,
    retried: summary.retried,
    discarded: summary.discarded,
    skipped: summary.skipped,
    unsettled: summary.unsettled,
    cleaned: summary.cleaned,
  }) + "\n");
} catch {
  // Do not echo environment, recipient, token, transport response or ciphertext.
  process.stderr.write("Account mail dispatcher failed\n");
  process.exitCode = 1;
}
