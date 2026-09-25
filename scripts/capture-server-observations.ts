import { assertServerObservationCaptureEnvironment } from "./server-observation-capture-contract.mjs";

async function main() {
  assertServerObservationCaptureEnvironment(process.env);

  // Import application/database code only after the explicit mutation guard.
  const [{ captureKnownServerObservations }, { closeDatabaseConnection }] =
    await Promise.all([
      import("../apps/web/src/lib/services/server-observation-collector"),
      import("@nexus/db"),
    ]);

  try {
    const result = await captureKnownServerObservations();
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
