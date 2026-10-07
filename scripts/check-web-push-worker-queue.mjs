import { readWebPushWorkerHealthSnapshot } from "./web-push-worker-health-state.mjs";

try {
  const snapshot = await readWebPushWorkerHealthSnapshot();
  process.stdout.write(`${JSON.stringify({
    status: snapshot.queueAlert,
    reasons: snapshot.queueAlertReasons,
    configured: snapshot.configured,
    queuePending: snapshot.queuePending,
    queueDue: snapshot.queueDue,
    queueLeased: snapshot.queueLeased,
    queueCapacity: snapshot.queueCapacity,
    queueOldestAgeSeconds: snapshot.queueOldestAgeSeconds,
    thresholds: snapshot.queueAlertThresholds,
  })}\n`);
  if (snapshot.queueAlert === "alert") process.exitCode = 2;
} catch {
  process.stderr.write('{"status":"invalid"}\n');
  process.exitCode = 1;
}
