import { assertServerObservationCaptureEnvironment } from "../../../scripts/server-observation-capture-contract.mjs";
import { readServerObservationCaptureOptions } from "../../../scripts/server-observation-capture-options.mjs";

async function main() {
  assertServerObservationCaptureEnvironment(process.env);

  const options = readServerObservationCaptureOptions(process.env);

  // Import application/database code only after the explicit mutation guard.
  const [{ captureKnownServerObservations }, { closeDatabaseConnection }] =
    await Promise.all([
      import("../src/lib/services/server-observation-collector"),
      import("@nexus/db"),
    ]);

  try {
    const result = await captureKnownServerObservations(options);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await closeDatabaseConnection();
  }
}

main().catch((error) => {
  const message =
    error instanceof Error
      ? error.message
      : "Server observation capture failed";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
