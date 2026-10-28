import {
  assertServerObservationCaptureEnvironment,
  assertServerObservationCaptureResult,
} from "../../../scripts/server-observation-capture-contract.mjs";
import { readServerObservationCaptureOptions } from "../../../scripts/server-observation-capture-options.mjs";

async function main() {
  assertServerObservationCaptureEnvironment(process.env);

  const options = readServerObservationCaptureOptions(process.env);

  // Import application/database code only after the explicit mutation guard.
  const [{ captureKnownServerObservations }, { closeDatabaseConnection }] = await Promise.all([
    import("../src/lib/services/server-observation-collector"),
    import("@nexus/db"),
  ]);

  try {
    const result = await captureKnownServerObservations({
      ...options,
      // Progress goes to stderr, leaving stdout as exactly one final JSON
      // summary. Checkpoints are emitted only for explicit multi-page runs.
      // If the next page fails, the most recent logged afterId is a safe
      // resume point; replaying an incomplete page remains idempotent.
      onPageCompleted:
        options.maxPages > 1
          ? (checkpoint) => {
              process.stderr.write(`NEXUS_OBSERVATION_CHECKPOINT ${JSON.stringify(checkpoint)}\n`);
            }
          : undefined,
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    // Keep machine-readable diagnostics while failing the operator command;
    // a stale snapshot cannot represent a successfully persisted capture.
    assertServerObservationCaptureResult(result);
  } finally {
    await closeDatabaseConnection();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Server observation capture failed";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
